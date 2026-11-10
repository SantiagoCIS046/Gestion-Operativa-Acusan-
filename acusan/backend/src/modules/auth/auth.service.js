// Autenticación: inicio de sesión, autorregistro y recuperación de contraseña.
//
// Historial:
// - 2026-10-16: passwordHash reemplaza a password; rol/areaId del enum Rol;
//   el seed de usuarios vive en prisma/seed.mjs (npm run db:seed).
// - 2026-11-10: se retiraron las rutas de la antigua app Horas Extras
//   (verificar-cedula / token-empleado). Se agregan: bloqueo por intentos
//   fallidos, autorregistro pendiente de aprobación, contraseña temporal que
//   obliga a cambiarla, recuperación por correo con enlace de un solo uso y
//   cierre de sesiones viejas (sesionesDesde).

import prisma from '../../config/prisma.js'
import logger from '../../config/logger.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { validarPassword, nuevoTokenRecuperacion, hashToken, EMAIL_VALIDO } from '../../lib/password.js'
import { correoHabilitado, enviarCorreo, plantillaCorreo, urlSistema } from '../../services/correo.js'

// Costo de bcrypt (2^12 rondas). Subirlo hace más lento cada intento de
// fuerza bruta sobre un hash robado; los hashes viejos (costo 10) se
// actualizan solos en el siguiente login correcto del usuario.
export const COSTO_BCRYPT = 12

// Bloqueo por fuerza bruta: tras MAX_INTENTOS fallidos seguidos la cuenta
// queda bloqueada MINUTOS_BLOQUEO (se guarda en la base: vale aunque la API
// corra en varias instancias).
export const MAX_INTENTOS = 5
export const MINUTOS_BLOQUEO = 15

// Vigencia del enlace de recuperación
const MINUTOS_TOKEN_RECUPERACION = 60

const MENSAJE_CREDENCIALES = 'Credenciales inválidas. Verifique su correo o contraseña.'

/** Firma el JWT de sesión con el payload mínimo que exige requireAuth. */
export function firmarSesion(usuario) {
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    areaId: usuario.areaId,
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  })
}

/** Datos públicos de la sesión (lo que el frontend guarda). */
export const usuarioDeSesion = (u) => ({
  id: u.id,
  nombre: u.nombre,
  email: u.email,
  rol: u.rol,
  areaId: u.areaId,
  debeCambiarPassword: Boolean(u.debeCambiarPassword),
})

/**
 * Correo con el enlace para crear o restablecer la contraseña. Guarda el
 * hash del token y su vencimiento. Devuelve el resultado del envío.
 */
export async function enviarEnlacePassword(usuario, { bienvenida = false, minutos = MINUTOS_TOKEN_RECUPERACION } = {}) {
  const { token, hash } = nuevoTokenRecuperacion()
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { resetTokenHash: hash, resetTokenExpira: new Date(Date.now() + minutos * 60_000) },
  })
  const url = `${urlSistema()}/restablecer?token=${encodeURIComponent(token)}`
  const horas = Math.round(minutos / 60)
  const { html, texto } = plantillaCorreo({
    titulo: bienvenida ? 'Bienvenido al sistema de gestión operativa' : 'Restablecer tu contraseña',
    parrafos: bienvenida
      ? [
          `Hola ${usuario.nombre}. Se creó tu cuenta en el sistema de radicados de Acuasan con el correo ${usuario.email}.`,
          `Usa el botón para crear tu contraseña. El enlace vence en ${horas} hora(s).`,
        ]
      : [
          `Hola ${usuario.nombre}. Recibimos una solicitud para restablecer tu contraseña.`,
          `El enlace sirve una sola vez y vence en ${minutos} minutos. Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.`,
        ],
    boton: { texto: bienvenida ? 'Crear mi contraseña' : 'Restablecer contraseña', url },
  })
  return enviarCorreo({
    para: usuario.email,
    asunto: bienvenida ? 'Acuasan · Tu cuenta está lista' : 'Acuasan · Restablecer contraseña',
    html,
    texto,
  })
}

