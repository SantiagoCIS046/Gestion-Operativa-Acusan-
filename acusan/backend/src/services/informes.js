// Servicio de INFORMES PERIÓDICOS (semanal/mensual) — solo gerencia en los
// endpoints, aunque el cálculo es agnóstico del usuario.
//
// El informe es una FOTO: los números se calculan al momento de guardar y
// no cambian aunque después se renueve, reabra o edite un radicado (hasta
// que se regenere el periodo). El corte de cada periodo es por DÍAS
// HÁBILES (calendarioCO): la semana termina el viernes (o el último hábil
// anterior) y lo que ocurre después entra al periodo siguiente.
//
// Definiciones exactas (sobre radicados — los antiguos archivos):
// - ingresados:        fechaRadicacion dentro del corte [desde, hasta)
// - respondidos:       respondidoEn dentro del corte, dividido a_tiempo /
//                      con_retraso por resultadoRespuesta almacenado
// - cumplimiento:      a_tiempo / respondidos (null si no hubo)
// - diasPromedioRespuesta: días de calendario entre radicación y respuesta
// - al cierre:         pendientes / por vencer / vencidos con la referencia
//                      del último día hábil (o de hoy si el periodo está
//                      en curso → parcial)
// - vencidosEnElPeriodo: radicados cuya fecha límite cayó dentro del corte
//                      y siguen sin respuesta
// - alertas generadas / atendidas dentro del corte.

import prisma from '../config/prisma.js'
import {
  TIPO_SEMANAL,
  TIPO_MENSUAL,
  periodoDe,
  periodoAnterior,
  periodosCerradosPendientes,
  etiquetaPeriodo,
  etiquetaDesdeCampos,
  tipoDia,
  nombreFestivo,
} from '../lib/calendarioCO.js'
import { aCalendarioBogota, diasHasta, medianocheBogotaDe, sumarDiasISO, isoDe, hoyBogota } from '../utils/fechas.js'

const TOPE_PERIODOS_ATRAS = 24
const DIAS_POR_VENCER = 7

const TIPO_PRISMA = { [TIPO_SEMANAL]: 'SEMANAL', [TIPO_MENSUAL]: 'MENSUAL' }
const TIPO_AVISO = { [TIPO_SEMANAL]: 'FIN_SEMANA', [TIPO_MENSUAL]: 'FIN_MES' }

function rangoCorte(p) {
  return { gte: p.desdeInstante, lt: p.hastaInstante }
}

