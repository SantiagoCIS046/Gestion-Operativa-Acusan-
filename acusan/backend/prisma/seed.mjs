// Seed del módulo unificado de RADICADOS — correr con `npm run db:seed`
// (raíz acusan/). Fusión de módulos 2026-10-19: ya no hay archivos, solo
// radicados con categoría.
//
// ⚠️ DESTRUCTIVO: limpia las colecciones del sistema (alertas, ejecuciones,
// adjuntos, eventos, radicados, registros_acceso, usuarios, areas) y crea
// datos de ejemplo. Los usuarios del login pasan a ser EXCLUSIVAMENTE los
// creados aquí. También retira la colección legacy "archivos" de la era
// anterior si todavía existe.
//
// Datos: 1 área líder + 4 áreas · 1 líder general · 1 líder por área ·
// 2 usuarios por área · ~36 radicados (sanos / por vencer / vencidos /
// respondidos a tiempo y con retraso) con PDFs de una página generados en
// código y su auditoría de eventos.
// Las alertas NO se siembran: las genera el motor de alertas en cada corrida.
//
// Las fechas siempre cuelgan de HOY en Bogotá para que la mezcla de estados
// se mantenga en el tiempo. Los sanos con radicación lejana (−40..−60 días)
// existen para que el motor unificado tenga plazos totales largos (D30/D15).

import 'dotenv/config'
import bcrypt from 'bcryptjs'
// Cliente CON cifrado: los radicados, PDFs, alertas y eventos sembrados
// quedan cifrados igual que los que crea la aplicación (exige
// CLAVE_MAESTRA_DATOS en backend/.env).
import prisma from '../src/config/prisma.js'
import { verificarClaves } from '../src/lib/cifrado.js'

import { enDias, estadoRadicado, resultadoRespuesta, fechaCalendario } from '../src/utils/fechas.js'
import { pdfUnaPagina } from '../src/utils/pdfPlano.js'


// Contraseña inicial compartida por todos los usuarios del seed
const PASSWORD_INICIAL = 'acuasan2026'

// ── Áreas ─────────────────────────────────────────────────────────────────────
// parentId: null = área líder (raíz de la jerarquía)
const AREA_LIDER = { nombre: 'Gerencia General', codigo: 'GER' }
const AREAS_OPERATIVAS = [
  { nombre: 'Producción y Operación', codigo: 'OPE' },
  { nombre: 'Comercial y Facturación', codigo: 'COM' },
  { nombre: 'Administrativa y Financiera', codigo: 'ADM' },
  { nombre: 'Jurídica y Control', codigo: 'JUR' },
]

// ── Usuarios ──────────────────────────────────────────────────────────────────
// Emails institucionales @acuasan.com (convención del proyecto: UNA sola u).
const LIDER_GENERAL = {
  nombre: 'Sandra Milena Gómez',
  email: 'gerencia@acuasan.com',
}

const EQUIPO = [
  {
    codigo: 'OPE',
    lider: { nombre: 'Carlos Andrés Peña', email: 'lider.operativo@acuasan.com' },
    usuarios: [
      { nombre: 'Juan David Valdez', email: 'juan.valdez@acuasan.com' },
      { nombre: 'Laura Martínez Rincón', email: 'laura.martinez@acuasan.com' },
    ],
  },
  {
    codigo: 'COM',
    lider: { nombre: 'Diana Patricia Ruiz', email: 'lider.comercial@acuasan.com' },
    usuarios: [
      { nombre: 'Andrea Sánchez Pinto', email: 'andrea.sanchez@acuasan.com' },
      { nombre: 'Felipe Torres Ochoa', email: 'felipe.torres@acuasan.com' },
    ],
  },
  {
    codigo: 'ADM',
    lider: { nombre: 'Óscar Javier Muñoz', email: 'lider.administrativo@acuasan.com' },
    usuarios: [
      { nombre: 'Catalina Ríos Bermúdez', email: 'catalina.rios@acuasan.com' },
      { nombre: 'Diego Herrera Salas', email: 'diego.herrera@acuasan.com' },
    ],
  },
  {
    codigo: 'JUR',
    lider: { nombre: 'Paola Andrea Castro', email: 'lider.juridico@acuasan.com' },
    usuarios: [
      { nombre: 'Miguel Rojas Cárdenas', email: 'miguel.rojas@acuasan.com' },
      { nombre: 'Sara Linero Pardo', email: 'sara.linero@acuasan.com' },
    ],
  },
]

