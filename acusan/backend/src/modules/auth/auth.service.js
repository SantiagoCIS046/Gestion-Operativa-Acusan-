// Adaptado al esquema del módulo de vencimientos (2026-10-16):
// - passwordHash reemplaza a password; rol/areaId pertenecen al nuevo enum Rol
// - el seed de usuarios vive en prisma/seed.mjs (npm run db:seed)
// - cedula/cargo/ultimoAcceso dejaron de existir en el modelo Usuario

import prisma from '../../config/prisma.js'
import logger from '../../config/logger.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Costo de bcrypt (2^12 rondas). Subirlo hace más lento cada intento de
// fuerza bruta sobre un hash robado; los hashes viejos (costo 10) se
// actualizan solos en el siguiente login correcto del usuario.
export const COSTO_BCRYPT = 12

export const AuthService = {
  /**
   * El seed de usuarios se movió a prisma/seed.mjs (npm run db:seed desde la
   * raíz). Se conserva el método para no romper el arranque en app.js, pero
   * ya no crea usuarios en cada boot.
   */
  async asegurarUsuariosIniciales() {
    logger.success('AUTH', 'SEED MOVIDO', 'Seed de usuarios → prisma/seed.mjs (npm run db:seed)')
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

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash)
    if (!passwordValido) {
      logger.warn('AUTH', 'LOGIN FAIL', `Contraseña incorrecta: ${email} | IP: ${meta.ip || '?'}`)
      throw { status: 401, message: 'Credenciales inválidas. Verifique su correo o contraseña.' }
    }

    // Rehash transparente: si el hash guardado usa un costo menor al actual,
    // se reemplaza ahora que se conoce la contraseña correcta.
    try {
      if (bcrypt.getRounds(usuario.passwordHash) < COSTO_BCRYPT) {
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { passwordHash: await bcrypt.hash(password, COSTO_BCRYPT) },
        })
      }
    } catch (rehashError) {
      logger.warn('AUTH', 'REHASH WARN', `No se pudo actualizar el hash: ${rehashError.message}`)
    }

    const ahora = new Date()

    // Registrar el acceso en el audit log (snapshot del rol como String)
    try {
      await prisma.registroAcceso.create({
        data: {
          usuarioId: usuario.id,
          nombreUsuario: usuario.nombre,
          emailUsuario: usuario.email,
          rolUsuario: usuario.rol,
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
      `${usuario.email} (${usuario.rol}) | IP: ${meta.ip || '?'}`
    )

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      areaId: usuario.areaId
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
        areaId: usuario.areaId
      }
    }
  },

  /**
   * Registrar nuevo usuario en el sistema (autoregistro público)
   *
   * El autoregistro SIEMPRE crea un usuario de rol USUARIO dentro del área
   * líder (Gerencia General): la asignación de roles y áreas la hace después
   * un líder desde la gestión de usuarios. Tampoco devuelve JWT: el cliente
   * inicia sesión aparte con /login.
   */
  async registrarUsuario(datos) {
    const { nombre, email, password } = datos

    if (!nombre || !email || !password) {
      throw { status: 400, message: 'Nombre, correo y contraseña son obligatorios.' }
    }

    if (datos.rol && String(datos.rol).toUpperCase().trim() !== 'USUARIO') {
      logger.warn('AUTH', 'REGISTRO', `Ignorado rol solicitado "${datos.rol}": el autoregistro siempre es USUARIO`)
    }
    const rol = 'USUARIO'

    const emailFormateado = email.toLowerCase().trim()

    const existente = await prisma.usuario.findUnique({
      where: { email: emailFormateado }
    })

    if (existente) {
      logger.warn('AUTH', 'REG. DUPLIC', `Intento de registro con email ya existente: ${emailFormateado}`)
      throw { status: 400, message: 'El correo electrónico ya se encuentra registrado en el sistema.' }
    }

    // El área es obligatoria en el nuevo modelo: el autoregistro cae en el
    // área líder hasta que un líder lo reasigne.
    const areaLider = await prisma.area.findFirst({ where: { parentId: null } })
    if (!areaLider) {
      throw {
        status: 409,
        message: 'No existe un área líder en la base de datos. Ejecute el seed (npm run db:seed).'
      }
    }

    const passwordHash = await bcrypt.hash(password, COSTO_BCRYPT)

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: emailFormateado,
        passwordHash,
        rol,
        areaId: areaLider.id,
        activo: true
      }
    })

    logger.success(
      'AUTH',
      'REGISTRO',
      `Nuevo usuario: ${nuevoUsuario.email} | Rol: ${rol} | Área: ${areaLider.codigo}`
    )

    return {
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
        areaId: nuevoUsuario.areaId
      }
    }
  },

  /**
   * Solicitar recuperación de contraseña.
   *
   * El restablecimiento es mediado por un líder: no existe canal de
   * correo institucional, y un código devuelto en la propia respuesta HTTP
   * sería visible también para un atacante.
   */
  async solicitarRecuperacion(email) {
    if (!email) {
      throw { status: 400, message: 'El correo electrónico es obligatorio.' }
    }

    const emailFormateado = email.toLowerCase().trim()
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailFormateado }
    })

    // Misma respuesta exista o no el correo: así nadie puede usar este
    // formulario para averiguar qué correos están registrados.
    if (usuario) {
      logger.warn('AUTH', 'RESET SOLICITADO', `Solicitud de restablecimiento para: ${emailFormateado}`)
    } else {
      logger.warn('AUTH', 'RESET SIN CUENTA', `Solicitud para correo no registrado: ${emailFormateado}`)
    }

    return {
      email: emailFormateado,
      message: 'Si el correo está registrado, la solicitud quedó anotada. Contacte a su líder de área: él restablece la contraseña desde la gestión de usuarios.'
    }
  },

  /**
   * LEGADO del sistema anterior (app externa Horas Extras): la cédula dejó
   * de existir en el modelo Usuario, así que estos métodos ya no encuentran
   * nada. Se conservan para no romper rutas; el prompt del backend decidá
   * si se eliminan.
   */
  async buscarPorCedula(cedula) {
    if (!cedula) return { registrada: false }
    try {
      void cedula
    } catch (e) {
      logger.warn('AUTH', 'BUSCAR CEDULA ERR', e.message)
    }
    return { registrada: false }
  },

  async tokenEmpleado({ cedula, nombre }) {
    if (!cedula) {
      throw { status: 400, message: 'La cédula es obligatoria.' }
    }

    const nombreFinal = nombre?.trim() || null
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