// -------------------------------------------------------------
// CÁLCULO
// alcance: { areaId } filtra todas las cifras a un área y desglosa por
// encargado (informes de líder de área); sin él, la foto es global y se
// desglosa por área.
// -------------------------------------------------------------
export async function calcularInforme(tipo, clave, ahora = new Date(), { areaId } = {}) {
  const p = await periodoDe(tipo, clave)
  const rango = rangoCorte(p)

  // Referencia de la foto "al cierre": el fin del corte si ya terminó;
  // hoy (medianoche Bogotá) si el periodo está en curso (parcial).
  const cerrado = p.hastaInstante.getTime() <= ahora.getTime()
  const refDiaISO = cerrado ? isoDe(p.hastaDia) : hoyBogota(ahora)
  const refInstante = medianocheBogotaDe(refDiaISO)
  const alcance = areaId ? { areaId } : {}
  const cierreBase = { ...alcance, estado: 'PENDIENTE', fechaRadicacion: { lt: refInstante } }

  // NADA de groupBy: el engine de MongoDB se atraganta con él (misma
  // decisión que resumen.service). Todo se cuenta en JS sobre findMany de
  // campos livianos — nunca bytes de PDFs ni contenido.
  const [respondidosFilas, radicacionesFilas, vencidosFilas] = await Promise.all([
    prisma.radicado.findMany({
      where: { ...alcance, estado: 'RESPONDIDO', respondidoEn: rango },
      select: { fechaRadicacion: true, respondidoEn: true, resultadoRespuesta: true, areaId: true, encargadoId: true },
    }),
    prisma.radicado.findMany({ where: { ...alcance, fechaRadicacion: rango }, select: { fechaRadicacion: true, areaId: true, encargadoId: true } }),
    prisma.radicado.findMany({ where: { ...cierreBase, fechaLimite: { lt: refInstante } }, select: { areaId: true, encargadoId: true } }),
  ])

  const ingresados = radicacionesFilas.length
  const aTiempo = respondidosFilas.filter((r) => r.resultadoRespuesta === 'A_TIEMPO').length
  const conRetraso = respondidosFilas.filter((r) => r.resultadoRespuesta === 'CON_RETRASO').length
  const respondidos = aTiempo + conRetraso
  const cumplimiento = respondidos ? aTiempo / respondidos : null
  const diasPromedioRespuesta = respondidos
    ? Math.round((respondidosFilas.reduce((acc, r) => acc + diasHasta(r.respondidoEn, aCalendarioBogota(r.fechaRadicacion)), 0) / respondidos) * 10) / 10
    : null

  // Respondidos en día no hábil dentro del corte (sábado, domingo o
  // festivo/no laboral comprendidos en el rango)
  let respondidosNoHabil = 0
  for (const r of respondidosFilas) {
    if ((await tipoDia(r.respondidoEn)) !== 'habil') respondidosNoHabil++
  }

  const [pendientesAlCierre, porVencerAlCierre, vencidosAlCierre, vencidosEnElPeriodo, alertasGeneradas, alertasAtendidas] = await Promise.all([
    prisma.radicado.count({ where: cierreBase }),
    prisma.radicado.count({ where: { ...cierreBase, fechaLimite: { gte: refInstante, lt: medianocheBogotaDe(sumarDiasISO(refDiaISO, DIAS_POR_VENCER + 1)) } } }),
    prisma.radicado.count({ where: { ...cierreBase, fechaLimite: { lt: refInstante } } }),
    prisma.radicado.count({ where: { ...alcance, estado: 'PENDIENTE', fechaLimite: rango } }),
    // Alerta lleva areaId directo (columna, no relación)
    prisma.alerta.count({ where: { ...alcance, creadaEn: rango } }),
    prisma.alerta.count({ where: { ...alcance, atendida: true, atendidaEn: rango } }),
  ])

  // Desglose: Maps de conteo armados en JS desde las filas livianas de
  // arriba. La clave de grupo es el área en la foto global y el encargado
  // en la foto de área (la columna `alcance` del informe dice cuál es cuál).
  const contar = (filas, campo) => {
    const mapa = new Map()
    for (const f of filas) mapa.set(f[campo], (mapa.get(f[campo]) || 0) + 1)
    return mapa
  }
  const campoGrupo = areaId ? 'encargadoId' : 'areaId'
  const ingPor = contar(radicacionesFilas, campoGrupo)
  const atPor = contar(respondidosFilas.filter((r) => r.resultadoRespuesta === 'A_TIEMPO'), campoGrupo)
  const crPor = contar(respondidosFilas.filter((r) => r.resultadoRespuesta === 'CON_RETRASO'), campoGrupo)
  const venPor = contar(vencidosFilas, campoGrupo)

  // Universo del desglose: todas las áreas (global) o los usuarios del
  // área (líder). Los encargados que aparecen en filas y no están en el
  // universo (inactivos o movidos de área) se agregan para no perder cifras.
  const universo = areaId
    ? await prisma.usuario.findMany({ where: { areaId }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } })
    : await prisma.area.findMany({ select: { id: true, nombre: true, codigo: true }, orderBy: { codigo: 'asc' } })
  const grupos = new Map(universo.map((u) => [u.id, u]))
  for (const id of new Set([...ingPor.keys(), ...atPor.keys(), ...crPor.keys(), ...venPor.keys()])) {
    if (id && !grupos.has(id)) grupos.set(id, { id, nombre: id, codigo: null })
  }
  const porArea = [...grupos.values()].map((u) => {
    const at = atPor.get(u.id) || 0
    const cr = crPor.get(u.id) || 0
    const total = at + cr
    const fila = {
      nombre: u.nombre,
      ingresados: ingPor.get(u.id) || 0,
      respondidos: total, aTiempo: at, conRetraso: cr,
      cumplimiento: total ? at / total : null,
      vencidosAlCierre: venPor.get(u.id) || 0,
    }
    if (areaId) fila.encargadoId = u.id
    else { fila.areaId = u.id; fila.codigo = u.codigo }
    return fila
  })

  // Críticos: hasta 20 pendientes vencidos al cierre, más atrasado primero
  const criticosBase = await prisma.radicado.findMany({
    where: { ...cierreBase, fechaLimite: { lt: refInstante } },
    orderBy: [{ fechaLimite: 'asc' }],
    take: 20,
    select: { numeroRadicado: true, asunto: true, fechaLimite: true, areaId: true, encargadoId: true, area: { select: { codigo: true, nombre: true } } },
  })
  const encargadosIds = [...new Set(criticosBase.map((c) => c.encargadoId).filter(Boolean))]
  const encargados = encargadosIds.length
    ? await prisma.usuario.findMany({ where: { id: { in: encargadosIds } }, select: { id: true, nombre: true } })
    : []
  const nombreEncargado = Object.fromEntries(encargados.map((u) => [u.id, u.nombre]))
  const criticos = criticosBase.map((c) => ({
    numeroRadicado: c.numeroRadicado,
    asunto: c.asunto,
    area: c.area ? `${c.area.codigo} — ${c.area.nombre}` : c.areaId,
    encargado: nombreEncargado[c.encargadoId] ?? c.encargadoId,
    diasAtraso: Math.abs(diasHasta(c.fechaLimite, refDiaISO)),
  }))

  // Por día calendario del corte: tipo de día + ingresados/respondidos
  const ingPorDia = new Map()
  for (const r of radicacionesFilas) {
    const d = aCalendarioBogota(r.fechaRadicacion)
    ingPorDia.set(d, (ingPorDia.get(d) || 0) + 1)
  }
  const resPorDia = new Map()
  for (const r of respondidosFilas) {
    const d = aCalendarioBogota(r.respondidoEn)
    resPorDia.set(d, (resPorDia.get(d) || 0) + 1)
  }
  const porDia = []
  for (let f = isoDe(p.desdeDia); f <= isoDe(p.hastaDia); f = sumarDiasISO(f, 1)) {
    const tipo = await tipoDia(f)
    porDia.push({ fecha: f, tipo, nombreFestivo: tipo === 'habil' ? null : await nombreFestivo(f), ingresados: ingPorDia.get(f) || 0, respondidos: resPorDia.get(f) || 0 })
  }

  return {
    periodoInicio: p.clave,
    periodoFin: p.hastaDia,
    etiqueta: await etiquetaPeriodo(tipo, p.clave),
    // 'global' o el _id del área: dice si porArea desglosa áreas o encargados
    alcance: areaId ?? 'global',
    parcial: !cerrado,
    diasHabiles: p.diasHabiles,
    festivos: p.festivosIncluidos,
    corteDesde: p.desdeInstante,
    corteHasta: p.hastaInstante,
    indicadores: {
      ingresados, respondidos, aTiempo, conRetraso, cumplimiento, diasPromedioRespuesta,
      pendientesAlCierre, porVencerAlCierre, vencidosAlCierre, vencidosEnElPeriodo,
      alertasGeneradas, alertasAtendidas, respondidosNoHabil,
    },
    porArea, criticos, porDia,
  }
}