// ── Radicados de ejemplo ──────────────────────────────────────────────────────
// diasLimite/diasRespuesta: días respecto a HOY (Bogotá). Estado visual según
// fechaLimite; los respondidos llevan PDF de respuesta y evento RESPONDIDO.
// Mezcla: 12 sanos (algunos de radicación lejana → plazos D30/D15) ·
// 9 por vencer (≤1 · 2-3 · 4-7) · 7 vencidos · 8 respondidos (4+4).
const RADICADOS_SEED = [
  // ── Sanos lejanos (radicación −40..−60: plazos totales largos para D30/D15)
  { codigo: 'OPE', encargado: 1, asunto: 'Plan de mantenimiento anual de plantas',
    descripcion: 'Revisión del plan de mantenimiento preventivo del próximo año.',
    remitente: 'Superintendencia de Servicios Públicos', tipo: 'Requerimiento', categoria: 'Infraestructura',
    prioridad: 'MEDIA', diasRadicacion: -48, diasLimite: 42 },
  { codigo: 'COM', encargado: 2, asunto: 'Informe de suscriptores nuevos por localidad',
    descripcion: 'Consolidado de conexiones nuevas del último trimestre.',
    remitente: 'Alcaldía Municipal', tipo: 'Oficio', categoria: 'Facturación',
    prioridad: 'BAJA', diasRadicacion: -55, diasLimite: 35 },
  { codigo: 'ADM', encargado: 1, asunto: 'Presupuesto de inversión del próximo año',
    descripcion: 'Proyección de gastos de operación e inversión para aprobación.',
    remitente: 'Junta Directiva', tipo: 'Oficio', categoria: 'General',
    prioridad: 'MEDIA', diasRadicacion: -40, diasLimite: 50 },
  { codigo: 'JUR', encargado: 2, asunto: 'Concepto sobre reforma normativa de vertimientos',
    descripcion: 'Análisis jurídico del proyecto de resolución regional.',
    remitente: 'Corporación Autónoma Regional', tipo: 'Consulta', categoria: 'Ambiental',
    prioridad: 'BAJA', diasRadicacion: -60, diasLimite: 30 },
  // ── Sanos medianos (límite 10..30: entran a la ventana del motor)
  { codigo: 'OPE', encargado: 2, asunto: 'Certificado de disponibilidad de caudal',
    descripcion: 'Certificación de caudal captado en la bocatoma principal.',
    remitente: 'Corporación Autónoma Regional', tipo: 'Requerimiento', categoria: 'Ambiental',
    prioridad: 'MEDIA', diasRadicacion: -45, diasLimite: 25 },
  { codigo: 'COM', encargado: 1, asunto: 'Revisión de estratificación de predios nuevos',
    descripcion: 'Verificación de estratos asignados en urbanizaciones recientes.',
    remitente: 'Planeación Municipal', tipo: 'Oficio', categoria: 'Facturación',
    prioridad: 'MEDIA', diasRadicacion: -50, diasLimite: 18 },
  { codigo: 'ADM', encargado: 2, asunto: 'Aclaración de póliza de cumplimiento',
    descripcion: 'Endoso de la póliza de cumplimiento vigente del contrato de operación.',
    remitente: 'Compañía Aseguradora', tipo: 'Oficio', categoria: 'Contratos',
    prioridad: 'BAJA', diasRadicacion: -42, diasLimite: 14 },
  { codigo: 'JUR', encargado: 1, asunto: 'Respuesta a tutela por corte de servicio',
    descripcion: 'Alegatos de la entidad en proceso de tutela activo.',
    remitente: 'Juzgado Primero Civil Municipal', tipo: 'Oficio judicial', categoria: 'Jurídica',
    prioridad: 'ALTA', diasRadicacion: -35, diasLimite: 11 },
  // ── Sanos cortos (límite 8..12)
  { codigo: 'OPE', encargado: 1, asunto: 'Informe de calidad del agua por sector',
    descripcion: 'Resultados de muestras de la red de distribución por sectores.',
    remitente: 'Secretaría de Salud', tipo: 'Requerimiento', categoria: 'Calidad de agua',
    prioridad: 'MEDIA', diasRadicacion: -8, diasLimite: 9 },
  { codigo: 'COM', encargado: 2, asunto: 'Estado de cuenta consolidado de entidades públicas',
    descripcion: 'Cartera consolidada de entidades del municipio.',
    remitente: 'Tesorería Municipal', tipo: 'Derecho de petición', categoria: 'Facturación',
    prioridad: 'MEDIA', diasRadicacion: -10, diasLimite: 8 },
  { codigo: 'ADM', encargado: 1, asunto: 'Certificación de pagos parafiscales',
    descripcion: 'Certificación de aportes a seguridad social del semestre.',
    remitente: 'Ministerio de Trabajo', tipo: 'Requerimiento', categoria: 'Personal',
    prioridad: 'BAJA', diasRadicacion: -6, diasLimite: 12 },
  { codigo: 'JUR', encargado: 2, asunto: 'Consulta de contratos de suministro de químicos',
    descripcion: 'Copias simples de los contratos de suministro vigentes.',
    remitente: 'Contraloría Municipal', tipo: 'Derecho de petición', categoria: 'Contratos',
    prioridad: 'BAJA', diasRadicacion: -4, diasLimite: 10 },

  // ── Por vencer: vence hoy o mañana (≤1 día)
  { codigo: 'OPE', encargado: 2, asunto: 'Programación de suspensión programada',
    descripcion: 'Publicación de la suspensión por mantenimiento del fin de semana.',
    remitente: 'Personería Municipal', tipo: 'Oficio', categoria: 'Infraestructura',
    prioridad: 'ALTA', diasRadicacion: -9, diasLimite: 1 },
  { codigo: 'COM', encargado: 1, asunto: 'Aclaración de facturación del predio CR-4582',
    descripcion: 'El suscriptor solicita corrección del cargo del último periodo.',
    remitente: 'Juzgado Civil Municipal', tipo: 'Oficio judicial', categoria: 'Facturación',
    prioridad: 'ALTA', diasRadicacion: -11, diasLimite: 0 },
  { codigo: 'JUR', encargado: 1, asunto: 'Requerimiento de antecedentes disciplinarios',
    descripcion: 'Información de procesos disciplinarios de funcionarios.',
    remitente: 'Procuraduría General', tipo: 'Requerimiento', categoria: 'Jurídica',
    prioridad: 'MEDIA', diasRadicacion: -13, diasLimite: 1 },
  // ── Por vencer: 2 a 3 días
  { codigo: 'OPE', encargado: 1, asunto: 'Revisión técnica de la estación de bombeo',
    descripcion: 'Concepto técnico sobre el estado de las bombas de La Esmeralda.',
    remitente: 'Superintendencia de Servicios Públicos', tipo: 'Requerimiento', categoria: 'Infraestructura',
    prioridad: 'ALTA', diasRadicacion: -4, diasLimite: 3 },
  { codigo: 'ADM', encargado: 2, asunto: 'Certificación de nómina del último mes',
    descripcion: 'Certificación de pagos de nómina del mes en curso.',
    remitente: 'Banco de occidente', tipo: 'Oficio', categoria: 'Personal',
    prioridad: 'MEDIA', diasRadicacion: -7, diasLimite: 2 },
  { codigo: 'COM', encargado: 2, asunto: 'Reporte de reclamos del trimestre',
    descripcion: 'Consolidado de PQRS recibidas y su estado de resolución.',
    remitente: 'Superservicios', tipo: 'Requerimiento', categoria: 'General',
    prioridad: 'MEDIA', diasRadicacion: -15, diasLimite: 3 },
  // ── Por vencer: 4 a 7 días
  { codigo: 'OPE', encargado: 2, asunto: 'Muestras de tanques de reserva del norte',
    descripcion: 'Resultados de laboratorio de los tanques del sector norte.',
    remitente: 'Secretaría de Salud', tipo: 'Requerimiento', categoria: 'Calidad de agua',
    prioridad: 'MEDIA', diasRadicacion: -20, diasLimite: 6 },
  { codigo: 'ADM', encargado: 1, asunto: 'Actualización del registro mercantil',
    descripcion: 'Renovación anual del registro mercantil de la entidad.',
    remitente: 'Cámara de Comercio', tipo: 'Oficio', categoria: 'General',
    prioridad: 'BAJA', diasRadicacion: -18, diasLimite: 7 },
  { codigo: 'JUR', encargado: 2, asunto: 'Concepto jurídico de concesión de aguas',
    descripcion: 'Concepto sobre la prórroga de la concesión de aguas superficiales.',
    remitente: 'Corporación Autónoma Regional', tipo: 'Consulta', categoria: 'Ambiental',
    prioridad: 'MEDIA', diasRadicacion: -16, diasLimite: 5 },

  // ── Vencidos pendientes
  { codigo: 'COM', encargado: 1, asunto: 'Requerimiento de cartera del predio ML-1120',
    descripcion: 'Solicitud de estado de cuenta y plan de pagos del inmueble.',
    remitente: 'Juzgado de Pequeñas Causas', tipo: 'Oficio judicial', categoria: 'Facturación',
    prioridad: 'ALTA', diasRadicacion: -20, diasLimite: -2 },
  { codigo: 'OPE', encargado: 1, asunto: 'Inspección de conexión clandestina zona sur',
    descripcion: 'Informe de verificación de conexiones no autorizadas.',
    remitente: 'Personería Municipal', tipo: 'Queja', categoria: 'Infraestructura',
    prioridad: 'MEDIA', diasRadicacion: -25, diasLimite: -5 },
  { codigo: 'ADM', encargado: 2, asunto: 'Certificación de ingresos y retenciones',
    descripcion: 'Certificación para declaración de renta de la entidad.',
    remitente: 'DIAN', tipo: 'Requerimiento', categoria: 'General',
    prioridad: 'MEDIA', diasRadicacion: -30, diasLimite: -8 },
  { codigo: 'JUR', encargado: 1, asunto: 'Respuesta a demanda contractual',
    descripcion: 'Escrito de contestación de demanda de contrato de obra.',
    remitente: 'Juzgado Civil del Circuito', tipo: 'Oficio judicial', categoria: 'Jurídica',
    prioridad: 'ALTA', diasRadicacion: -35, diasLimite: -12 },
  { codigo: 'OPE', encargado: 2, asunto: 'Plan de contingencia por temporada seca',
    descripcion: 'Actualización del protocolo de abastecimiento en sequía.',
    remitente: 'Alcaldía Municipal', tipo: 'Oficio', categoria: 'Ambiental',
    prioridad: 'MEDIA', diasRadicacion: -40, diasLimite: -15 },
  { codigo: 'COM', encargado: 2, asunto: 'Devolución de pagos duplicados',
    descripcion: 'Relación de pagos duplicados a devolver a suscriptores.',
    remitente: 'Superservicios', tipo: 'Queja', categoria: 'Facturación',
    prioridad: 'BAJA', diasRadicacion: -45, diasLimite: -20 },
  { codigo: 'ADM', encargado: 1, asunto: 'Inventario de bienes muebles',
    descripcion: 'Actualización del inventario físico de bienes de la entidad.',
    remitente: 'Contraloría Departamental', tipo: 'Requerimiento', categoria: 'General',
    prioridad: 'BAJA', diasRadicacion: -50, diasLimite: -25 },

  // ── Respondidos a tiempo
  { codigo: 'OPE', encargado: 1, asunto: 'Solicitud de informe de calidad del agua',
    descripcion: 'Requieren el informe de laboratorio del último trimestre para la inspección.',
    remitente: 'Secretaría de Salud', tipo: 'Derecho de petición', categoria: 'Calidad de agua',
    prioridad: 'MEDIA', diasRadicacion: -6, diasLimite: 20, diasRespuesta: -2,
    observacionesRespuesta: 'Informe entregado con certificados de laboratorio originales.',
    numeroOficioRespuesta: 'OF-2026-0152' },
  { codigo: 'COM', encargado: 2, asunto: 'Aclaración de cargo de alumbrado',
    descripcion: 'El suscriptor cuestiona el cobro de alumbrado público.',
    remitente: 'Personería Municipal', tipo: 'Queja', categoria: 'Facturación',
    prioridad: 'MEDIA', diasRadicacion: -10, diasLimite: -2, diasRespuesta: -4,
    observacionesRespuesta: 'Se aclaró el concepto y se aplicó el ajuste en la factura.',
    numeroOficioRespuesta: 'OF-2026-0148' },
  { codigo: 'ADM', encargado: 2, asunto: 'Solicitud de copia de contratos de suministro',
    descripcion: 'Copias simples de los contratos de los últimos dos años.',
    remitente: 'Contraloría Municipal', tipo: 'Derecho de petición', categoria: 'Contratos',
    prioridad: 'BAJA', diasRadicacion: -30, diasLimite: -1, diasRespuesta: -1,
    observacionesRespuesta: 'Copias entregadas en ventanilla el mismo día del requerimiento.' },
  { codigo: 'JUR', encargado: 1, asunto: 'Consulta de normativa de vertimientos',
    descripcion: 'Solicitud de concepto jurídico sobre la resolución vigente.',
    remitente: 'Corporación Autónoma Regional', tipo: 'Consulta', categoria: 'Ambiental',
    prioridad: 'BAJA', diasRadicacion: -2, diasLimite: 45, diasRespuesta: -1,
    observacionesRespuesta: 'Concepto jurídico emitido y notificado por correo certificado.' },
  // ── Respondidos con retraso
  { codigo: 'OPE', encargado: 2, asunto: 'Respuesta a queja por presión de agua',
    descripcion: 'Queja del sector norte por baja presión en horas pico.',
    remitente: 'Personería Municipal', tipo: 'Queja', categoria: 'Infraestructura',
    prioridad: 'MEDIA', diasRadicacion: -10, diasLimite: -2, diasRespuesta: 0,
    observacionesRespuesta: 'Se programó refuerzo de la red para el próximo trimestre.',
    numeroOficioRespuesta: 'OF-2026-0139' },
  { codigo: 'COM', encargado: 1, asunto: 'Requerimiento de cartera morosa del predio ML-1120',
    descripcion: 'Solicitud de estado de cuenta y plan de pagos.',
    remitente: 'Juzgado de Pequeñas Causas', tipo: 'Oficio judicial', categoria: 'Facturación',
    prioridad: 'MEDIA', diasRadicacion: -20, diasLimite: -8, diasRespuesta: -3,
    observacionesRespuesta: 'El estado de cuenta se envió con la aclaración de intereses.' },
  { codigo: 'ADM', encargado: 1, asunto: 'Certificación de aportes a pensión',
    descripcion: 'Certificación de aportes al sistema pensional del último año.',
    remitente: 'Ministerio de Trabajo', tipo: 'Requerimiento', categoria: 'Personal',
    prioridad: 'MEDIA', diasRadicacion: -15, diasLimite: -4, diasRespuesta: -2,
    observacionesRespuesta: 'Certificación emitida fuera del plazo; se pidió disculpa formal.' },
  { codigo: 'JUR', encargado: 2, asunto: 'Alegatos en proceso sancionatorio',
    descripcion: 'Descargos frente a proceso sancionatorio de la autoridad ambiental.',
    remitente: 'Corporación Autónoma Regional', tipo: 'Oficio', categoria: 'Jurídica',
    prioridad: 'ALTA', diasRadicacion: -25, diasLimite: -10, diasRespuesta: -6,
    observacionesRespuesta: 'Descargos radicados extemporáneamente por cambio de apoderado.',
    numeroOficioRespuesta: 'OF-2026-0117' },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no definida: configure backend/.env antes de sembrar.')
  }

  verificarClaves()

  const passwordHash = await bcrypt.hash(PASSWORD_INICIAL, 12)

  // ── 1. Limpieza (orden respeta las relaciones: hojas primero) ──
  const borradas = {
    alertas: await prisma.alerta.deleteMany(),
    adjuntos: await prisma.adjunto.deleteMany(),
    eventos: await prisma.radicadoEvento.deleteMany(),
    radicados: await prisma.radicado.deleteMany(),
    ejecuciones: await prisma.ejecucionAlerta.deleteMany(),
    contadores: await prisma.contador.deleteMany(),
    registros_acceso: await prisma.registroAcceso.deleteMany(),
    usuarios: await prisma.usuario.deleteMany(),
    areas: await prisma.area.deleteMany(),
  }
  console.log(
    `🧹 Limpieza: ${Object.entries(borradas)
      .map(([k, r]) => `${r.count} ${k}`)
      .join(' · ')}`
  )

  // Colección legacy de la era de archivos (fuera del schema desde la
  // fusión): se retira si todavía existe en la base.
  try {
    await prisma.$runCommandRaw({ drop: 'archivos' })
    console.log('🧹 Colección legacy "archivos" retirada.')
  } catch {
    // No existía (o ya fue retirada): nada que hacer.
  }

  // ── 2. Áreas ──
  const areaLider = await prisma.area.create({
    data: { ...AREA_LIDER, parentId: null },
  })
  const areasPorCodigo = {}
  for (const datos of AREAS_OPERATIVAS) {
    areasPorCodigo[datos.codigo] = await prisma.area.create({
      data: { ...datos, parentId: areaLider.id },
    })
  }
  console.log(
    `🏢 Áreas: 1 líder (${areaLider.codigo}) + ${AREAS_OPERATIVAS.length} operativas ` +
      `(${AREAS_OPERATIVAS.map((a) => a.codigo).join(', ')})`
  )

  // ── 3. Usuarios (guardando ids para los responsables) ──
  const usuariosPorCodigo = {} // código de área → [{ id, nombre, email }]
  const gerencia = await prisma.usuario.create({
    data: { ...LIDER_GENERAL, passwordHash, rol: 'LIDER_GENERAL', areaId: areaLider.id, activo: true },
  })
  for (const { codigo, lider, usuarios } of EQUIPO) {
    const area = areasPorCodigo[codigo]
    const creadoLider = await prisma.usuario.create({
      data: { ...lider, passwordHash, rol: 'LIDER_AREA', areaId: area.id, activo: true },
    })
    usuariosPorCodigo[codigo] = [creadoLider]
    for (const u of usuarios) {
      const creado = await prisma.usuario.create({
        data: { ...u, passwordHash, rol: 'USUARIO', areaId: area.id, activo: true },
      })
      usuariosPorCodigo[codigo].push(creado)
    }
  }
  const totalUsuarios = 1 + EQUIPO.length * 3
  console.log(`👥 Usuarios: ${totalUsuarios} (1 líder general · 4 líderes de área · 8 usuarios)`)

  // ── 4. Radicados (con PDFs de una página y su auditoría) ──
  const fechaCorta = (d) => new Date(d).toISOString().slice(0, 10)
  const anio = fechaCalendario(new Date()).slice(0, 4)
  let consecutivoRadicado = 0
  const conteoRadicados = {}
  for (const datos of RADICADOS_SEED) {
    consecutivoRadicado++
    const area = areasPorCodigo[datos.codigo]
    const encargado = usuariosPorCodigo[datos.codigo][datos.encargado]
    const fechaRadicacion = enDias(datos.diasRadicacion)
    const fechaLimite = enDias(datos.diasLimite)
    const respondido = datos.diasRespuesta !== undefined
    const resultado = respondido
      ? resultadoRespuesta(enDias(datos.diasRespuesta), fechaLimite)
      : null

    const radicado = await prisma.radicado.create({
      data: {
        numeroRadicado: `RAD-${anio}-${String(consecutivoRadicado).padStart(4, '0')}`,
        asunto: datos.asunto,
        descripcion: datos.descripcion,
        remitente: datos.remitente,
        tipo: datos.tipo,
        categoria: datos.categoria ?? 'General',
        prioridad: datos.prioridad,
        fechaRadicacion,
        fechaLimite,
        instrucciones: datos.instrucciones ?? null,
        areaId: area.id,
        encargadoId: encargado.id,
        creadoPorId: gerencia.id,
        ...(respondido
          ? {
              estado: 'RESPONDIDO',
              respondidoEn: enDias(datos.diasRespuesta),
              respondidoPorId: encargado.id,
              resultadoRespuesta: resultado === 'a_tiempo' ? 'A_TIEMPO' : 'CON_RETRASO',
              observacionesRespuesta: datos.observacionesRespuesta ?? null,
              numeroOficioRespuesta: datos.numeroOficioRespuesta ?? null,
            }
          : {}),
      },
    })

    // Adjunto del radicado (siempre) y de la respuesta (si la hay)
    const pdfRadicado = pdfUnaPagina(radicado.numeroRadicado, [
      `Asunto: ${datos.asunto}`,
      `Remitente: ${datos.remitente}`,
      `Tipo: ${datos.tipo} · Categoría: ${datos.categoria ?? 'General'}`,
      `Prioridad: ${datos.prioridad.toLowerCase()}`,
      `Fecha de radicación: ${fechaCorta(fechaRadicacion)}`,
      `Fecha límite de respuesta: ${fechaCorta(fechaLimite)}`,
    ])
    await prisma.adjunto.create({
      data: {
        radicadoId: radicado.id,
        tipo: 'RADICADO',
        nombreOriginal: `${radicado.numeroRadicado}.pdf`,
        tamano: pdfRadicado.length,
        contenido: pdfRadicado,
        subidoPorId: gerencia.id,
      },
    })
    if (respondido) {
      const pdfRespuesta = pdfUnaPagina(`Respuesta ${radicado.numeroRadicado}`, [
        `Oficio: ${datos.numeroOficioRespuesta ?? '(sin número)'}`,
        `Respondido por: ${encargado.nombre}`,
        `Fecha de respuesta: ${fechaCorta(enDias(datos.diasRespuesta))}`,
      ])
      await prisma.adjunto.create({
        data: {
          radicadoId: radicado.id,
          tipo: 'RESPUESTA',
          nombreOriginal: `respuesta-${radicado.numeroRadicado}.pdf`,
          tamano: pdfRespuesta.length,
          contenido: pdfRespuesta,
          subidoPorId: encargado.id,
        },
      })
    }

    // Auditoría del ciclo de vida
    await prisma.radicadoEvento.createMany({
      data: [
        {
          radicadoId: radicado.id,
          tipo: 'CREADO',
          usuarioId: gerencia.id,
          detalle: `${radicado.numeroRadicado} — ${datos.asunto}`,
          fecha: fechaRadicacion,
        },
        {
          radicadoId: radicado.id,
          tipo: 'ASIGNADO',
          usuarioId: gerencia.id,
          detalle: `Asignado a ${encargado.nombre} (${datos.codigo}); vence el ${fechaCorta(fechaLimite)}.`,
          fecha: fechaRadicacion,
        },
        ...(respondido
          ? [
              {
                radicadoId: radicado.id,
                tipo: 'RESPONDIDO',
                usuarioId: encargado.id,
                detalle: `Respuesta entregada ${resultado === 'a_tiempo' ? 'a tiempo' : 'con retraso'}.`,
                fecha: enDias(datos.diasRespuesta),
              },
            ]
          : []),
      ],
    })

    const estado = respondido ? 'respondido' : estadoRadicado(fechaLimite)
    conteoRadicados[estado] = (conteoRadicados[estado] || 0) + 1
  }
  // Consecutivo del año: el próximo radicado automático sigue después de estos
  await prisma.contador.create({ data: { id: `radicado-${anio}`, valor: consecutivoRadicado } })
  console.log(`📮 Radicados: ${consecutivoRadicado} (PDFs de una página + auditoría, todo cifrado)`)
  console.log(
    `   Estados: ${Object.entries(conteoRadicados)
      .map(([e, n]) => `${e}=${n}`)
      .join(' · ')}`
  )
  console.log('')
  console.log('✅ Seed terminado.')
  console.log(`   Contraseña para TODOS los usuarios: ${PASSWORD_INICIAL}`)
  console.log('   Ejemplos: gerencia@acuasan.com (líder general)')
  console.log('              lider.operativo@acuasan.com (líder de área OPE)')
}

main()
  .catch((err) => {
    console.error('❌ Seed falló:', err.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
