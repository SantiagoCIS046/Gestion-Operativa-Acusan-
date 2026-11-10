// Administración de cuentas de usuario (/api/usuarios).
//
// Permisos:
//   LIDER_GENERAL (gerencia): todas las cuentas. Crea con cualquier rol y
//     área, edita rol/área, aprueba o rechaza solicitudes de autorregistro y
//     restablece contraseñas.
//   LIDER_AREA: SOLO usuarios (rol USUARIO) de su propia área: los ve, crea,
//     edita nombre/correo, activa/desactiva y les restablece la contraseña.
//     No cambia roles ni áreas.
//   USUARIO: sin acceso (cambia su propia contraseña en /api/me/password).
//
// Reglas de integridad:
//   - Nadie se desactiva ni se quita el rol a sí mismo.
//   - Siempre queda al menos un LIDER_GENERAL activo.
//   - Un área tiene a lo sumo UN líder (LIDER_AREA) activo.
//   - Quien tiene radicados PENDIENTES no puede quedar inactivo ni salir de
//     su área sin pasarlos a otra persona activa del área (reasignarA): la
//     reasignación deja evento en la línea de tiempo, reinicia las alertas y
//     avisa al nuevo encargado, igual que una reasignación desde Radicados.

import bcrypt from 'bcryptjs'
import prisma from '../../config/prisma.js'
import logger from '../../config/logger.js'
import { COSTO_BCRYPT, enviarEnlacePassword } from '../auth/auth.service.js'
import { esLiderGeneral, esLiderArea } from '../auth/permisos.js'
import { invalidarCuenta } from '../../middlewares/auth.middleware.js'
import { validarPassword, passwordTemporal, EMAIL_VALIDO } from '../../lib/password.js'
import { correoHabilitado } from '../../services/correo.js'
import { enviarNotificacion } from '../alertas/notificaciones.js'

const ROLES = ['LIDER_GENERAL', 'LIDER_AREA', 'USUARIO']
const ES_OBJECTID = /^[a-f\d]{24}$/i
const HORAS_INVITACION = 72

const SELECT_PUBLICO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  areaId: true,
  activo: true,
  pendienteAprobacion: true,
  debeCambiarPassword: true,
  ultimoAcceso: true,
  bloqueadoHasta: true,
  createdAt: true,
  area: { select: { id: true, codigo: true, nombre: true } },
}

const noAutorizado = (message = 'Tu rol no tiene permiso para esta acción.') => ({ status: 403, message })
const noExiste = () => ({ status: 404, message: 'El usuario no existe.' })

const fechaCorta = (d) => new Date(d).toISOString().slice(0, 10)

function estadoDe(u) {
  if (u.pendienteAprobacion) return 'pendiente'
  return u.activo ? 'activo' : 'inactivo'
}

function publico(u, pendientes = 0) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    areaId: u.areaId,
    area: u.area ?? null,
    activo: u.activo,
    estado: estadoDe(u),
    debeCambiarPassword: Boolean(u.debeCambiarPassword),
    bloqueado: Boolean(u.bloqueadoHasta && u.bloqueadoHasta > new Date()),
    ultimoAcceso: u.ultimoAcceso,
    creado: u.createdAt,
    radicadosPendientes: pendientes,
  }
}

async function cargar(id) {
  if (!ES_OBJECTID.test(String(id ?? ''))) throw noExiste()
  const u = await prisma.usuario.findUnique({ where: { id }, select: SELECT_PUBLICO })
  if (!u) throw noExiste()
  return u
}

const pendientesDe = (usuarioId) =>
  prisma.radicado.count({ where: { encargadoId: usuarioId, estado: 'PENDIENTE' } })

/** ¿Puede este administrador tocar esta cuenta? */
function puedeAdministrar(admin, objetivo) {
  if (esLiderGeneral(admin)) return true
  if (esLiderArea(admin)) {
    return objetivo.areaId === admin.areaId && objetivo.rol === 'USUARIO' && !objetivo.pendienteAprobacion
  }
  return false
}

async function validarArea(areaId) {
  if (!ES_OBJECTID.test(String(areaId ?? ''))) throw { status: 400, message: 'Selecciona un área válida.' }
  const area = await prisma.area.findUnique({ where: { id: areaId }, select: { id: true, codigo: true, nombre: true, activa: true } })
  if (!area) throw { status: 400, message: 'El área indicada no existe.' }
  return area
}