// -------------------------------------------------------------
// GUARDAR (upsert por tipo+periodoInicio+alcance; idempotente)
// -------------------------------------------------------------
export async function guardarInforme(usuario, tipo, clave, origen = 'AUTOMATICO', { crearAviso = false, areaId } = {}) {
  const tipoPrisma = TIPO_PRISMA[tipo]
  if (!tipoPrisma) throw { status: 400, message: 'El tipo debe ser semanal o mensual.' }

  const calc = await calcularInforme(tipo, clave, new Date(), { areaId })
  const alcance = areaId ?? 'global'
  const datos = {
    periodoInicio: calc.periodoInicio,
    periodoFin: calc.periodoFin,
    etiqueta: calc.etiqueta,
    alcance,
    parcial: calc.parcial,
    diasHabiles: calc.diasHabiles,
    festivos: calc.festivos,
    corteDesde: calc.corteDesde,
    corteHasta: calc.corteHasta,
    porArea: calc.porArea,
    criticos: calc.criticos,
    porDia: calc.porDia,
    ...calc.indicadores,
  }

  const existente = await prisma.informe.findUnique({
    where: { tipo_periodoInicio_alcance: { tipo: tipoPrisma, periodoInicio: calc.periodoInicio, alcance } },
  })

  let informe
  if (existente) {
    // Regenerar: actualiza números y deja regeneradoEn/PorId. NO toca
    // revisadoEn/revisadoPorId (un informe revisado sigue revisado).
    informe = await prisma.informe.update({
      where: { id: existente.id },
      data: { ...datos, regeneradoEn: new Date(), regeneradoPorId: usuario?.id ?? null },
    })
  } else {
    informe = await prisma.informe.create({
      data: {
        tipo: tipoPrisma,
        generadoEn: new Date(),
        generadoPorId: usuario?.id ?? null,
        ...datos,
      },
    })
  }

  // Aviso interno de fin de periodo (uno por informe, único por tipo+
  // periodo). Solo lo dispara la foto GLOBAL: los avisos de cierre son
  // para gerencia, no uno por área.
  if (crearAviso && !areaId) {
    const i = calc.indicadores
    const etiquetaCorta = calc.etiqueta.split(' · ')[0]
    await prisma.avisoInterno.upsert({
      where: { tipo_periodoInicio: { tipo: TIPO_AVISO[tipo], periodoInicio: calc.periodoInicio } },
      update: {},
      create: {
        tipo: TIPO_AVISO[tipo],
        informeId: informe.id,
        periodoInicio: calc.periodoInicio,
        titulo: calc.etiqueta,
        mensaje: `${etiquetaCorta}: ${i.respondidos} respondidos (${i.aTiempo} a tiempo, ${i.conRetraso} con retraso), ${i.vencidosAlCierre} vencidos al cierre`,
      },
    })
  }

  return informe
}

