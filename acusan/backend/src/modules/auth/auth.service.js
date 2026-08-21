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
    nombre: 'Román',
    email: 'roman@acuasan.com',
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
   * Registrar nuevo usuario en el sistema
   */
  async registrarUsuario(datos) {
    const { nombre, email, password, rol, cedula, cargo } = datos

    if (!nombre || !email || !password || !rol) {
      throw { status: 400, message: 'Nombre, correo, contraseña y rol son obligatorios.' }
    }

    const emailFormateado = email.toLowerCase().trim()

    const existente = await prisma.usuario.findUnique({
      where: { email: emailFormateado }
    })

    if (existente) {
      logger.warn('AUTH', 'REG. DUPLIC', `Intento de registro con email ya existente: ${emailFormateado}`)
      throw { status: 400, message: 'El correo electrónico ya se encuentra registrado en el sistema.' }
    }

    const rolesValidos = ['ENCARGADO', 'GERENCIA', 'OPERATIVO', 'ADMIN', 'RADICADOS']
    const rolNormalizado = rol.toUpperCase().trim()

    if (!rolesValidos.includes(rolNormalizado)) {
      throw { status: 400, message: `Rol no válido. Los roles permitidos son: ${rolesValidos.join(', ')}` }
    }

    const hashPassword = await bcrypt.hash(password, 10)

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: emailFormateado,
        password: hashPassword,
        rol: rolNormalizado,
        cedula: cedula ? cedula.trim() : null,
        cargo: cargo ? cargo.trim() : `Funcionario ${rolNormalizado}`,
        activo: true
      }
    })

    logger.success(
      'AUTH',
      'REGISTRO',
      `Nuevo usuario: ${nuevoUsuario.email} | Rol: ${rolNormalizado} | Cargo: ${nuevoUsuario.cargo}`
    )

    const payload = {
      id: nuevoUsuario.id,
      nombre: nuevoUsuario.nombre,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol,
      cargo: nuevoUsuario.cargo
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    })

    return {
      token,
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
   * Solicitar recuperación de contraseña (Genera código de recuperación)
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

    const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString()

    logger.info('AUTH', 'RECUP. PWD', `Código de recuperación generado para: ${emailFormateado}`)

    return {
      email: usuario.email,
      codigoVerificacion,
      message: `Se ha enviado el código de verificación al correo ${usuario.email}.`
    }
  },

  /**
   * Resetear contraseña e integrarla actualizada a la BD
   */
  async resetearPassword({ email, nuevaPassword }) {
    if (!email || !nuevaPassword) {
      throw { status: 400, message: 'El correo y la nueva contraseña son obligatorios.' }
    }

    if (nuevaPassword.length < 6) {
      throw { status: 400, message: 'La contraseña debe tener al menos 6 caracteres.' }
    }

    const emailFormateado = email.toLowerCase().trim()
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailFormateado }
    })

    if (!usuario) {
      throw { status: 404, message: 'Usuario no encontrado.' }
    }

    const hashNuevaPassword = await bcrypt.hash(nuevaPassword, 10)

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { password: hashNuevaPassword }
    })

    logger.success('AUTH', 'RESET PWD', `Contraseña actualizada para: ${emailFormateado}`)

    return {
      email: usuario.email,
      message: 'Contraseña actualizada correctamente en la base de datos de Acuasan. Ya puede ingresar con su nueva clave.'
    }
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
