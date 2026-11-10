// Excel de radicados: export (con hoja Resumen por área), plantilla con
// instrucciones e importación masiva. Absorbido del antiguo módulo de
// archivos en la fusión (2026-10-19) y adaptado al flujo de radicados.
//
// - Número vacío en la importación → se crea con RAD-<YYYY>-#### automático.
// - Número existente → la fila ACTUALIZA ese radicado.
// - Los radicados creados por importación llevan un PDF plano de relleno
//   (utils/pdfPlano): gerencia lo reemplaza por el oficial con
//   POST /:id/pdf/radicado.
// - El área se resuelve por código o nombre; el encargado por email o nombre
//   (siempre dentro del área de la fila).

import ExcelJS from 'exceljs'
import prisma from '../../config/prisma.js'
import { RadicadoService } from './radicado.service.js'
import { enDias, fechaCalendario } from '../../utils/fechas.js'
import { pdfUnaPagina } from '../../utils/pdfPlano.js'

// Texto de comparación: minúsculas y sin tildes (los encabezados del usuario
// pueden venir como "Fecha Radicación" o "fecha radicacion")
const normalizar = (t) =>
  String(t ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Valor plano de una celda (rich text → texto; fórmula → resultado si hay)
const valorCelda = (celda) => {
  if (celda == null) return ''
  if (celda instanceof Date) return celda
  if (celda.text != null) return celda.text
  if (celda.result != null) return celda.result
  return celda
}

// Fecha de celda → 'YYYY-MM-DD' bogotano. Acepta Date real, serial de Excel
// (días desde 1899-12-30) y texto.
const EPOCA_EXCEL = Date.UTC(1899, 11, 30)
function parseFechaExcel(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return fechaCalendario(valor)
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return fechaCalendario(new Date(EPOCA_EXCEL + Math.round(valor) * 86400000))
  }
  const texto = String(valor ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const d = new Date(texto)
  if (!Number.isNaN(d.getTime())) return fechaCalendario(d)
  return null
}

// Columnas de la hoja Radicados (orden del export y de la plantilla)
const COLUMNAS = [
  { header: 'Número', width: 16 },
  { header: 'Asunto', width: 46 },
  { header: 'Descripción', width: 46 },
  { header: 'Categoría', width: 16 },
  { header: 'Área', width: 10 },
  // Correo (o nombre) del encargado de responder, siempre del área de la fila.
  // Vacío al importar = el líder del área.
  { header: 'Encargado', width: 30 },
  { header: 'Tipo', width: 20 },
  { header: 'Remitente', width: 24 },
  { header: 'Prioridad', width: 11 },
  { header: 'Fecha radicación', width: 17 },
  { header: 'Fecha límite', width: 14 },
  { header: 'Instrucciones', width: 36 },
]

// Encabezado con estilo común
function encabezadoEn(hoja) {
  const fila = hoja.getRow(1)
  COLUMNAS.forEach((col, i) => {
    const celda = fila.getCell(i + 1)
    celda.value = col.header
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
    hoja.getColumn(i + 1).width = col.width
  })
}

// Estado semáforo en texto legible (columna del export)
function textoEstado(f) {
  if (f.estado === 'respondido') {
    return f.resultadoRespuesta === 'a_tiempo' ? 'Entregado correctamente' : 'Entregado con retraso'
  }
  if (f.diasRestantes < 0) return 'Vencido'
  if (f.diasRestantes <= 7) return 'Por vencer'
  return 'En tiempo'
}

export const ExcelService = {
  /**
   * GET /api/radicados/export.xlsx — solo gerencia. Hoja Radicados (una fila
   * por radicado, estado semáforo incluido) + hoja Resumen con conteos por
   * área (counts paralelos: el groupBy de Prisma sobre Mongo paniquea el
   * query engine).
   */
  async generarExport(usuario) {
    const filas = await RadicadoService.listar(usuario, {})

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Acuusan'

    const hoja = wb.addWorksheet('Radicados')
    encabezadoEn(hoja)
    filas.forEach((f, i) => {
      const fila = hoja.getRow(i + 2)
      COLUMNAS.forEach((col, j) => {
        let valor = ''
        switch (col.header) {
          case 'Número': valor = f.numeroRadicado; break
          case 'Asunto': valor = f.asunto; break
          case 'Descripción': valor = f.descripcion; break
          case 'Categoría': valor = f.categoria; break
          case 'Área': valor = f.area?.codigo ?? ''; break
          case 'Encargado': valor = f.encargado?.nombre ?? ''; break
          case 'Tipo': valor = f.tipo; break
          case 'Remitente': valor = f.remitente; break
          case 'Prioridad': valor = f.prioridad; break
          case 'Fecha radicación': valor = fechaCalendario(f.fechaRadicacion); break
          case 'Fecha límite': valor = fechaCalendario(f.fechaLimite); break
          case 'Instrucciones': valor = f.instrucciones ?? ''; break
        }
        fila.getCell(j + 1).value = valor ?? ''
      })
      // Columnas de solo-lectura tras las de captura (estado, respuesta…)
      const extra = [
        textoEstado(f),
        f.estado === 'respondido' ? `-${f.diasRestantes}` : String(f.diasRestantes),
        f.respondidoEn ? fechaCalendario(f.respondidoEn) : '',
        f.numeroOficioRespuesta ?? '',
        f.observacionesRespuesta ?? '',
      ]
      extra.forEach((v, j) => {
        const celda = fila.getCell(COLUMNAS.length + 1 + j)
        celda.value = v
        celda.font = { color: { argb: 'FF6B7280' }, italic: true }
      })
    })
    const extraHeaders = ['Estado', 'Días', 'Respondido el', 'N.° oficio', 'Observaciones respuesta']
    extraHeaders.forEach((h, j) => {
      const celda = hoja.getRow(1).getCell(COLUMNAS.length + 1 + j)
      celda.value = h
      celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
      hoja.getColumn(COLUMNAS.length + 1 + j).width = 22
    })

    // ── Hoja Resumen: conteos por área ──
    const resumen = wb.addWorksheet('Resumen')
    // Cortes con la convención del sistema (medianoche de Bogotá = 05:00Z)
    const hoy = enDias(0)
    const fin = enDias(7)
    const areas = await prisma.area.findMany({
      select: { id: true, codigo: true, nombre: true },
      orderBy: { codigo: 'asc' },
    })
    const encab = resumen.getRow(1)
    ;['Área', 'Nombre', 'Total', 'Pendientes', 'Por vencer', 'Vencidos', 'A tiempo', 'Con retraso'].forEach(
      (h, j) => {
        const celda = encab.getCell(j + 1)
        celda.value = h
        celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
      },
    )
    for (const area of areas) {
      const base = { areaId: area.id }
      const [total, pendientes, porVencer, vencidos, aTiempo, conRetraso] = await Promise.all([
        prisma.radicado.count({ where: base }),
        prisma.radicado.count({ where: { ...base, estado: 'PENDIENTE' } }),
        prisma.radicado.count({
          where: { ...base, estado: 'PENDIENTE', fechaLimite: { gte: hoy, lte: fin } },
        }),
        prisma.radicado.count({ where: { ...base, estado: 'PENDIENTE', fechaLimite: { lt: hoy } } }),
        prisma.radicado.count({ where: { ...base, estado: 'RESPONDIDO', resultadoRespuesta: 'A_TIEMPO' } }),
        prisma.radicado.count({ where: { ...base, estado: 'RESPONDIDO', resultadoRespuesta: 'CON_RETRASO' } }),
      ])
      if (!total) continue
      resumen.addRow([area.codigo, area.nombre, total, pendientes, porVencer, vencidos, aTiempo, conRetraso])
    }
    ;[8, 34, 8, 12, 12, 10, 10, 13].forEach((w, j) => {
      resumen.getColumn(j + 1).width = w
    })

    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), nombre: `radicados-${fechaCalendario(new Date())}.xlsx` }
  },

  /**
   * GET /api/radicados/plantilla.xlsx — hoja Instrucciones + hoja Radicados
   * con los encabezados que la importación entiende.
   */
  async generarPlantilla() {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Acuusan'

    const instrucciones = wb.addWorksheet('Instrucciones')
    instrucciones.getColumn(1).width = 110
    ;[
      'Importación de radicados — Acuusan',
      '',
      '1. Diligencia la hoja "Radicados" (una fila por radicado).',
      '2. "Área" acepta el CÓDIGO del área (recomendado) o su nombre exacto.',
      '3. "Encargado" acepta el correo o el nombre del usuario, siempre del área de la fila.',
      '   Vacío = se asigna al líder del área.',
      '4. "Número" vacío = se genera automático (RAD-AÑO-CONSECUTIVO).',
      '5. Un número que ya existe ACTUALIZA ese radicado (no crea otro).',
      '6. "Prioridad" vacía se guarda como media (baja | media | alta).',
      '7. "Fecha radicación" y "Fecha límite" en AAAA-MM-DD (radicación vacía = hoy).',
      '8. "Descripción" y "Remitente" vacíos se guardan como "Sin descripción" y',
      '   "Sin remitente"; el asunto sí es obligatorio en cada fila.',
      '9. Los radicados importados nacen con un PDF de relleno: reemplázalo por el',
      '   oficial en el detalle del radicado (Reemplazar PDF).',
    ].forEach((linea, i) => {
      const celda = instrucciones.getRow(i + 1).getCell(1)
      celda.value = linea
      if (i === 0) celda.font = { bold: true, size: 14 }
    })

    const hoja = wb.addWorksheet('Radicados')
    encabezadoEn(hoja)

    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), nombre: 'plantilla-radicados.xlsx' }
  },

  /**
   * POST /api/radicados/import (xlsx ≤5MB) — solo gerencia. Crea/actualiza
   * por fila a través de RadicadoService (mismas validaciones que la UI) y
   * reporta los errores por fila sin cortar la carga.
   */
  async procesarImportacion(usuario, buffer) {
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(buffer)
    } catch {
      throw { status: 400, message: 'El archivo no es un Excel (.xlsx) válido.' }
    }
    const hoja = wb.getWorksheet('Radicados') ?? wb.worksheets.find((h) => normalizar(h.name) !== 'instrucciones')
    if (!hoja) throw { status: 400, message: 'El archivo no tiene una hoja "Radicados".' }

    // Encabezados → índice de columna (normalizado, tolerante a variantes)
    const columnas = new Map()
    hoja.getRow(1).eachCell((celda, col) => {
      columnas.set(normalizar(valorCelda(celda)), col)
    })
    const col = (...nombres) => {
      for (const n of nombres) {
        if (columnas.has(n)) return columnas.get(n)
      }
      return null
    }
    const COL = {
      numero: col('numero', 'numero de radicado', 'número de radicado'),
      asunto: col('asunto'),
      descripcion: col('descripcion'),
      categoria: col('categoria'),
      area: col('area', 'codigo area', 'área'),
      tipo: col('tipo'),
      remitente: col('remitente'),
      prioridad: col('prioridad'),
      radicacion: col('fecha radicacion', 'fecha de radicacion', 'radicacion'),
      limite: col('fecha limite', 'fecha de limite', 'limite'),
      encargado: col('encargado'),
      instrucciones: col('instrucciones'),
    }

    // Cachés de resolución: áreas todas; usuarios por área bajo demanda
    const areas = await prisma.area.findMany({ select: { id: true, codigo: true, nombre: true } })
    const areaPorTexto = new Map()
    for (const a of areas) {
      areaPorTexto.set(normalizar(a.codigo), a)
      areaPorTexto.set(normalizar(a.nombre), a)
    }
    const usuariosPorArea = new Map()
    const encargadoEn = async (areaId, texto) => {
      if (!usuariosPorArea.has(areaId)) {
        const usuarios = await prisma.usuario.findMany({
          where: { areaId, activo: true },
          select: { id: true, nombre: true, email: true },
        })
        usuariosPorArea.set(areaId, usuarios)
      }
      const buscado = normalizar(texto)
      return (
        usuariosPorArea.get(areaId).find((u) => u.email.toLowerCase() === String(texto).trim().toLowerCase()) ??
        usuariosPorArea.get(areaId).find((u) => normalizar(u.nombre) === buscado) ??
        null
      )
    }

    const lideres = new Map()
    const liderDe = async (areaId) => {
      if (!lideres.has(areaId)) {
        lideres.set(
          areaId,
          await prisma.usuario.findFirst({
            where: { areaId, rol: 'LIDER_AREA', activo: true },
            select: { id: true, nombre: true, email: true },
          }),
        )
      }
      return lideres.get(areaId)
    }

    const texto = (fila, c) => (c == null ? '' : String(valorCelda(fila.getCell(c).value) ?? '').trim())

    const resultado = { total: 0, creados: 0, actualizados: 0, errores: [] }
    const maxFila = hoja.actualRowCount
    for (let n = 2; n <= maxFila; n++) {
      const fila = hoja.getRow(n)
      const numero = texto(fila, COL.numero)
      const asunto = texto(fila, COL.asunto)
      const areaTexto = texto(fila, COL.area)
      if (!numero && !asunto && !areaTexto) continue // fila vacía del todo
      resultado.total++

      const falla = (mensaje) => resultado.errores.push({ fila: n, mensaje })

      try {
        const area = areaPorTexto.get(normalizar(areaTexto))
        if (!area) throw new Error(`Área "${areaTexto}" no reconocida (usa el código).`)

        const encargadoTexto = texto(fila, COL.encargado)
        let encargado = encargadoTexto ? await encargadoEn(area.id, encargadoTexto) : null
        if (encargadoTexto && !encargado) {
          throw new Error(`Encargado "${encargadoTexto}" no encontrado en ${area.codigo}.`)
        }

        const fechaRadicacion = COL.radicacion == null ? '' : parseFechaExcel(valorCelda(fila.getCell(COL.radicacion).value))
        const fechaLimite = COL.limite == null ? null : parseFechaExcel(valorCelda(fila.getCell(COL.limite).value))
        if (!fechaLimite) throw new Error('La fecha límite es obligatoria (AAAA-MM-DD).')

        const prioridadTexto = normalizar(texto(fila, COL.prioridad)) || 'media'
        if (!['baja', 'media', 'alta'].includes(prioridadTexto)) {
          throw new Error('La prioridad debe ser baja, media o alta.')
        }

        const body = {
          asunto,
          // El servicio exige descripción y remitente no vacíos: en Excel es
          // normal dejarlos en blanco, así que caen a un default explícito
          descripcion: texto(fila, COL.descripcion) || 'Sin descripción',
          remitente: texto(fila, COL.remitente) || 'Sin remitente',
          tipo: texto(fila, COL.tipo) || 'General',
          categoria: texto(fila, COL.categoria) || 'General',
          prioridad: prioridadTexto,
          fechaRadicacion: fechaRadicacion || fechaCalendario(new Date()),
          fechaLimite,
          instrucciones: texto(fila, COL.instrucciones) || null,
          areaId: area.id,
          ...(encargado ? { encargadoId: encargado.id } : {}),
        }

        const existente = numero
          ? await prisma.radicado.findFirst({ where: { numeroRadicado: numero }, select: { id: true } })
          : null

        if (existente) {
          await RadicadoService.actualizar(usuario, existente.id, body)
          resultado.actualizados++
        } else {
          // Sin encargado en la fila: responde el líder del área
          if (!encargado) encargado = await liderDe(area.id)
          if (!encargado) {
            throw new Error(`Indica el encargado: ${area.codigo} no tiene un líder de área activo.`)
          }
          // PDF de relleno: el oficial se sube luego desde el detalle
          const placeholder = {
            buffer: pdfUnaPagina(`Radicado ${numero || '(número automático)'}`, [
              'PDF provisional creado por la importación de Excel.',
              `Asunto: ${asunto}`,
              `Área: ${area.codigo} — ${area.nombre}`,
              'Reemplázalo por el documento oficial desde el detalle del radicado.',
            ]),
            originalname: 'radicado-importado.pdf',
          }
          const datos = { ...body, encargadoId: encargado.id, ...(numero ? { numeroRadicado: numero } : {}) }
          await RadicadoService.crear(usuario, datos, placeholder)
          resultado.creados++
        }
      } catch (error) {
        falla(error.message || 'Fila inválida.')
      }
    }

    return resultado
  },
}

export default ExcelService