// -------------------------------------------------------------
// SINCRONIZACIÓN (cierre automático, idempotente)
// -------------------------------------------------------------
export async function sincronizarInformes(ahora = new Date()) {
  const primero = await prisma.radicado.findFirst({ orderBy: { fechaRadicacion: 'asc' }, select: { fechaRadicacion: true } })
  const resumen = { informesCreados: 0, informesActualizados: 0, avisosCreados: 0, tipos: {} }
  if (!primero) return resumen

  // La sincronización reconstruye la foto GLOBAL y una por cada área
  // (mismos periodos, alcance distinto).
  const areas = await prisma.area.findMany({ select: { id: true }, orderBy: { codigo: 'asc' } })

  for (const tipo of [TIPO_SEMANAL, TIPO_MENSUAL]) {
    const claves = (await periodosCerradosPendientes(tipo, primero.fechaRadicacion, ahora)).slice(-TOPE_PERIODOS_ATRAS)
    if (!claves.length) continue

    const existentes = await prisma.informe.findMany({
      where: { tipo: TIPO_PRISMA[tipo], periodoInicio: { in: claves } },
      select: { periodoInicio: true, parcial: true, alcance: true },
    })
    // Clave del mapa: alcance|periodo — global y área no se pisan
    const previos = new Map(existentes.map((e) => [`${e.alcance}|${e.periodoInicio.toISOString()}`, e]))

    const antesAvisos = await prisma.avisoInterno.count({ where: { tipo: TIPO_AVISO[tipo] } })
    for (const areaId of [null, ...areas.map((a) => a.id)]) {
      for (const clave of claves) {
        const previo = previos.get(`${areaId ?? 'global'}|${clave.toISOString()}`)
        if (!previo || previo.parcial) {
          // El parcial cuyo periodo ya cerró se reemplaza por el definitivo
          await guardarInforme(null, tipo, clave, 'AUTOMATICO', { crearAviso: !areaId, areaId: areaId ?? undefined })
          if (!previo) resumen.informesCreados++
          else resumen.informesActualizados++
        }
      }
    }
    const despuesAvisos = await prisma.avisoInterno.count({ where: { tipo: TIPO_AVISO[tipo] } })
    resumen.avisosCreados += despuesAvisos - antesAvisos
    resumen.tipos[tipo] = { claves: claves.length, yaHabian: existentes.length }
  }
  return resumen
}

