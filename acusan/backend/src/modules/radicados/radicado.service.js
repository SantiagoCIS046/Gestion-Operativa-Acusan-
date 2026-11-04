// Servicio de radicados: gerencia registra el radicado que llega de otro
// sistema y lo dirige a un área con un encargado y una fecha límite; el área
// responde adjuntando su propio PDF y con eso se cierra el plazo (y sus
// alertas).
//
// Estados: el ALMACENADO es pendiente|respondido (enum EstadoRadicado); el
// visual por plazo se deriva con utils/fechas:
// - Pendiente: sano (>7 días) · por_vencer (0 a 7) · vencido (ya pasó).
// - Respondido: a_tiempo (día de respuesta ≤ día límite) o con_retraso.
//
// Los PDFs viven en Adjuntos detrás de almacenPdf (único dueño de los
// bytes): este servicio solo ve metadatos, siempre sin `contenido`.
// La auditoría del ciclo de vida queda en RadicadoEvento (creado, asignado,
// plazo_cambiado, respondido, reabierto).

import prisma from '../../config/prisma.js'
import { esLiderGeneral, esLiderArea } from '../auth/permisos.js'
import {
  enDias,
  diasHasta,
  diasRestantes,
  estadoRadicado,
  resultadoRespuesta,
  fechaCalendario,
  aCalendarioBogota,
  RADICADO_DIAS_POR_VENCER,
} from '../../utils/fechas.js'
import { enviarNotificacion } from '../alertas/notificaciones.js'
import almacenPdf from '../../services/almacenPdf.js'

export { RADICADO_DIAS_POR_VENCER }

// Traducción dominio ↔ enums de Prisma: los enums usan @map para guardar el
// valor del dominio en BD, pero el cliente de Prisma habla con los nombres
// declarados. La API habla SIEMPRE en dominio (baja|media|alta…).
const PRIORIDAD_PRISMA = { baja: 'BAJA', media: 'MEDIA', alta: 'ALTA' }
const PRIORIDAD_UI = { BAJA: 'baja', MEDIA: 'media', ALTA: 'alta' }
const RESULTADO_PRISMA = { a_tiempo: 'A_TIEMPO', con_retraso: 'CON_RETRASO' }
const RESULTADO_UI = { A_TIEMPO: 'a_tiempo', CON_RETRASO: 'con_retraso' }

// Número automático RAD-<YYYY>-#### consecutivo (patrón del antiguo módulo
// de archivos). El número se guarda CIFRADO, así que el consecutivo vive en
// la colección "contadores" (id radicado-<YYYY>) y se incrementa con $inc,
// que es atómico. La primera vez del año el contador arranca desde el mayor
// consecutivo existente (leído descifrado). Si un número manual ya ocupa el
// siguiente, crear() regenera ante P2002.
export async function mayorConsecutivo(anio, db = prisma) {
  const prefijo = `RAD-${anio}-`
  const todos = await db.radicado.findMany({ select: { numeroRadicado: true } })
  return todos.reduce((m, r) => {
    const n = String(r.numeroRadicado ?? '').toUpperCase()
    return n.startsWith(prefijo) ? Math.max(m, parseInt(n.slice(prefijo.length), 10) || 0) : m
  }, 0)
}

async function generarNumeroRadicado() {
  const anio = fechaCalendario(new Date()).slice(0, 4)
  const id = `radicado-${anio}`
  const existe = await prisma.contador.findUnique({ where: { id } })
  if (!existe) {
    try {
      await prisma.contador.create({ data: { id, valor: await mayorConsecutivo(anio) } })
    } catch (error) {
      if (error?.code !== 'P2002') throw error // otro proceso lo creó primero
    }
  }
  const { valor } = await prisma.contador.update({ where: { id }, data: { valor: { increment: 1 } } })
  return `RAD-${anio}-${String(valor).padStart(4, '0')}`
}

// Fecha corta 'YYYY-MM-DD' (las fechas se guardan a medianoche de Bogotá)
const fechaCorta = (fecha) => new Date(fecha).toISOString().slice(0, 10)

const noAutorizado = () => ({ status: 403, message: 'Tu rol no tiene permiso para esta acción.' })

// Normaliza una fecha entrante ('YYYY-MM-DD' o ISO) a la convención del
// sistema: medianoche de Bogotá del día de calendario correspondiente.
// Una fecha 'YYYY-MM-DD' ya ES un día de calendario y se respeta tal cual
// (convertirla a Date UTC la desplazaría un día por el offset de Bogotá).
function parseFecha(valor, campo) {
  if (!valor) throw { status: 400, message: `La fecha ${campo} es obligatoria.` }
  const texto = String(valor).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return enDias(diasHasta(texto))

  const d = new Date(texto)
  if (Number.isNaN(d.getTime())) {
    throw { status: 400, message: `La fecha ${campo} no es válida.` }
  }
  return enDias(diasHasta(fechaCalendario(d)))
}

