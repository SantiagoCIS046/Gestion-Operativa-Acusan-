import prisma from '../../config/prisma.js'
import logger from '../../config/logger.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const USUARIOS_SEMILLA = [
  {
    nombre: 'Eliana',
    email: 'eliana@acuasan.com',
    password: 'acuasan2026',
    rol: 'RADICADOS',
    cedula: '11009004',
    cargo: 'Encargada de Radicaciones'
  },
  {
    nombre: 'Ramon',
    email: 'ramon@acuasan.com',
    password: 'acuasan2026',
    rol: 'ENCARGADO',
    cedula: '11009002',
    cargo: 'Encargado de Permisos, Horas Extras y Radicados'
  },
  {
    nombre: 'Gerencia General Acuasan',
    email: 'gerencia@acuasan.com',
    password: 'acuasan2026',
    rol: 'GERENCIA',
    cedula: '11009001',
    cargo: 'Gerente General'
  },
  {
    nombre: 'Atención al Ciudadano PQR',
    email: 'operativo@acuasan.com',
    password: 'acuasan2026',
    rol: 'OPERATIVO',
    cedula: '11009003',
    cargo: 'Agente de Atención al Usuario'
  },
  {
    nombre: 'Administrador de TI & Sistemas',
    email: 'admin@acuasan.com',
    password: 'acuasan2026',
    rol: 'ADMIN',
    cedula: '11009000',
    cargo: 'Administrador del Sistema'
  }
]