export const AuthService = {
  /**
   * El seed de usuarios se movió a prisma/seed.mjs (npm run db:seed desde la
   * raíz). Se conserva el método para no romper el arranque en app.js, pero
   * ya no crea usuarios en cada boot.
   */
  async asegurarUsuariosIniciales() {
    logger.success('AUTH', 'SEED MOVIDO', 'Seed de usuarios → prisma/seed.mjs (npm run db:seed)')
  },

  /** GET /api/auth/opciones — lo que la pantalla de login necesita saber. */
  opciones() {
    return { correoHabilitado: correoHabilitado() }
  },

  /**
   * Login: verifica credenciales (con bloqueo por intentos), registra el
   * acceso y retorna token JWT + datos de usuario.
   */
  async login(email, password, meta = {}) {
    if (!email || !password) {
      throw { status: 400, message: 'El correo y la contraseña son obligatorios.' }
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    })

    if (!usuario) {
      logger.warn('AUTH', 'LOGIN FAIL', `Email no registrado: ${email} | IP: ${meta.ip || '?'}`)
      throw { status: 401, message: MENSAJE_CREDENCIALES }
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutos = Math.max(1, Math.ceil((usuario.bloqueadoHasta - Date.now()) / 60_000))
      logger.warn('AUTH', 'LOGIN BLOCK', `Cuenta bloqueada por intentos: ${email} | IP: ${meta.ip || '?'}`)
      throw {
        status: 429,
        message: `Demasiados intentos fallidos. Por seguridad, la cuenta se desbloquea en ${minutos} minuto(s).`,
      }
    }

    const passwordValido = await bcrypt.compare(password, usuario.passwordHash)
    if (!passwordValido) {
      const intentos = (usuario.intentosFallidos ?? 0) + 1
      const bloquear = intentos >= MAX_INTENTOS
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: bloquear
          ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) }
          : { intentosFallidos: intentos },
      })
      logger.warn('AUTH', 'LOGIN FAIL', `Contraseña incorrecta (${intentos}/${MAX_INTENTOS}): ${email} | IP: ${meta.ip || '?'}`)
      if (bloquear) {
        throw {
          status: 429,
          message: `Demasiados intentos fallidos. Por seguridad, la cuenta queda bloqueada ${MINUTOS_BLOQUEO} minutos.`,
        }
      }
      throw { status: 401, message: MENSAJE_CREDENCIALES }
    }

    // El estado de la cuenta se revela solo con la contraseña correcta: así
    // el formulario no sirve para averiguar qué cuentas existen.
    if (usuario.pendienteAprobacion) {
      throw {
        status: 403,
        message: 'Su solicitud de cuenta está pendiente de aprobación por gerencia. Le avisaremos cuando quede activa.',
      }
    }
    if (!usuario.activo) {
      logger.warn('AUTH', 'LOGIN BLOCK', `Cuenta desactivada: ${email} | IP: ${meta.ip || '?'}`)
      throw { status: 403, message: 'Su cuenta está desactivada. Contacte a gerencia o a su líder de área.' }
    }

    const ahora = new Date()
    const cambios = { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: ahora }
    // Rehash transparente: si el hash guardado usa un costo menor al actual,
    // se reemplaza ahora que se conoce la contraseña correcta.
    try {
      if (bcrypt.getRounds(usuario.passwordHash) < COSTO_BCRYPT) {
        cambios.passwordHash = await bcrypt.hash(password, COSTO_BCRYPT)
      }
    } catch (rehashError) {
      logger.warn('AUTH', 'REHASH WARN', `No se pudo actualizar el hash: ${rehashError.message}`)
    }
    await prisma.usuario.update({ where: { id: usuario.id }, data: cambios })

    // Registrar el acceso en el audit log (snapshot del rol como String).
    // Las pruebas automáticas no lo llenan de inicios de sesión ficticios.
    if (process.env.NODE_ENV !== 'test') try {
      await prisma.registroAcceso.create({
        data: {
          usuarioId: usuario.id,
          nombreUsuario: usuario.nombre,
          emailUsuario: usuario.email,
          rolUsuario: usuario.rol,
          ipAddress: meta.ip || null,
          userAgent: meta.userAgent || null,
          fechaAcceso: ahora,
        },
      })
    } catch (auditError) {
      logger.warn('AUTH', 'AUDIT WARN', `No se pudo registrar acceso: ${auditError.message}`)
    }

    logger.success('AUTH', 'LOGIN OK', `${usuario.email} (${usuario.rol}) | IP: ${meta.ip || '?'}`)

    return { token: firmarSesion(usuario), usuario: usuarioDeSesion(usuario) }
  },

  /**
   * Autorregistro público. La cuenta nace como USUARIO del área líder,
   * INACTIVA y pendiente de aprobación: gerencia la aprueba (y le asigna
   * área y rol) desde Usuarios. Antes entraba de inmediato al área de
   * gerencia y veía sus radicados.
   */
  async registrarUsuario(datos) {
    const nombre = String(datos?.nombre ?? '').trim()
    const email = String(datos?.email ?? '').toLowerCase().trim()
    const password = datos?.password

    if (!nombre || !email || !password) {
      throw { status: 400, message: 'Nombre, correo y contraseña son obligatorios.' }
    }
    if (!EMAIL_VALIDO.test(email)) {
      throw { status: 400, message: 'El correo electrónico no es válido.' }
    }
    validarPassword(password)

    if (datos.rol && String(datos.rol).toUpperCase().trim() !== 'USUARIO') {
      logger.warn('AUTH', 'REGISTRO', `Ignorado rol solicitado "${datos.rol}": el autoregistro siempre es USUARIO`)
    }

    const existente = await prisma.usuario.findUnique({ where: { email } })
    if (existente) {
      logger.warn('AUTH', 'REG. DUPLIC', `Intento de registro con email ya existente: ${email}`)
      throw { status: 400, message: 'El correo electrónico ya se encuentra registrado en el sistema.' }
    }

    const areaLider = await prisma.area.findFirst({ where: { parentId: null } })
    if (!areaLider) {
      throw {
        status: 409,
        message: 'No existe un área líder en la base de datos. Ejecute el seed (npm run db:seed).',
      }
    }

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash: await bcrypt.hash(password, COSTO_BCRYPT),
        rol: 'USUARIO',
        areaId: areaLider.id,
        activo: false,
        pendienteAprobacion: true,
      },
    })

    logger.success('AUTH', 'REGISTRO', `Solicitud de cuenta: ${nuevoUsuario.email} (pendiente de aprobación)`)

    // Aviso a gerencia: hay una solicitud por aprobar
    const gerencia = await prisma.usuario.findMany({
      where: { rol: 'LIDER_GENERAL', activo: true },
      select: { email: true },
    })
    if (gerencia.length) {
      const { html, texto } = plantillaCorreo({
        titulo: 'Nueva solicitud de cuenta',
        parrafos: [
          `${nuevoUsuario.nombre} (${nuevoUsuario.email}) pidió una cuenta en el sistema.`,
          'Apruébala o recházala desde Usuarios, asignándole su área y rol.',
        ],
        boton: { texto: 'Revisar solicitudes', url: `${urlSistema()}/usuarios` },
      })
      await enviarCorreo({ para: gerencia.map((g) => g.email), asunto: 'Acuasan · Solicitud de cuenta por aprobar', html, texto })
    }

    return {
      pendiente: true,
      usuario: { id: nuevoUsuario.id, nombre: nuevoUsuario.nombre, email: nuevoUsuario.email },
    }
  },

  /**
   * Solicitar recuperación de contraseña. Misma respuesta exista o no el
   * correo (nadie puede usar el formulario para averiguar cuentas).
   * Con correo configurado envía un enlace de un solo uso; sin correo, la
   * contraseña la restablece gerencia o el líder del área desde Usuarios.
   */
  async solicitarRecuperacion(email) {
    if (!email) {
      throw { status: 400, message: 'El correo electrónico es obligatorio.' }
    }
    const emailFormateado = String(email).toLowerCase().trim()
    const habilitado = correoHabilitado()

    const usuario = await prisma.usuario.findUnique({ where: { email: emailFormateado } })
    if (usuario?.activo && habilitado) {
      await enviarEnlacePassword(usuario)
      logger.warn('AUTH', 'RESET ENVIADO', `Enlace de restablecimiento para: ${emailFormateado}`)
    } else if (usuario) {
      logger.warn('AUTH', 'RESET SOLICITADO', `Solicitud de restablecimiento (sin envío) para: ${emailFormateado}`)
    } else {
      logger.warn('AUTH', 'RESET SIN CUENTA', `Solicitud para correo no registrado: ${emailFormateado}`)
    }

    return {
      email: emailFormateado,
      correoHabilitado: habilitado,
      message: habilitado
        ? 'Si el correo está registrado y activo, le enviamos un enlace para restablecer la contraseña. Revise su bandeja de entrada (y la de spam).'
        : 'Pida a gerencia o a su líder de área que restablezca su contraseña desde Usuarios: le entregarán una clave temporal.',
    }
  },

  /**
   * POST /api/auth/restablecer { token, password } — completa la
   * recuperación con el enlace del correo. El token sirve una sola vez.
   */
  async restablecerConToken(token, password) {
    if (!token) throw { status: 400, message: 'El enlace no es válido.' }
    const usuario = await prisma.usuario.findFirst({ where: { resetTokenHash: hashToken(token) } })
    if (!usuario || !usuario.resetTokenExpira || usuario.resetTokenExpira < new Date()) {
      throw { status: 400, message: 'El enlace venció o ya fue usado. Solicite uno nuevo.' }
    }
    if (!usuario.activo) {
      throw { status: 403, message: 'Su cuenta está desactivada. Contacte a gerencia o a su líder de área.' }
    }
    validarPassword(password)

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: await bcrypt.hash(password, COSTO_BCRYPT),
        resetTokenHash: null,
        resetTokenExpira: null,
        debeCambiarPassword: false,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        // Las sesiones abiertas con la contraseña anterior dejan de valer
        sesionesDesde: new Date(),
      },
    })
    logger.success('AUTH', 'RESET OK', `Contraseña restablecida por enlace: ${usuario.email}`)
    return { email: usuario.email }
  },

  /**
   * Verifica un token JWT y retorna el payload decodificado
   */
  verificarToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET)
    } catch {
      throw { status: 401, message: 'Token inválido o expirado. Inicie sesión nuevamente.' }
    }
  },
}