// Texto requerido no vacío, recortado y con tope de largo.
function textoRequerido(valor, campo, max) {
  const texto = String(valor ?? '').trim()
  if (!texto) throw { status: 400, message: `${campo} es obligatorio.` }
  if (texto.length > max) throw { status: 400, message: `${campo} no puede superar ${max} caracteres.` }
  return texto
}

// Texto opcional: llega a undefined se ignora; vacío se guarda como null.
function textoOpcional(valor, campo, max) {
  if (valor === undefined) return undefined
  const texto = String(valor ?? '').trim()
  if (texto.length > max) throw { status: 400, message: `${campo} no puede superar ${max} caracteres.` }
  return texto || null
}

/**
 * Estado derivado de un radicado (para la fila y los mensajes).
 * Devuelve { estado, resultado, dias }.
 */
export function estadoDeRadicado(radicado) {
  if (radicado.estado === 'RESPONDIDO') {
    return {
      estado: 'respondido',
      resultado: RESULTADO_UI[radicado.resultadoRespuesta] ?? null,
      dias: diasRestantes(radicado.fechaLimite),
    }
  }
  const dias = diasRestantes(radicado.fechaLimite)
  return { estado: estadoRadicado(radicado.fechaLimite), resultado: null, dias }
}

// ¿El usuario puede VER este radicado? Gerencia ve todo; el resto solo los
// de su área (el areaId sale del token, nunca del query).
export function puedeVerRadicado(usuario, radicado) {
  if (esLiderGeneral(usuario)) return true
  return usuario.areaId === radicado.areaId
}

// ¿El usuario puede responder ESTE radicado? El líder del área responde
// cualquiera de su área; un usuario solo los que tiene asignados.
export function puedeResponderRadicado(usuario, radicado) {
  if (esLiderGeneral(usuario)) return false // la respuesta la envía el área
  if (esLiderArea(usuario)) return usuario.areaId === radicado.areaId
  return usuario.id === radicado.encargadoId
}

// Validación común de encargado: usuario activo del área indicada
async function validarEncargado(areaId, encargadoId) {
  const encargado = await prisma.usuario.findUnique({ where: { id: encargadoId } })
  if (!encargado || !encargado.activo || encargado.areaId !== areaId) {
    throw { status: 400, message: 'El encargado debe ser un usuario activo del área seleccionada.' }
  }
  return encargado
}

// Lectura de adjuntos vigentes SIN contenido (regla del módulo: los bytes
// solo salen por almacenPdf.leer al servir el PDF).
const INCLUYE_ADJUNTOS = {
  adjuntos: {
    where: { vigente: true },
    select: { id: true, tipo: true, nombreOriginal: true, tamano: true, subidoEn: true },
    orderBy: { subidoEn: 'desc' },
  },
}
const INCLUYE_AREA = {
  area: { select: { id: true, codigo: true, nombre: true } },
}

const adjuntoDe = (r, tipoPrisma) => r.adjuntos?.find((a) => a.tipo === tipoPrisma) ?? null
const metaAdjunto = (a) =>
  a ? { id: a.id, nombre: a.nombreOriginal, tamano: a.tamano, subidoEn: a.subidoEn } : null

