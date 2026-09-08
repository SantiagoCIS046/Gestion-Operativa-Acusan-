/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PQR Service — Acuasan Gestión Operativa                           ║
 * ║  Capa de lógica de negocio. 100 % desacoplado de Express / HTTP.   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * SOLUCIÓN AL RADICADO SECUENCIAL EN MONGODB:
 * ─────────────────────────────────────────────
 * Usa un documento-contador dedicado (colección `contadores_secuenciales`)
 * actualizado con findAndModify + $inc vía prisma.$runCommandRaw.
 * Esta operación es atómica en MongoDB: sin importar cuántos hilos
 * la llamen en paralelo, cada uno obtiene un número DIFERENTE y
 * SECUENCIAL. No hay race conditions posibles.
 */

import { randomUUID } from 'crypto'
import prisma from '../../config/prisma.js'

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const DIAS_TERMINO_LEGAL = 15
const ACTOR_WHATSAPP     = 'WhatsApp Bot'
const EVENTO_INICIAL     = 'Reporte Recibido — PQR Radicada en Sistema'

// ─── UTILIDADES PRIVADAS ─────────────────────────────────────────────────────
function calcularFechaVencimiento(dias = DIAS_TERMINO_LEGAL) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + dias)
  return fecha
}

function formatearSecuencia(seq) {
  return String(seq).padStart(5, '0')
}

// ─── GENERADOR ATÓMICO DE RADICADO ───────────────────────────────────────────
/**
 * Genera el siguiente número PQR-AAAA-NNNNN de forma atómica.
 * Usa findAndModify con $inc — operación nativa de MongoDB que
 * garantiza unicidad bajo cualquier nivel de concurrencia.
 *
 * @returns {Promise<string>} Ej: "PQR-2026-00042"
 */
export async function generarNumeroPQR() {
  const anio = new Date().getFullYear()
  const clave = `PQR-${anio}`

  const resultado = await prisma.$runCommandRaw({
    findAndModify: 'contadores_secuenciales',
    query:  { clave },
    update: { $inc: { ultimo: 1 } },
    upsert: true,
    new:    true,
  })

  const valorActual = resultado?.value?.ultimo

  if (typeof valorActual !== 'number' || valorActual <= 0) {
    throw new Error(
      `generarNumeroPQR: respuesta inesperada de MongoDB — ${JSON.stringify(resultado)}`
    )
  }

  return `${clave}-${formatearSecuencia(valorActual)}`
}

// ─── CREAR PQR — TRANSACCIÓN COMPLETA ────────────────────────────────────────
/**
 * Crea una PQR garantizando atomicidad con prisma.$transaction:
 *  1. Upsert de UsuarioPQR por teléfono
 *  2. Creación del documento PQR
 *  3. Primer evento en HistorialEstadoPQR ("Reporte Recibido")
 *
 * @param {object} datos
 * @returns {Promise<object>} PQR creada con historial y usuario
 */
export async function crearPQR(datos) {
  if (datos.idLocal) {
    const existente = await prisma.pQR.findFirst({
      where:   { idLocal: String(datos.idLocal) },
      include: { historial: { orderBy: { creadoEn: 'asc' } }, usuarioPqr: true },
    })
    if (existente) {
      console.info(`[PQR] Idempotencia: idLocal=${datos.idLocal} → ${existente.radicado}`)
      return existente
    }
  }

  const radicado         = await generarNumeroPQR()
  const fechaVencimiento = calcularFechaVencimiento()
  const actor            = datos.actor || ACTOR_WHATSAPP
  const idLocal          = String(datos.idLocal || randomUUID())

  const [pqrCreada] = await prisma.$transaction(async (tx) => {
    let usuarioPqrId = null
    if (datos.telefono) {
      const ciudadano = await tx.usuarioPQR.upsert({
        where:  { telefono: datos.telefono },
        update: {
          nombre: datos.usuario,
          ...(datos.email     && { email:     datos.email }),
          ...(datos.cedulaNit && { cedulaNit: datos.cedulaNit }),
          ...(datos.direccion && { direccion: datos.direccion }),
        },
        create: {
          telefono:  datos.telefono,
          nombre:    datos.usuario,
          cedulaNit: datos.cedulaNit ?? null,
          email:     datos.email     ?? null,
          direccion: datos.direccion ?? null,
        },
      })
      usuarioPqrId = ciudadano.id
    }

    const nuevaPqr = await tx.pQR.create({
      data: {
        radicado,
        idLocal,
        usuarioPqrId,
        usuario:     datos.usuario,
        cedulaNit:   datos.cedulaNit   ?? null,
        matricula:   datos.matricula   ?? null,
        telefono:    datos.telefono    ?? null,
        email:       datos.email       ?? null,
        direccion:   datos.direccion   ?? null,
        motivo:      datos.motivo,
        descripcion: datos.descripcion,
        remitente:       datos.remitente || (actor.toLowerCase().includes('whatsapp') || actor.toLowerCase().includes('ia') ? 'IA' : 'OPERADOR'),
        horaInicio:      datos.horaInicio || new Date(Date.now() - 5 * 60 * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
        horaFin:         datos.horaFin || new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }),
        duracionMinutos: datos.duracionMinutos !== undefined ? Number(datos.duracionMinutos) : 5,
        conversacion:    datos.conversacion || null,
        prioridad:       datos.prioridad   ?? 'MEDIA',
        estado:      'ABIERTO',
        fechaVencimiento,
      },
    })

    const historial = await tx.historialEstadoPQR.create({
      data: {
        pqrId:         nuevaPqr.id,
        estadoAntes:   null,
        estadoDespues: 'ABIERTO',
        actor,
        observaciones: EVENTO_INICIAL,
      },
    })

    // Registro opcional de la transcripción que el asistente de IA sostuvo
    // con el ciudadano por WhatsApp (la trae el worker; los radicados
    // manuales no la tienen). Queda como evento de trazabilidad del PQR:
    // el "mensaje" que originó el radicado es consultable después.
    if (Array.isArray(datos.conversacion) && datos.conversacion.length) {
      const transcripcion = datos.conversacion
        .map((turno) => `[${String(turno.de || '?').toUpperCase()}] ${turno.texto}`)
        .join('\n')
        .slice(0, 2400)
      await tx.historialEstadoPQR.create({
        data: {
          pqrId:         nuevaPqr.id,
          estadoAntes:   null,
          estadoDespues: 'ABIERTO',
          actor:         ACTOR_WHATSAPP,
          observaciones: `💬 Conversación con el asistente (transcripción):\n${transcripcion}`,
        },
      })
    }

    return [nuevaPqr, historial]
  })

  return prisma.pQR.findUniqueOrThrow({
    where:   { id: pqrCreada.id },
    include: { historial: { orderBy: { creadoEn: 'asc' } }, usuarioPqr: true },
  })
}