async function liderActivoDe(areaId, excluirId = null) {
  return prisma.usuario.findFirst({
    where: { areaId, rol: 'LIDER_AREA', activo: true, ...(excluirId ? { id: { not: excluirId } } : {}) },
    select: { id: true, nombre: true },
  })
}

async function quedariaSinGerencia(excluirId) {
  const otros = await prisma.usuario.count({
    where: { rol: 'LIDER_GENERAL', activo: true, id: { not: excluirId } },
  })
  return otros === 0
}

/**
 * Pasa los radicados PENDIENTES de `desde` a `hacia` (misma área).
 * Deja evento ASIGNADO, reinicia alertas con una 'nuevo' y avisa por correo.
 */
async function reasignarPendientes(admin, desde, hacia) {
  const radicados = await prisma.radicado.findMany({
    where: { encargadoId: desde.id, estado: 'PENDIENTE' },
    select: { id: true, numeroRadicado: true, fechaLimite: true, areaId: true },
  })
  if (!radicados.length) return 0
  const area = await prisma.area.findUnique({ where: { id: radicados[0].areaId }, select: { codigo: true } })

  for (const r of radicados) {
    await prisma.$transaction(async (tx) => {
      await tx.radicado.update({ where: { id: r.id }, data: { encargadoId: hacia.id } })
      await tx.radicadoEvento.create({
        data: {
          radicadoId: r.id,
          tipo: 'ASIGNADO',
          usuarioId: admin.id,
          detalle: `Reasignado a ${hacia.nombre} (${area?.codigo ?? ''}) porque ${desde.nombre} dejó de atender el área.`,
        },
      })
      await tx.alerta.deleteMany({ where: { radicadoId: r.id } })
      await tx.alerta.create({
        data: {
          radicadoId: r.id,
          areaId: r.areaId,
          nivel: 'NUEVO',
          venceRef: new Date(),
          mensaje: `Radicado ${r.numeroRadicado} reasignado a ${hacia.nombre} (${area?.codigo ?? ''}): vence el ${fechaCorta(r.fechaLimite)}.`,
          enviadaPor: admin.id,
        },
      })
    })
  }

  await enviarNotificacion(
    {
      nivel: 'NUEVO',
      mensaje: `Se te asignaron ${radicados.length} radicado(s) pendiente(s) de ${desde.nombre}: ${radicados
        .map((r) => r.numeroRadicado)
        .slice(0, 10)
        .join(', ')}${radicados.length > 10 ? '…' : ''}.`,
    },
    [{ nombre: hacia.nombre, email: hacia.email }],
  )
  logger.info('USUARIOS', 'REASIGNACIÓN', `${radicados.length} pendiente(s) de ${desde.email} → ${hacia.email}`)
  return radicados.length
}

async function validarDestinoReasignacion(objetivo, reasignarA, areaId) {
  if (!ES_OBJECTID.test(String(reasignarA ?? ''))) {
    return null
  }
  if (reasignarA === objetivo.id) throw { status: 400, message: 'Elige a otra persona para recibir los radicados.' }
  const destino = await prisma.usuario.findUnique({
    where: { id: reasignarA },
    select: { id: true, nombre: true, email: true, areaId: true, activo: true },
  })
  if (!destino || !destino.activo || destino.areaId !== areaId) {
    throw { status: 400, message: 'Quien recibe los radicados debe ser una persona activa de la misma área.' }
  }
  return destino
}