// Fila del listado: nombres en batch, alerta pendiente y permisos.
// Campos del contrato R2: estado calculado, diasRestantes, resultadoRespuesta,
// tieneRespuesta y puedeResponder (nunca `contenido`).
function mapear(r, { nombrePorId, conAlerta, usuario }) {
  const estado = estadoDeRadicado(r)
  return {
    id: r.id,
    numeroRadicado: r.numeroRadicado,
    asunto: r.asunto,
    descripcion: r.descripcion,
    remitente: r.remitente,
    tipo: r.tipo,
    categoria: r.categoria,
    prioridad: PRIORIDAD_UI[r.prioridad] ?? null,
    fechaRadicacion: r.fechaRadicacion,
    fechaLimite: r.fechaLimite,
    instrucciones: r.instrucciones,
    area: r.area ? { id: r.area.id, codigo: r.area.codigo, nombre: r.area.nombre } : null,
    encargado: { id: r.encargadoId, nombre: nombrePorId.get(r.encargadoId) ?? null },
    estado: estado.estado,
    diasRestantes: estado.dias,
    resultadoRespuesta: estado.resultado,
    tieneRespuesta: r.estado === 'RESPONDIDO',
    adjuntoRadicado: metaAdjunto(adjuntoDe(r, 'RADICADO')),
    adjuntoRespuesta: metaAdjunto(adjuntoDe(r, 'RESPUESTA')),
    respondidoEn: r.respondidoEn,
    respondidoPor: r.respondidoPorId
      ? { id: r.respondidoPorId, nombre: nombrePorId.get(r.respondidoPorId) ?? null }
      : null,
    observacionesRespuesta: r.observacionesRespuesta,
    numeroOficioRespuesta: r.numeroOficioRespuesta,
    alertaPendiente: conAlerta.has(r.id),
    puedeResponder: puedeResponderRadicado(usuario, r),
    puedeEditar: esLiderGeneral(usuario),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// Trae un radicado con área y adjuntos vigentes (sin contenido) y lo
// devuelve como fila de la API.
async function filaDe(id, usuario) {
  const r = await prisma.radicado.findUnique({
    where: { id },
    include: { ...INCLUYE_AREA, ...INCLUYE_ADJUNTOS },
  })
  if (!r) throw { status: 404, message: 'El radicado no existe.' }

  const idsPersonas = [r.encargadoId, r.respondidoPorId].filter(Boolean)
  const personas = idsPersonas.length
    ? await prisma.usuario.findMany({
        where: { id: { in: idsPersonas } },
        select: { id: true, nombre: true },
      })
    : []
  const nombrePorId = new Map(personas.map((p) => [p.id, p.nombre]))

  const pendientes = await prisma.alerta.findMany({
    where: { radicadoId: id, atendida: false },
    select: { id: true },
  })

  return mapear(r, { nombrePorId, conAlerta: new Set(pendientes.length ? [r.id] : []), usuario })
}

// Evento de auditoría (dentro de la transacción de la acción que lo origina)
function evento(tx, radicadoId, tipo, usuarioId, detalle) {
  return tx.radicadoEvento.create({ data: { radicadoId, tipo, usuarioId, detalle } })
}

export const RadicadoService = {
  /**
   * GET /api/radicados?area= — alcance por rol: gerencia ve todos (con
   * filtro opcional de área), líder y usuario solo los de su área.
   * Pendientes primero (límite más urgente arriba), respuestas recientes después.
   */
  async listar(usuario, query = {}) {
    // Área desde el token: un lider_area o usuario que mande otra área en
    // el query queda forzado a la suya; gerencia puede filtrar por área.
    const where = esLiderGeneral(usuario)
      ? query.area
        ? { areaId: query.area }
        : {}
      : { areaId: usuario.areaId }

    // Filtro por categoría (campo absorbido de los antiguos archivos)
    if (query.categoria) where.categoria = String(query.categoria)

    // Estado visual como filtro de BD: sobre el estado ALMACENADO más el
    // rango de fecha límite (ambos campos siempre presentes, el filtro
    // matchea — ojo con el gotcha de nulls en Mongo).
    if (query.estado === 'vencido') {
      where.estado = 'PENDIENTE'
      where.fechaLimite = { lt: enDias(0) }
    } else if (query.estado === 'por_vencer') {
      where.estado = 'PENDIENTE'
      where.fechaLimite = { gte: enDias(0), lte: enDias(RADICADO_DIAS_POR_VENCER) }
    } else if (query.estado === 'sano') {
      where.estado = 'PENDIENTE'
      where.fechaLimite = { gt: enDias(RADICADO_DIAS_POR_VENCER) }
    } else if (query.estado === 'respondido') {
      where.estado = 'RESPONDIDO'
    }

    let radicados = await prisma.radicado.findMany({
      where,
      include: { ...INCLUYE_AREA, ...INCLUYE_ADJUNTOS },
    })

    // Búsqueda libre por número, asunto o remitente (insensible a mayúsculas).
    // Va en JS a propósito: esos campos están cifrados en la base, aquí ya
    // llegan descifrados por la extensión de Prisma.
    if (query.q) {
      const q = String(query.q).trim().toLowerCase()
      if (q) {
        radicados = radicados.filter((r) =>
          [r.numeroRadicado, r.asunto, r.remitente, r.categoria].some((t) =>
            String(t ?? '').toLowerCase().includes(q),
          ),
        )
      }
    }
    const idsPersonas = [
      ...new Set(
        radicados.flatMap((r) => [r.encargadoId, r.respondidoPorId].filter(Boolean)),
      ),
    ]
    const personas = idsPersonas.length
      ? await prisma.usuario.findMany({
          where: { id: { in: idsPersonas } },
          select: { id: true, nombre: true },
        })
      : []
    const nombrePorId = new Map(personas.map((p) => [p.id, p.nombre]))

    // Alertas pendientes de todos los resultados en UNA consulta (sin N+1)
    const ids = radicados.map((r) => r.id)
    const alertasPendientes = ids.length
      ? await prisma.alerta.findMany({
          where: { radicadoId: { in: ids }, atendida: false },
          select: { radicadoId: true },
          distinct: ['radicadoId'],
        })
      : []
    const conAlerta = new Set(alertasPendientes.map((a) => a.radicadoId))

    const filas = radicados.map((r) => mapear(r, { nombrePorId, conAlerta, usuario }))

    // Orden: campo permitido + dir asc|desc. Por defecto, pendientes primero
    // (límite más urgente arriba) y respuestas recientes después.
    const CAMPOS_ORDEN = {
      numero: (f) => String(f.numeroRadicado ?? ''),
      radicacion: (f) => new Date(f.fechaRadicacion ?? 0).getTime(),
      limite: (f) => new Date(f.fechaLimite ?? 0).getTime(),
      dias: (f) => (f.estado === 'respondido' ? Infinity : f.diasRestantes),
      respuesta: (f) => new Date(f.respondidoEn ?? 0).getTime(),
    }
    const campo = CAMPOS_ORDEN[query.orden]
    if (campo) {
      const dir = query.dir === 'desc' ? -1 : 1
      filas.sort((a, b) => {
        const va = campo(a)
        const vb = campo(b)
        return va < vb ? -dir : va > vb ? dir : 0
      })
    } else {
      filas.sort((a, b) => {
        const aPendiente = a.estado !== 'respondido'
        const bPendiente = b.estado !== 'respondido'
        if (aPendiente !== bPendiente) return aPendiente ? -1 : 1
        if (aPendiente) return new Date(a.fechaLimite) - new Date(b.fechaLimite)
        return new Date(b.respondidoEn) - new Date(a.respondidoEn)
      })
    }

    return filas
  },

  /**
   * GET /api/radicados/:id — detalle completo: datos, metadatos de adjuntos
   * (nunca `contenido`), línea de tiempo de eventos y quién respondió.
   */
  async obtener(usuario, id) {
    const r = await prisma.radicado.findUnique({
      where: { id },
      include: { ...INCLUYE_AREA, ...INCLUYE_ADJUNTOS },
    })
    if (!r) throw { status: 404, message: 'El radicado no existe.' }
    if (!puedeVerRadicado(usuario, r)) throw noAutorizado()

    const eventos = await prisma.radicadoEvento.findMany({
      where: { radicadoId: id },
      orderBy: { fecha: 'asc' },
    })

    // Nombres en batch: encargado, respondedor, creador y autores de eventos
    const idsPersonas = [
      ...new Set(
        [r.encargadoId, r.respondidoPorId, r.creadoPorId, ...eventos.map((e) => e.usuarioId)].filter(
          Boolean,
        ),
      ),
    ]
    const personas = idsPersonas.length
      ? await prisma.usuario.findMany({
          where: { id: { in: idsPersonas } },
          select: { id: true, nombre: true },
        })
      : []
    const nombrePorId = new Map(personas.map((p) => [p.id, p.nombre]))

    const pendientes = await prisma.alerta.findMany({
      where: { radicadoId: id, atendida: false },
      select: { id: true },
    })

    const fila = mapear(r, {
      nombrePorId,
      conAlerta: new Set(pendientes.length ? [r.id] : []),
      usuario,
    })

    const TIPO_EVENTO_UI = {
      CREADO: 'creado',
      ASIGNADO: 'asignado',
      PLAZO_CAMBIADO: 'plazo_cambiado',
      RESPONDIDO: 'respondido',
      REABIERTO: 'reabierto',
    }

    return {
      ...fila,
      creadoPor: r.creadoPorId
        ? { id: r.creadoPorId, nombre: nombrePorId.get(r.creadoPorId) ?? null }
        : null,
      adjuntos: r.adjuntos.map((a) => ({
        id: a.id,
        tipo: a.tipo === 'RESPUESTA' ? 'respuesta' : 'radicado',
        nombre: a.nombreOriginal,
        tamano: a.tamano,
        subidoEn: a.subidoEn,
      })),
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: TIPO_EVENTO_UI[e.tipo] ?? e.tipo,
        detalle: e.detalle,
        fecha: e.fecha,
        usuario: e.usuarioId
          ? { id: e.usuarioId, nombre: nombrePorId.get(e.usuarioId) ?? null }
          : null,
      })),
    }
  },

  /**
   * POST /api/radicados (multipart: campos + PDF) — solo lider_general.
   * El PDF del radicado es obligatorio: es el documento que llegó de afuera.
   * numeroRadicado opcional: vacío → RAD-<YYYY>-#### consecutivo.
   */
  async crear(usuario, body, archivoPdf) {
    if (!esLiderGeneral(usuario)) throw noAutorizado()

    const numeroManual = textoOpcional(body.numeroRadicado, 'El número de radicado', 120)
    const asunto = textoRequerido(body.asunto, 'El asunto', 200)
    const descripcion = textoRequerido(body.descripcion, 'La descripción', 2000)
    const remitente = textoRequerido(body.remitente, 'El remitente', 160)
    const tipo = textoRequerido(body.tipo, 'El tipo', 80)
    const categoria = textoOpcional(body.categoria, 'La categoría', 80) ?? 'General'
    const prioridad = PRIORIDAD_PRISMA[body.prioridad]
    if (!prioridad) {
      throw { status: 400, message: 'La prioridad debe ser baja, media o alta.' }
    }

    if (numeroManual) {
      const duplicado = await prisma.radicado.findFirst({ where: { numeroRadicado: numeroManual } })
      if (duplicado) throw { status: 409, message: `El número de radicado ${numeroManual} ya existe.` }
    }

    if (!body.areaId) throw { status: 400, message: 'El área es obligatoria.' }
    const area = await prisma.area.findUnique({ where: { id: body.areaId } })
    if (!area) throw { status: 400, message: 'El área indicada no existe.' }

    if (!body.encargadoId) throw { status: 400, message: 'El encargado es obligatorio.' }
    const encargado = await validarEncargado(area.id, body.encargadoId)

    const fechaRadicacion = parseFecha(body.fechaRadicacion, 'de radicación')
    const fechaLimite = parseFecha(body.fechaLimite, 'límite de respuesta')
    // La límite no puede estar en el pasado ni antes de la radicación
    if (fechaLimite.getTime() < enDias(0).getTime()) {
      throw { status: 400, message: 'La fecha límite no puede ser anterior a hoy.' }
    }
    if (fechaLimite.getTime() < fechaRadicacion.getTime()) {
      throw {
        status: 400,
        message: 'La fecha límite no puede ser anterior a la fecha de radicación.',
      }
    }
    const instrucciones = textoOpcional(body.instrucciones, 'Las instrucciones', 2000)

    // Transacción de alta parametrizada por número (el auto se regenera ante
    // colisión de carrera — P2002 — sin repetir validaciones)
    const crearTx = async (numeroRadicado) => {
      let creado = null
      await prisma.$transaction(async (tx) => {
        const radicado = await tx.radicado.create({
          data: {
            numeroRadicado,
            asunto,
            descripcion,
            remitente,
            tipo,
            categoria,
            prioridad,
            fechaRadicacion,
            fechaLimite,
            // Día civil bogotano de cada fecha (regla de informes: clave de
            // conteo por periodo como texto AAAA-MM-DD)
            diaRadicacion: aCalendarioBogota(fechaRadicacion),
            diaVencimiento: aCalendarioBogota(fechaLimite),
            instrucciones: instrucciones ?? null,
            areaId: area.id,
            encargadoId: encargado.id,
            creadoPorId: usuario.id,
          },
        })
        creado = radicado

        // El PDF original queda como adjunto vigente del radicado
        await almacenPdf.guardar(
          archivoPdf?.buffer,
          {
            radicadoId: radicado.id,
            tipo: 'radicado',
            nombreOriginal: archivoPdf?.originalname,
            subidoPorId: usuario.id,
          },
          tx,
        )

        await evento(tx, radicado.id, 'CREADO', usuario.id, `${numeroRadicado} — ${asunto}`)
        await evento(
          tx,
          radicado.id,
          'ASIGNADO',
          usuario.id,
          `Asignado a ${encargado.nombre} (${area.codigo}); vence el ${fechaCorta(fechaLimite)}.`,
        )

        // Alerta 'nuevo' para el área y su encargado: dentro de la
        // transacción para que sea atómica con el radicado.
        // venceRef = momento del alta (una por asignación).
        await tx.alerta.create({
          data: {
            radicadoId: radicado.id,
            areaId: area.id,
            nivel: 'NUEVO',
            venceRef: new Date(),
            mensaje: `Nuevo radicado ${numeroRadicado} para ${area.codigo}: vence el ${fechaCorta(fechaLimite)}.`,
            enviadaPor: usuario.id,
          },
        })
      })
      return creado
    }

    let radicado
    if (numeroManual) {
      try {
        radicado = await crearTx(numeroManual)
      } catch (error) {
        if (error?.code === 'P2002') {
          throw { status: 409, message: `El número de radicado ${numeroManual} ya existe.` }
        }
        throw error
      }
    } else {
      // Auto: hasta 5 intentos ante colisiones de carrera por el consecutivo
      let pendiente = true
      for (let intento = 0; pendiente && intento < 5; intento++) {
        const numero = await generarNumeroRadicado()
        try {
          radicado = await crearTx(numero)
          pendiente = false
        } catch (error) {
          if (error?.code !== 'P2002' || intento === 4) throw error
        }
      }
    }

    // Notificación de la alerta 'nuevo': la reciben el encargado y el líder
    // del área (hoy enviarNotificacion solo registra en log)
    const liderArea = await prisma.usuario.findFirst({
      where: { areaId: area.id, rol: 'LIDER_AREA', activo: true },
      select: { id: true, nombre: true, email: true, rol: true },
    })
    enviarNotificacion(
      {
        nivel: 'NUEVO',
        mensaje: `Nuevo radicado ${radicado.numeroRadicado} (${area.codigo}): vence el ${fechaCorta(fechaLimite)}.`,
      },
      [
        liderArea,
        { id: encargado.id, nombre: encargado.nombre, email: encargado.email, rol: encargado.rol },
      ].filter(Boolean),
    )

    return filaDe(radicado.id, usuario)
  },

  /**
   * PUT /api/radicados/:id — solo lider_general. Corrige número, datos del
   * radicado, área, encargado o fecha límite. Los cambios relevantes quedan
   * como eventos (asignado / plazo_cambiado). Si la fecha límite cambia, las
   * alertas pendientes se cierran (la próxima revisión genera las que
   * correspondan, igual que renovar un archivo).
   */
  async actualizar(usuario, id, body) {
    if (!esLiderGeneral(usuario)) throw noAutorizado()

    const radicado = await prisma.radicado.findUnique({ where: { id } })
    if (!radicado) throw { status: 404, message: 'El radicado no existe.' }

    const datos = {}

    if (body.numeroRadicado !== undefined) {
      const numeroRadicado = textoRequerido(body.numeroRadicado, 'El número de radicado', 120)
      if (numeroRadicado !== radicado.numeroRadicado) {
        const duplicado = await prisma.radicado.findFirst({ where: { numeroRadicado } })
        if (duplicado && duplicado.id !== id) throw { status: 409, message: `El número de radicado ${numeroRadicado} ya existe.` }
      }
      datos.numeroRadicado = numeroRadicado
    }
    if (body.asunto !== undefined) datos.asunto = textoRequerido(body.asunto, 'El asunto', 200)
    if (body.descripcion !== undefined) {
      datos.descripcion = textoRequerido(body.descripcion, 'La descripción', 2000)
    }
    if (body.remitente !== undefined) datos.remitente = textoRequerido(body.remitente, 'El remitente', 160)
    if (body.tipo !== undefined) datos.tipo = textoRequerido(body.tipo, 'El tipo', 80)
    if (body.categoria !== undefined) {
      datos.categoria = textoOpcional(body.categoria, 'La categoría', 80) ?? 'General'
    }
    if (body.prioridad !== undefined) {
      const prioridad = PRIORIDAD_PRISMA[body.prioridad]
      if (!prioridad) throw { status: 400, message: 'La prioridad debe ser baja, media o alta.' }
      datos.prioridad = prioridad
    }
    if (body.fechaRadicacion !== undefined) {
      datos.fechaRadicacion = parseFecha(body.fechaRadicacion, 'de radicación')
      datos.diaRadicacion = aCalendarioBogota(datos.fechaRadicacion)
    }
    if (body.instrucciones !== undefined) {
      datos.instrucciones = textoOpcional(body.instrucciones, 'Las instrucciones', 2000) ?? null
    }

    if (body.areaId !== undefined) {
      const area = await prisma.area.findUnique({ where: { id: body.areaId } })
      if (!area) throw { status: 400, message: 'El área indicada no existe.' }
      datos.areaId = area.id
    }

    const areaFinal = datos.areaId ?? radicado.areaId
    const encargadoFinal = body.encargadoId ?? radicado.encargadoId
    if (body.encargadoId !== undefined && !body.encargadoId) {
      throw { status: 400, message: 'El encargado es obligatorio.' }
    }
    const encargado = await validarEncargado(areaFinal, encargadoFinal)
    if (body.encargadoId !== undefined) datos.encargadoId = body.encargadoId

    if (body.fechaLimite !== undefined) {
      datos.fechaLimite = parseFecha(body.fechaLimite, 'límite de respuesta')
      datos.diaVencimiento = aCalendarioBogota(datos.fechaLimite)
    }

    // Validaciones de coherencia de fechas sobre los valores FINALES. La
    // comparación con hoy solo aplica cuando la límite cambia (un radicado
    // ya vencido se puede editar en sus otros campos).
    const fechaRadicacionFinal = datos.fechaRadicacion ?? radicado.fechaRadicacion
    const fechaLimiteFinal = datos.fechaLimite ?? radicado.fechaLimite
    if (datos.fechaLimite !== undefined && fechaLimiteFinal.getTime() < enDias(0).getTime()) {
      throw { status: 400, message: 'La fecha límite no puede ser anterior a hoy.' }
    }
    if (
      (datos.fechaLimite !== undefined || datos.fechaRadicacion !== undefined) &&
      fechaLimiteFinal.getTime() < fechaRadicacionFinal.getTime()
    ) {
      throw {
        status: 400,
        message: 'La fecha límite no puede ser anterior a la fecha de radicación.',
      }
    }

    const cambiaAsignacion =
      (datos.areaId !== undefined && datos.areaId !== radicado.areaId) ||
      (datos.encargadoId !== undefined && datos.encargadoId !== radicado.encargadoId)
    const cambiaLimite =
      datos.fechaLimite !== undefined &&
      datos.fechaLimite.getTime() !== radicado.fechaLimite.getTime()
    const areaEvento = await prisma.area.findUnique({
      where: { id: areaFinal },
      select: { codigo: true },
    })

    try {
      await prisma.$transaction(async (tx) => {
        await tx.radicado.update({ where: { id }, data: datos })

        if (cambiaAsignacion) {
          await evento(
            tx,
            id,
            'ASIGNADO',
            usuario.id,
            `Reasignado a ${encargado.nombre} (${areaEvento?.codigo ?? ''}).`,
          )
          // El cambio de área/encargado reinicia el ciclo de alertas: las del
          // destinatario anterior se retiran y la 'nuevo' salta para la nueva
          // área (mismo punto de llamada que al crear).
          await tx.alerta.deleteMany({ where: { radicadoId: id } })
          await tx.alerta.create({
            data: {
              radicadoId: id,
              areaId: areaFinal,
              nivel: 'NUEVO',
              venceRef: new Date(),
              mensaje: `Radicado reasignado a ${areaEvento?.codigo ?? ''} (${encargado.nombre}): vence el ${fechaCorta(datos.fechaLimite ?? radicado.fechaLimite)}.`,
              enviadaPor: usuario.id,
            },
          })
        }
        if (cambiaLimite) {
          await evento(
            tx,
            id,
            'PLAZO_CAMBIADO',
            usuario.id,
            `Plazo: ${fechaCorta(radicado.fechaLimite)} → ${fechaCorta(datos.fechaLimite)}.`,
          )
          // El plazo movió invalida las alertas pendientes: se cierran y la
          // próxima revisión genera las que correspondan al nuevo plazo
          await tx.alerta.updateMany({
            where: { radicadoId: id, atendida: false },
            data: { atendida: true, atendidaPor: usuario.id, atendidaEn: new Date() },
          })
        }
      })
    } catch (error) {
      if (error?.code === 'P2002') {
        throw {
          status: 409,
          message: `El número de radicado ${datos.numeroRadicado} ya existe.`,
        }
      }
      throw error
    }

    return filaDe(id, usuario)
  },

  /**
   * POST /api/radicados/:id/responder (multipart: PDF obligatorio).
   * Responde el líder del área o el encargado asignado (gerencia NO:
   * la respuesta la envía el área). Un radicado ya respondido se rechaza
   * con 409 — para cambiar la respuesta, gerencia lo reabre.
   */
  async responder(usuario, id, archivoPdf, body = {}) {
    const radicado = await prisma.radicado.findUnique({ where: { id } })
    if (!radicado) throw { status: 404, message: 'El radicado no existe.' }
    if (!puedeResponderRadicado(usuario, radicado)) {
      if (esLiderGeneral(usuario)) {
        throw { status: 403, message: 'La respuesta la envía el área encargada del radicado.' }
      }
      throw noAutorizado()
    }
    if (radicado.estado === 'RESPONDIDO') {
      throw {
        status: 409,
        message: 'Este radicado ya tiene respuesta. Pide a gerencia que lo reabra para cambiarla.',
      }
    }

    const observaciones = textoOpcional(body.observacionesRespuesta, 'Las observaciones', 2000)
    const numeroOficio = textoOpcional(body.numeroOficioRespuesta, 'El número de oficio', 120)

    // Resultado por DÍAS de calendario bogotanos (mismo día de la límite = a_tiempo)
    const respondidoEn = new Date()
    const resultado = resultadoRespuesta(respondidoEn, radicado.fechaLimite)

    // El adjunto de respuesta vigente actual (si existe) pasa a histórico
    const anterior = await prisma.adjunto.findFirst({
      where: { radicadoId: id, tipo: 'RESPUESTA', vigente: true },
      select: { id: true },
    })

    await prisma.$transaction(async (tx) => {
      const adjunto = await almacenPdf.guardar(
        archivoPdf?.buffer,
        {
          radicadoId: id,
          tipo: 'respuesta',
          nombreOriginal: archivoPdf?.originalname,
          subidoPorId: usuario.id,
        },
        tx,
      )
      if (anterior) await almacenPdf.marcarHistorico(anterior.id, tx)

      await tx.radicado.update({
        where: { id },
        data: {
          estado: 'RESPONDIDO',
          respondidoEn,
          diaRespuesta: aCalendarioBogota(respondidoEn),
          respondidoPorId: usuario.id,
          resultadoRespuesta: RESULTADO_PRISMA[resultado],
          ...(observaciones !== undefined ? { observacionesRespuesta: observaciones } : {}),
          ...(numeroOficio !== undefined ? { numeroOficioRespuesta: numeroOficio } : {}),
        },
      })

      // Con la respuesta el plazo se cierra: sus alertas pendientes también
      await tx.alerta.updateMany({
        where: { radicadoId: id, atendida: false },
        data: { atendida: true, atendidaPor: usuario.id, atendidaEn: new Date() },
      })

      await evento(
        tx,
        id,
        'RESPONDIDO',
        usuario.id,
        `Respuesta entregada ${resultado === 'a_tiempo' ? 'a tiempo' : 'con retraso'} (${adjunto.nombreOriginal}).`,
      )
    })

    return filaDe(id, usuario)
  },

  /**
   * POST /api/radicados/:id/reabrir { motivo, fechaLimite? } — solo gerencia,
   * motivo obligatorio. Vuelve a pendiente: la respuesta anterior queda
   * histórica (vigente=false), el evento 'reabierto' registra quién y por qué,
   * y las alertas del ciclo anterior se retiran para que la revisión regenere
   * las del ciclo nuevo. Con fechaLimite además renueva el plazo en el mismo
   * paso (antiguo "renovar" de archivos): evento plazo_cambiado incluido.
   */
  async reabrir(usuario, id, body = {}) {
    if (!esLiderGeneral(usuario)) throw noAutorizado()

    const radicado = await prisma.radicado.findUnique({ where: { id } })
    if (!radicado) throw { status: 404, message: 'El radicado no existe.' }
    if (radicado.estado !== 'RESPONDIDO') {
      throw { status: 400, message: 'Solo se pueden reabrir radicados respondidos.' }
    }
    const motivo = textoRequerido(body.motivo, 'El motivo', 500)

    // Renovación de plazo opcional (un paso = reabrir + nueva fecha límite)
    let fechaLimiteNueva = null
    const limiteEntrante = body.fechaLimite
    if (limiteEntrante !== undefined && limiteEntrante !== null && String(limiteEntrante).trim() !== '') {
      fechaLimiteNueva = parseFecha(limiteEntrante, 'límite de respuesta')
      if (fechaLimiteNueva.getTime() < enDias(0).getTime()) {
        throw { status: 400, message: 'La fecha límite no puede ser anterior a hoy.' }
      }
      if (fechaLimiteNueva.getTime() < radicado.fechaRadicacion.getTime()) {
        throw {
          status: 400,
          message: 'La fecha límite no puede ser anterior a la fecha de radicación.',
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.adjunto.updateMany({
        where: { radicadoId: id, tipo: 'RESPUESTA', vigente: true },
        data: { vigente: false },
      })
      await tx.radicado.update({
        where: { id },
        data: {
          estado: 'PENDIENTE',
          respondidoEn: null,
          diaRespuesta: null,
          respondidoPorId: null,
          resultadoRespuesta: null,
          observacionesRespuesta: null,
          numeroOficioRespuesta: null,
          ...(fechaLimiteNueva ? { fechaLimite: fechaLimiteNueva, diaVencimiento: aCalendarioBogota(fechaLimiteNueva) } : {}),
        },
      })
      await tx.alerta.deleteMany({ where: { radicadoId: id } })
      await evento(tx, id, 'REABIERTO', usuario.id, `Reabierto por gerencia: ${motivo}`)
      if (fechaLimiteNueva) {
        await evento(
          tx,
          id,
          'PLAZO_CAMBIADO',
          usuario.id,
          `Plazo: ${fechaCorta(radicado.fechaLimite)} → ${fechaCorta(fechaLimiteNueva)}.`,
        )
      }
    })

    return filaDe(id, usuario)
  },

  /**
   * GET /api/radicados/:id/pdf/radicado y /pdf/respuesta — lo ve cualquier
   * rol con acceso (puedeVerRadicado); de otra área, 403. Sirve el adjunto
   * VIGENTE del tipo pedido (única lectura que trae los bytes).
   */
  async obtenerPdf(usuario, id, tipo = 'radicado') {
    const radicado = await prisma.radicado.findUnique({ where: { id } })
    if (!radicado) throw { status: 404, message: 'El radicado no existe.' }
    if (!puedeVerRadicado(usuario, radicado)) throw noAutorizado()

    const tipoPrisma = tipo === 'respuesta' ? 'RESPUESTA' : 'RADICADO'
    const adjunto = await prisma.adjunto.findFirst({
      where: { radicadoId: id, tipo: tipoPrisma, vigente: true },
      select: { id: true },
    })
    if (!adjunto) {
      throw {
        status: 404,
        message:
          tipo === 'respuesta'
            ? 'Este radicado todavía no tiene respuesta.'
            : 'El PDF del radicado no existe.',
      }
    }

    const doc = await almacenPdf.leer(adjunto.id)
    if (!doc) throw { status: 404, message: 'El PDF no existe.' }
    return { ...doc, numeroRadicado: radicado.numeroRadicado, tipo }
  },

  /**
   * DELETE /api/radicados/:id — solo gerencia. Elimina el radicado con todo
   * lo derivado (adjuntos, eventos, alertas) en una transacción.
   */
  async eliminar(usuario, id) {
    if (!esLiderGeneral(usuario)) throw noAutorizado()

    const radicado = await prisma.radicado.findUnique({
      where: { id },
      select: { id: true, numeroRadicado: true },
    })
    if (!radicado) throw { status: 404, message: 'El radicado no existe.' }

    await prisma.$transaction(async (tx) => {
      await tx.adjunto.deleteMany({ where: { radicadoId: id } })
      await tx.radicadoEvento.deleteMany({ where: { radicadoId: id } })
      await tx.alerta.deleteMany({ where: { radicadoId: id } })
      await tx.radicado.delete({ where: { id } })
    })

    return { id: radicado.id, numeroRadicado: radicado.numeroRadicado }
  },

  /**
   * POST /api/radicados/:id/pdf/radicado (multipart: PDF) — solo gerencia.
   * Reemplaza el PDF original del radicado (el anterior queda histórico,
   * vigente=false). Es el paso posterior a importar por Excel, donde el PDF
   * real no existe y queda un plano de relleno.
   */
  async reemplazarPdfRadicado(usuario, id, archivoPdf) {
    if (!esLiderGeneral(usuario)) throw noAutorizado()

    const radicado = await prisma.radicado.findUnique({ where: { id } })
    if (!radicado) throw { status: 404, message: 'El radicado no existe.' }

    const anterior = await prisma.adjunto.findFirst({
      where: { radicadoId: id, tipo: 'RADICADO', vigente: true },
      select: { id: true },
    })

    await prisma.$transaction(async (tx) => {
      await almacenPdf.guardar(
        archivoPdf?.buffer,
        {
          radicadoId: id,
          tipo: 'radicado',
          nombreOriginal: archivoPdf?.originalname,
          subidoPorId: usuario.id,
        },
        tx,
      )
      if (anterior) await almacenPdf.marcarHistorico(anterior.id, tx)
    })

    return filaDe(id, usuario)
  },
}

export default RadicadoService