// ─── ACTUALIZAR ESTADO CON AUDITORÍA ─────────────────────────────────────────
/**
 * Cambia el estado de una PQR y deja registro inmutable en el historial.
 * Ambas operaciones son atómicas bajo prisma.$transaction.
 *
 * @param {string} pqrId
 * @param {'EN_TRAMITE'|'RESUELTO'|'ANULADO'} nuevoEstado
 * @param {string} actor
 * @param {string} [observaciones]
 * @returns {Promise<object>}
 */
export async function actualizarEstadoPQR(pqrId, nuevoEstado, actor, observaciones) {
  const ESTADOS_VALIDOS = ['EN_TRAMITE', 'RESUELTO', 'ANULADO']

  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    throw new Error(
      `actualizarEstadoPQR: estado inválido "${nuevoEstado}". Permitidos: ${ESTADOS_VALIDOS.join(', ')}`
    )
  }
  if (!actor?.trim()) {
    throw new Error('actualizarEstadoPQR: "actor" es obligatorio para la auditoría')
  }

  const pqrActual = await prisma.pQR.findUniqueOrThrow({
    where:  { id: pqrId },
    select: { id: true, estado: true, radicado: true },
  })

  if (pqrActual.estado === nuevoEstado) {
    return prisma.pQR.findUniqueOrThrow({
      where:   { id: pqrId },
      include: { historial: { orderBy: { creadoEn: 'asc' } }, usuarioPqr: true },
    })
  }

  const [pqrActualizada] = await prisma.$transaction(async (tx) => {
    const updated = await tx.pQR.update({
      where: { id: pqrId },
      data: {
        estado: nuevoEstado,
        ...(nuevoEstado === 'RESUELTO' && observaciones && {
          respuestaOficial: observaciones,
          fechaRespuesta:   new Date(),
          respondidoPor:    actor,
        }),
      },
    })

    const evento = await tx.historialEstadoPQR.create({
      data: {
        pqrId,
        estadoAntes:   pqrActual.estado,
        estadoDespues: nuevoEstado,
        actor:         actor.trim(),
        observaciones: observaciones ?? null,
      },
    })

    return [updated, evento]
  })

  return prisma.pQR.findUniqueOrThrow({
    where:   { id: pqrActualizada.id },
    include: { historial: { orderBy: { creadoEn: 'asc' } }, usuarioPqr: true },
  })
}

// ─── CONSULTAS ────────────────────────────────────────────────────────────────
export async function listarPQRs(filtros = {}) {
  const where = {}
  if (filtros.estado)    where.estado    = filtros.estado
  if (filtros.matricula) where.matricula = filtros.matricula
  if (filtros.prioridad) where.prioridad = filtros.prioridad
  if (filtros.telefono)  where.telefono  = filtros.telefono

  return prisma.pQR.findMany({
    where,
    orderBy: { fechaRadicado: 'desc' },
    include: { historial: { orderBy: { creadoEn: 'asc' } }, usuarioPqr: true },
  })
}

export async function obtenerPQRPorId(id) {
  return prisma.pQR.findUnique({
    where:   { id },
    include: { historial: { orderBy: { creadoEn: 'asc' } }, usuarioPqr: true },
  })
}

export async function obtenerPQRPorRadicado(radicado) {
  return prisma.pQR.findUnique({
    where:   { radicado },
    include: { historial: { orderBy: { creadoEn: 'asc' } }, usuarioPqr: true },
  })
}

export async function responderPQR(id, { respuestaOficial, respondidoPor, nuevoEstado }) {
  const estado = nuevoEstado || 'RESUELTO'
  const actor  = respondidoPor || 'Atención al Usuario Acuasan'
  return actualizarEstadoPQR(id, estado, actor, respuestaOficial)
}

// ─── ALIAS DE COMPATIBILIDAD — mantiene el contrato del controlador ───────────
export const PqrService = {
  listar:             listarPQRs,
  obtenerPorId:       obtenerPQRPorId,
  obtenerPorRadicado: obtenerPQRPorRadicado,
  crear:              crearPQR,
  responder:          responderPQR,
  actualizarEstado:   actualizarEstadoPQR,
  generarRadicado:    generarNumeroPQR,
}