export const AuthService = {
  /**
   * Crear usuarios semilla oficiales si no existen
   */
  async asegurarUsuariosIniciales() {
    try {
      for (const u of USUARIOS_SEMILLA) {
        const existe = await prisma.usuario.findUnique({
          where: { email: u.email }
        })

        if (!existe) {
          const hash = await bcrypt.hash(u.password, 10)
          await prisma.usuario.create({
            data: {
              nombre: u.nombre,
              email: u.email,
              password: hash,
              rol: u.rol,
              cedula: u.cedula,
              cargo: u.cargo,
              activo: true
            }
          })
          logger.success('AUTH', 'SEED CREAR', `${u.email} (${u.rol}) — creado en BD`)
        } else {
          // Actualizar nombre y cargo si ya existen
          await prisma.usuario.update({
            where: { id: existe.id },
            data: { nombre: u.nombre, cargo: u.cargo }
          })
        }
      }
    } catch (err) {
      logger.warn('AUTH', 'SEED ERROR', err.message)
    }
  },

  /**
   * Login: verifica credenciales, registra el acceso y retorna token JWT + datos de usuario
   */
  async login(email, password, meta = {}) {
    if (!email || !password) {
      throw { status: 400, message: 'El correo y la contraseña son obligatorios.' }
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (!usuario) {
      logger.warn('AUTH', 'LOGIN FAIL', `Email no registrado: ${email} | IP: ${meta.ip || '?'}`)
      throw { status: 401, message: 'Credenciales inválidas. Verifique su correo o contraseña.' }
    }

    if (!usuario.activo) {
      logger.warn('AUTH', 'LOGIN BLOCK', `Cuenta desactivada: ${email} | IP: ${meta.ip || '?'}`)
      throw { status: 403, message: 'Su cuenta está desactivada. Contacte al administrador.' }
    }

    const passwordValido = await bcrypt.compare(password, usuario.password)
    if (!passwordValido) {
      logger.warn('AUTH', 'LOGIN FAIL', `Contraseña incorrecta: ${email} | IP: ${meta.ip || '?'}`)
      throw { status: 401, message: 'Credenciales inválidas. Verifique su correo o contraseña.' }
    }

    const ahora = new Date()

    // Actualizar último acceso del usuario
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: ahora }
    })

    // Registrar el acceso en el audit log
    try {
      await prisma.registroAcceso.create({
        data: {
          usuarioId: usuario.id,
          nombreUsuario: usuario.nombre,
          emailUsuario: usuario.email,
          rolUsuario: usuario.rol,
          cargoUsuario: usuario.cargo,
          ipAddress: meta.ip || null,
          userAgent: meta.userAgent || null,
          fechaAcceso: ahora
        }
      })
    } catch (auditError) {
      logger.warn('AUTH', 'AUDIT WARN', `No se pudo registrar acceso: ${auditError.message}`)
    }

    logger.success(
      'AUTH',
      'LOGIN OK',
      `${usuario.email} (${usuario.rol}) — "${usuario.cargo}" | IP: ${meta.ip || '?'}`
    )

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      cargo: usuario.cargo
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    })

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        cargo: usuario.cargo,
        cedula: usuario.cedula,
        ultimoAcceso: ahora
      }
    }
  },

  /**
   * Registrar nuevo usuario en el sistema (autoregistro público)
   *
   * Regla de seguridad institucional: el autoregistro SIEMPRE crea un
   * Funcionario Operativo. Cualquier rol enviado en el body se ignora —
   * la asignación de roles (ENCARGADO, GERENCIA, RADICADOS, ADMIN) la
   * hace exclusivamente el Administrador desde /api/admin/usuarios.
   * Tampoco devuelve JWT: el cliente inicia sesión aparte con /login.
   */
  async registrarUsuario(datos) {
    const { nombre, email, password, cedula } = datos

    if (!nombre || !email || !password) {
      throw { status: 400, message: 'Nombre, correo y contraseña son obligatorios.' }
    }

    if (datos.rol && String(datos.rol).toUpperCase().trim() !== 'OPERATIVO') {
      logger.warn('AUTH', 'REGISTRO', `Ignorado rol solicitado "${datos.rol}": el autoregistro siempre es OPERATIVO`)
    }
    const rol = 'OPERATIVO'

    const emailFormateado = email.toLowerCase().trim()

    const existente = await prisma.usuario.findUnique({
      where: { email: emailFormateado }
    })

    if (existente) {
      logger.warn('AUTH', 'REG. DUPLIC', `Intento de registro con email ya existente: ${emailFormateado}`)
      throw { status: 400, message: 'El correo electrónico ya se encuentra registrado en el sistema.' }
    }

    const hashPassword = await bcrypt.hash(password, 10)

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: emailFormateado,
        password: hashPassword,
        rol,
        cedula: cedula ? cedula.trim() : null,
        cargo: datos.cargo ? datos.cargo.trim() : 'Funcionario Operativo',
        activo: true
      }
    })

    logger.success(
      'AUTH',
      'REGISTRO',
      `Nuevo usuario: ${nuevoUsuario.email} | Rol: ${rol} (autoregistro) | Cargo: ${nuevoUsuario.cargo}`
    )

    return {
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
        cargo: nuevoUsuario.cargo,
        cedula: nuevoUsuario.cedula
      }
    }
  },

  /**
   * Solicitar recuperación de contraseña.
   *
   * El restablecimiento es mediado por el Administrador: no existe canal de
   * correo institucional, y un código devuelto en la propia respuesta HTTP
   * sería visible también para un atacante. El ADMIN restablece la clave
   * desde Gestión de Usuarios (/api/admin/usuarios).
   */
  async solicitarRecuperacion(email) {
    if (!email) {
      throw { status: 400, message: 'El correo electrónico es obligatorio.' }
    }

    const emailFormateado = email.toLowerCase().trim()
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailFormateado }
    })

    if (!usuario) {
      throw { status: 404, message: 'No existe ningún usuario registrado con ese correo electrónico.' }
    }

    logger.warn('AUTH', 'RESET SOLICITADO', `Solicitud de restablecimiento para: ${emailFormateado}`)

    return {
      email: usuario.email,
      message: 'Solicitud registrada. Contacte al Administrador del Sistema (admin@acuasan.com): él restablece su contraseña desde la Gestión de Usuarios.'
    }
  },

  /**
   * Genera un token JWT para empleados de campo que acceden por cédula
   * desde la app externa (sin contraseña completa).
   *
   * Si la cédula existe en la BD de usuarios, carga el nombre oficial.
   * Si no existe, usa el nombre enviado por el propio empleado (confianza
   * básica: solo pueden reportar sus propias horas ya que la cédula del
   * token sella su identidad).
   *
   * El token tiene rol EMPLEADO_CAMPO y expira en 12h (turno de trabajo).
   */
  async tokenEmpleado({ cedula, nombre }) {
    if (!cedula) {
      throw { status: 400, message: 'La cédula es obligatoria.' }
    }

    // Intentar buscar usuario en la BD para obtener nombre oficial
    let nombreFinal = nombre?.trim() || null
    try {
      const usuarioBD = await prisma.usuario.findFirst({
        where: { cedula: cedula.trim() }
      })
      if (usuarioBD) {
        nombreFinal = usuarioBD.nombre
      }
    } catch (e) {
      // Si falla la búsqueda, usar el nombre enviado por el cliente
    }

    if (!nombreFinal) {
      throw { status: 400, message: 'No se encontró el nombre del empleado. Por favor ingrese su nombre completo.' }
    }

    const payload = {
      cedula: cedula.trim(),
      nombre: nombreFinal,
      rol: 'EMPLEADO_CAMPO'
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '12h' // Duración de un turno de trabajo
    })

    logger.success(
      'AUTH',
      'TOKEN-EMPLEADO',
      `Cédula: ${cedula.trim()} | Nombre: ${nombreFinal} | Token 12h generado`
    )

    return { token, nombre: nombreFinal, cedula: cedula.trim() }
  },

  /**
   * Verifica un token JWT y retorna el payload decodificado
   */
  verificarToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      throw { status: 401, message: 'Token inválido o expirado. Inicie sesión nuevamente.' }
    }
  }
}