// -------------------------------------------------------------
// SERIE PARA LA GRÁFICA (se calcula al leer, no se guarda)
// -------------------------------------------------------------
// La gráfica NO usa los informes guardados: los periodos de un informe
// cortan por días hábiles (la semana es lun→último hábil), mientras que
// la gráfica organiza por SEMANAS CALENDARIO (lun–dom) reales:
// - granularidad "semanal": cada semana completa (lun–dom) desde la
//   primera radicación hasta la semana en curso (parcial).
// - granularidad "mensual": cada mes partido en sus semanas; la primera
//   puede EMPEZAR a mitad de semana (el día 1 cae entre semana) y la
//   última TERMINAR a mitad de semana (el mes se acaba antes del
//   domingo) — el sistema detecta esos bordes y recorta el rango.
// Los periodos sin respuestas viajan igual: el filtrado de "solo lo que
// tiene información" lo hace la gráfica en el cliente.
const TOPE_MESES_SERIE = 24
const TOPE_SEMANAS_SERIE = 112

const lunesDeISO = (iso) => {
  const diaSemana = new Date(`${iso}T00:00:00.000Z`).getUTCDay() // 0 = domingo
  return sumarDiasISO(iso, -((diaSemana + 6) % 7))
}

export async function serieRespondidos(granularidad = 'semanal', ahora = new Date(), { areaId } = {}) {
  const alcance = areaId ? { areaId } : {}
  const primero = await prisma.radicado.findFirst({ where: alcance, orderBy: { fechaRadicacion: 'asc' }, select: { fechaRadicacion: true } })
  if (!primero) return { granularidad, desde: null, hasta: null, periodos: [] }

  const hoy = hoyBogota(ahora)
  const primerDia = aCalendarioBogota(primero.fechaRadicacion)

  // Conteos por día calendario Bogotá armados en JS (nada de groupBy: el
  // engine de Mongo se atraganta con él — misma decisión que el resto).
  const [respondidosFilas, radicacionesFilas] = await Promise.all([
    prisma.radicado.findMany({
      where: { ...alcance, estado: 'RESPONDIDO', respondidoEn: { not: null } },
      select: { respondidoEn: true, resultadoRespuesta: true },
    }),
    prisma.radicado.findMany({ where: alcance, select: { fechaRadicacion: true } }),
  ])
  const respPorDia = new Map()
  for (const r of respondidosFilas) {
    const d = aCalendarioBogota(r.respondidoEn)
    const e = respPorDia.get(d) || { aTiempo: 0, conRetraso: 0 }
    if (r.resultadoRespuesta === 'A_TIEMPO') e.aTiempo++
    else e.conRetraso++
    respPorDia.set(d, e)
  }
  const radPorDia = new Map()
  for (const f of radicacionesFilas) {
    const d = aCalendarioBogota(f.fechaRadicacion)
    radPorDia.set(d, (radPorDia.get(d) || 0) + 1)
  }

  const contar = (inicio, fin) => {
    let aTiempo = 0
    let conRetraso = 0
    let ingresados = 0
    for (let f = inicio; f <= fin; f = sumarDiasISO(f, 1)) {
      const e = respPorDia.get(f)
      if (e) {
        aTiempo += e.aTiempo
        conRetraso += e.conRetraso
      }
      ingresados += radPorDia.get(f) || 0
    }
    return { aTiempo, conRetraso, ingresados }
  }

  const periodos = []
  if (granularidad === 'mensual') {
    let [a, m] = primerDia.split('-').map(Number)
    const [hastaAnio, hastaMes] = hoy.split('-').map(Number)
    let mesesProcesados = 0
    while ((a < hastaAnio || (a === hastaAnio && m <= hastaMes)) && mesesProcesados++ < TOPE_MESES_SERIE) {
      const dia1 = `${a}-${String(m).padStart(2, '0')}-01`
      const ultimoDia = `${a}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(a, m, 0)).getUTCDate()}`
      let numero = 0
      for (let lunes = lunesDeISO(dia1); lunes <= ultimoDia; lunes = sumarDiasISO(lunes, 7)) {
        if (lunes > hoy) break // slot totalmente futuro: no hay nada que graficar
        numero++
        const inicio = lunes < dia1 ? dia1 : lunes // arranque a mitad de semana
        const domingo = sumarDiasISO(lunes, 6)
        const fin = domingo > ultimoDia ? ultimoDia : domingo // cierre a mitad de semana
        const { aTiempo, conRetraso, ingresados } = contar(inicio, fin)
        periodos.push({
          mes: `${a}-${String(m).padStart(2, '0')}`,
          numero,
          inicio,
          fin,
          aTiempo,
          conRetraso,
          respondidos: aTiempo + conRetraso,
          ingresados,
          parcial: hoy >= inicio && hoy <= fin,
        })
      }
      m++
      if (m > 12) {
        m = 1
        a++
      }
    }
  } else {
    const lunesActual = lunesDeISO(hoy)
    for (let lunes = lunesDeISO(primerDia); lunes <= lunesActual; lunes = sumarDiasISO(lunes, 7)) {
      const fin = sumarDiasISO(lunes, 6)
      const { aTiempo, conRetraso, ingresados } = contar(lunes, fin)
      periodos.push({
        mes: lunes.slice(0, 7),
        numero: null,
        inicio: lunes,
        fin,
        aTiempo,
        conRetraso,
        respondidos: aTiempo + conRetraso,
        ingresados,
        parcial: lunes === lunesActual,
      })
    }
    const visibles = periodos.slice(-TOPE_SEMANAS_SERIE)
    return { granularidad, desde: visibles[0]?.inicio ?? null, hasta: hoy, periodos: visibles }
  }
  return { granularidad, desde: periodos[0]?.inicio ?? null, hasta: hoy, periodos }
}