export const UsuarioService = {
  /**
   * GET /api/usuarios?q=&areaId=&rol=&estado=activo|inactivo|pendiente
   * Gerencia ve todo; el líder de área, los usuarios de su área.
   */
  async listar(admin, query = {}) {
    if (!esLiderGeneral(admin) && !esLiderArea(admin)) throw noAutorizado()
    const where = {}
    if (esLiderGeneral(admin)) {
      if (ES_OBJECTID.test(String(query.areaId ?? ''))) where.areaId = query.areaId
      if (ROLES.includes(query.rol)) where.rol = query.rol
    } else {
      where.areaId = admin.areaId
    }

    // El estado se filtra en memoria: las cuentas creadas antes de los campos
    // nuevos no los traen, y en MongoDB ni `false` ni `{ not: true }` de
    // Prisma coinciden con un campo ausente. Las listas son cortas.
    let usuarios = (await prisma.usuario.findMany({ where, select: SELECT_PUBLICO })).filter(
      (u) => esLiderGeneral(admin) || !u.pendienteAprobacion,
    )
    if (['pendiente', 'activo', 'inactivo'].includes(query.estado)) {
      usuarios = usuarios.filter((u) => estadoDe(u) === query.estado)
    }
    const q = String(query.q ?? '').trim().toLowerCase()
    if (q) usuarios = usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.includes(q))

    // Pendientes por encargado: un count por persona (groupBy está vetado
    // sobre Radicado en este proyecto: paniquea el motor de MongoDB)
    const conteos = await Promise.all(usuarios.map((u) => pendientesDe(u.id)))

    const orden = { LIDER_GENERAL: 0, LIDER_AREA: 1, USUARIO: 2 }
    const filas = usuarios
      .map((u, i) => publico(u, conteos[i]))
      .sort(
        (a, b) =>
          (a.estado === 'pendiente' ? -1 : 0) - (b.estado === 'pendiente' ? -1 : 0) ||
          (a.area?.codigo ?? '').localeCompare(b.area?.codigo ?? '') ||
          orden[a.rol] - orden[b.rol] ||
          a.nombre.localeCompare(b.nombre),
      )

    const solicitudes = esLiderGeneral(admin)
      ? await prisma.usuario.count({ where: { pendienteAprobacion: true } })
      : 0
    return { usuarios: filas, solicitudesPendientes: solicitudes, correoHabilitado: correoHabilitado() }
  },

  /** GET /api/usuarios/:id — incluye sus radicados pendientes (para reasignar) */
  async obtener(admin, id) {
    const u = await cargar(id)
    if (!puedeAdministrar(admin, u)) throw noAutorizado()
    const pendientes = await prisma.radicado.findMany({
      where: { encargadoId: u.id, estado: 'PENDIENTE' },
      select: { id: true, numeroRadicado: true, fechaLimite: true },
      orderBy: { fechaLimite: 'asc' },
    })
    return { ...publico(u, pendientes.length), pendientes }
  },

  /**
   * POST /api/usuarios { nombre, email, rol, areaId, password? }
   * Sin password se genera una temporal. La cuenta nace obligada a cambiar
   * la contraseña en su primer ingreso. Con correo configurado, además se
   * envía una invitación con enlace para crear la contraseña.
   */
  async crear(admin, datos = {}) {
    if (!esLiderGeneral(admin) && !esLiderArea(admin)) throw noAutorizado()
    const nombre = String(datos.nombre ?? '').trim()
    const email = String(datos.email ?? '').trim().toLowerCase()
    if (!nombre) throw { status: 400, message: 'El nombre es obligatorio.' }
    if (!EMAIL_VALIDO.test(email)) throw { status: 400, message: 'El correo electrónico no es válido.' }

    let rol = 'USUARIO'
    let areaId = admin.areaId
    if (esLiderGeneral(admin)) {
      rol = ROLES.includes(datos.rol) ? datos.rol : null
      if (!rol) throw { status: 400, message: 'Selecciona el rol.' }
      areaId = datos.areaId
    } else if (datos.rol && datos.rol !== 'USUARIO') {
      throw noAutorizado('Solo gerencia puede crear líderes.')
    }
    const area = await validarArea(areaId)

    if (await prisma.usuario.findUnique({ where: { email } })) {
      throw { status: 409, message: `Ya existe una cuenta con el correo ${email}.` }
    }
    if (rol === 'LIDER_AREA') {
      const lider = await liderActivoDe(area.id)
      if (lider) {
        throw { status: 409, message: `${area.codigo} ya tiene como líder a ${lider.nombre}. Cambia primero su rol.` }
      }
    }

    const elegida = datos.password ? String(datos.password) : null
    if (elegida) validarPassword(elegida)
    const temporal = elegida ?? passwordTemporal()

    const creado = await prisma.usuario.create({
      data: {
        nombre,
        email,
        rol,
        areaId: area.id,
        activo: true,
        passwordHash: await bcrypt.hash(temporal, COSTO_BCRYPT),
        debeCambiarPassword: true,
      },
      select: SELECT_PUBLICO,
    })
    const correo = await enviarEnlacePassword(creado, { bienvenida: true, minutos: HORAS_INVITACION * 60 })
    logger.success('USUARIOS', 'CREADO', `${email} (${rol}, ${area.codigo}) por ${admin.email}`)
    return { usuario: publico(creado), passwordTemporal: temporal, invitacionEnviada: correo.enviado }
  },

  /**
   * PUT /api/usuarios/:id { nombre?, email?, rol?, areaId?, activo?, reasignarA? }
   */
  async actualizar(admin, id, datos = {}) {
    const u = await cargar(id)
    if (!puedeAdministrar(admin, u)) throw noAutorizado()
    if (u.pendienteAprobacion) {
      throw { status: 400, message: 'Esta cuenta es una solicitud: apruébala o recházala primero.' }
    }

    const cambios = {}
    if (datos.nombre !== undefined) {
      const nombre = String(datos.nombre).trim()
      if (!nombre) throw { status: 400, message: 'El nombre es obligatorio.' }
      cambios.nombre = nombre
    }
    if (datos.email !== undefined) {
      const email = String(datos.email).trim().toLowerCase()
      if (!EMAIL_VALIDO.test(email)) throw { status: 400, message: 'El correo electrónico no es válido.' }
      if (email !== u.email) {
        if (await prisma.usuario.findUnique({ where: { email } })) {
          throw { status: 409, message: `Ya existe una cuenta con el correo ${email}.` }
        }
        cambios.email = email
      }
    }

    const esMismo = admin.id === u.id
    if (datos.rol !== undefined && datos.rol !== u.rol) {
      if (!esLiderGeneral(admin)) throw noAutorizado('Solo gerencia cambia roles.')
      if (!ROLES.includes(datos.rol)) throw { status: 400, message: 'Rol no válido.' }
      if (esMismo) throw { status: 400, message: 'No puedes cambiar tu propio rol.' }
      if (u.rol === 'LIDER_GENERAL' && (await quedariaSinGerencia(u.id))) {
        throw { status: 409, message: 'Debe quedar al menos una persona activa con rol de gerencia.' }
      }
      cambios.rol = datos.rol
    }
    if (datos.areaId !== undefined && datos.areaId !== u.areaId) {
      if (!esLiderGeneral(admin)) throw noAutorizado('Solo gerencia cambia el área de una persona.')
      await validarArea(datos.areaId)
      cambios.areaId = datos.areaId
    }
    if (datos.activo !== undefined && Boolean(datos.activo) !== u.activo) {
      if (esMismo && !datos.activo) throw { status: 400, message: 'No puedes desactivar tu propia cuenta.' }
      if (!datos.activo && u.rol === 'LIDER_GENERAL' && (await quedariaSinGerencia(u.id))) {
        throw { status: 409, message: 'Debe quedar al menos una persona activa con rol de gerencia.' }
      }
      cambios.activo = Boolean(datos.activo)
    }

    // Un solo líder activo por área (rol o área nuevos, o reactivación)
    const rolFinal = cambios.rol ?? u.rol
    const areaFinal = cambios.areaId ?? u.areaId
    const activoFinal = cambios.activo ?? u.activo
    if (rolFinal === 'LIDER_AREA' && activoFinal) {
      const lider = await liderActivoDe(areaFinal, u.id)
      if (lider) {
        const area = await prisma.area.findUnique({ where: { id: areaFinal }, select: { codigo: true } })
        throw { status: 409, message: `${area?.codigo ?? 'El área'} ya tiene como líder a ${lider.nombre}. Cambia primero su rol.` }
      }
    }

    // Radicados pendientes: no pueden quedar con un encargado inactivo o de
    // otra área
    const dejaElArea = (cambios.activo === false) || (cambios.areaId && cambios.areaId !== u.areaId)
    let reasignados = 0
    if (dejaElArea) {
      const pendientes = await pendientesDe(u.id)
      if (pendientes > 0) {
        const destino = await validarDestinoReasignacion(u, datos.reasignarA, u.areaId)
        if (!destino) {
          throw {
            status: 409,
            codigo: 'TIENE_PENDIENTES',
            pendientes,
            message: `${u.nombre} tiene ${pendientes} radicado(s) pendiente(s). Elige quién los recibe antes de continuar.`,
          }
        }
        reasignados = await reasignarPendientes(admin, u, destino)
      }
    }

    if (cambios.activo === false) cambios.sesionesDesde = new Date()
    if (Object.keys(cambios).length) {
      await prisma.usuario.update({ where: { id: u.id }, data: cambios })
      invalidarCuenta(u.id)
      logger.info('USUARIOS', 'ACTUALIZADO', `${u.email}: ${Object.keys(cambios).join(', ')} por ${admin.email}`)
    }
    const final = await cargar(u.id)
    return { usuario: publico(final, await pendientesDe(u.id)), reasignados }
  },

  /**
   * POST /api/usuarios/:id/restablecer-password { password? }
   * Contraseña temporal (o la indicada) que la persona debe cambiar al
   * entrar; cierra sus sesiones abiertas y desbloquea la cuenta. Con correo
   * configurado también le llega un enlace para crear la suya.
   */
  async restablecerPassword(admin, id, datos = {}) {
    const u = await cargar(id)
    if (admin.id === u.id) throw { status: 400, message: 'Para tu propia cuenta usa “Cambiar mi contraseña”.' }
    if (!puedeAdministrar(admin, u)) throw noAutorizado()
    if (u.pendienteAprobacion) throw { status: 400, message: 'Aprueba primero la solicitud de cuenta.' }

    const elegida = datos.password ? String(datos.password) : null
    if (elegida) validarPassword(elegida)
    const temporal = elegida ?? passwordTemporal()

    await prisma.usuario.update({
      where: { id: u.id },
      data: {
        passwordHash: await bcrypt.hash(temporal, COSTO_BCRYPT),
        debeCambiarPassword: true,
        sesionesDesde: new Date(),
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    })
    invalidarCuenta(u.id)
    const correo = u.activo ? await enviarEnlacePassword(u) : { enviado: false }
    logger.warn('USUARIOS', 'RESET', `Contraseña restablecida para ${u.email} por ${admin.email}`)
    return { passwordTemporal: temporal, enlaceEnviado: correo.enviado }
  },

  /**
   * POST /api/usuarios/:id/aprobar { areaId, rol } — solo gerencia.
   * Activa una solicitud de autorregistro con su área y rol definitivos.
   */
  async aprobar(admin, id, datos = {}) {
    if (!esLiderGeneral(admin)) throw noAutorizado()
    const u = await cargar(id)
    if (!u.pendienteAprobacion) throw { status: 400, message: 'Esta cuenta no es una solicitud pendiente.' }
    const rol = ROLES.includes(datos.rol) ? datos.rol : 'USUARIO'
    const area = await validarArea(datos.areaId ?? u.areaId)
    if (rol === 'LIDER_AREA' && (await liderActivoDe(area.id))) {
      throw { status: 409, message: `${area.codigo} ya tiene un líder activo.` }
    }
    await prisma.usuario.update({
      where: { id: u.id },
      data: { activo: true, pendienteAprobacion: false, rol, areaId: area.id },
    })
    invalidarCuenta(u.id)
    await enviarNotificacion(
      { nivel: 'NUEVO', mensaje: `Tu cuenta fue aprobada: ya puedes ingresar (${area.codigo} — ${area.nombre}).` },
      [{ nombre: u.nombre, email: u.email }],
    )
    logger.success('USUARIOS', 'APROBADO', `${u.email} (${rol}, ${area.codigo}) por ${admin.email}`)
    return publico(await cargar(u.id))
  },

  /**
   * DELETE /api/usuarios/:id — solo gerencia y solo para RECHAZAR una
   * solicitud pendiente (las cuentas en uso se desactivan, nunca se borran:
   * sus radicados, eventos y accesos las referencian).
   */
  async rechazar(admin, id) {
    if (!esLiderGeneral(admin)) throw noAutorizado()
    const u = await cargar(id)
    if (!u.pendienteAprobacion) {
      throw { status: 400, message: 'Solo se eliminan solicitudes pendientes. Las cuentas en uso se desactivan.' }
    }
    await prisma.registroAcceso.deleteMany({ where: { usuarioId: u.id } })
    await prisma.usuario.delete({ where: { id: u.id } })
    invalidarCuenta(u.id)
    logger.warn('USUARIOS', 'RECHAZADO', `Solicitud de ${u.email} rechazada por ${admin.email}`)
    return { id: u.id }
  },
}