// Comparación con el periodo anterior del mismo tipo — se calcula al
// leer, nunca se guarda. Diferencias de respondidos, cumplimiento y
// vencidos al cierre.
export async function compararConAnterior(informe) {
  const tipo = informe.tipo === 'SEMANAL' ? TIPO_SEMANAL : TIPO_MENSUAL
  const claveAnterior = await periodoAnterior(tipo, informe.periodoInicio)
  const actual = {
    respondidos: informe.respondidos,
    cumplimiento: informe.cumplimiento,
    vencidosAlCierre: informe.vencidosAlCierre,
  }
  let anterior
  const anteriorGuardado = await prisma.informe.findUnique({
    where: { tipo_periodoInicio_alcance: { tipo: informe.tipo, periodoInicio: claveAnterior, alcance: informe.alcance } },
  })
  if (anteriorGuardado) {
    anterior = {
      // Etiqueta canónica: la guardada puede venir de un formateador viejo
      etiqueta: etiquetaDesdeCampos(
        tipo,
        anteriorGuardado.periodoInicio.toISOString(),
        anteriorGuardado.periodoFin.toISOString(),
        anteriorGuardado.diasHabiles,
      ),
      respondidos: anteriorGuardado.respondidos,
      cumplimiento: anteriorGuardado.cumplimiento,
      vencidosAlCierre: anteriorGuardado.vencidosAlCierre,
    }
  } else {
    const calc = await calcularInforme(tipo, claveAnterior, new Date(), {
      areaId: informe.alcance !== 'global' ? informe.alcance : undefined,
    })
    const i = calc.indicadores
    anterior = { etiqueta: calc.etiqueta, respondidos: i.respondidos, cumplimiento: i.cumplimiento, vencidosAlCierre: i.vencidosAlCierre }
  }
  const puntos = (v) => (v == null ? null : Math.round(v * 1000) / 10)
  return {
    anterior,
    diferencias: {
      respondidos: actual.respondidos - anterior.respondidos,
      cumplimientoPuntos: actual.cumplimiento == null || anterior.cumplimiento == null ? null : puntos(actual.cumplimiento) - puntos(anterior.cumplimiento),
      vencidosAlCierre: actual.vencidosAlCierre - anterior.vencidosAlCierre,
    },
  }
}
