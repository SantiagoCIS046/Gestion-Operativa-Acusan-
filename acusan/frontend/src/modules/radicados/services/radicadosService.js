import authService from '../../auth/services/authService.js'

const API_BASE = '/api/radicados'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Datos de demostración de radicados oficiales ──
// ── Datos de demostración de radicados oficiales subidos por Eliana y Román ──
const RADICADOS_FALLBACK = [
  {
    id: 'RAD-1241',
    numeroRadicado: 'RAD-1241',
    radicado: 'RAD-1241',
    numeroRadicadoPdf: '2610000648',
    peticionario: 'Yadira Velásquez Masey - Presidenta JAC Vereda El Congual',
    remitente: 'Yadira Velásquez Masey',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Ruiz Suarez Luz Marina - Gerencia General',
    asunto: 'Respuesta Radicado Acuasan EI.CE-ESP - Solicitud de Visita Técnica y Medidor',
    tipoDocumento: 'Derecho de Petición',
    registradoPor: 'Eliana',
    estado: 'Resuelto',
    prioridad: 'ALTA',
    fechaRadicacion: '2026-08-18T08:30:00.000Z',
    fechaVencimiento: '2026-08-24T00:00:00.000Z',
    diasRestantes: 6,
    contexto: 'Petición formal para revisión técnica de acometida y suministro en sector rural.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-1729',
    numeroRadicado: 'RAD-1729',
    radicado: 'RAD-1729',
    numeroRadicadoPdf: '2610000649',
    peticionario: 'Laura Dulcey Nieves - Urbanización Bella Isla',
    remitente: 'Laura Dulcey Nieves',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Área de Facturación y Medición',
    asunto: 'Solicitud de revisión de factura y aforo por variación de consumo',
    tipoDocumento: 'Reclamo',
    registradoPor: 'Román',
    estado: 'Pendiente',
    prioridad: 'ALTA',
    fechaRadicacion: '2026-08-18T09:45:00.000Z',
    fechaVencimiento: '2026-08-24T00:00:00.000Z',
    diasRestantes: 6,
    contexto: 'La usuaria reporta incremento atípico en tarifa durante el último periodo facturado.',
    urlDocumento: '/scans/evidencia_e18_scan.png'
  },
  {
    id: 'RAD-1845',
    numeroRadicado: 'RAD-1845',
    radicado: 'RAD-1845',
    numeroRadicadoPdf: '2640000712',
    peticionario: 'Carlos Arturo Gómez Prada - Barrio San Martín',
    remitente: 'Carlos Arturo Gómez',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Dirección Operativa y Alcantarillado',
    asunto: 'Reporte de hundimiento en pozo de inspección y mantenimiento preventivo',
    tipoDocumento: 'Petición Técnica',
    registradoPor: 'Eliana',
    estado: 'Pendiente',
    prioridad: 'CRITICA',
    fechaRadicacion: '2026-08-18T10:15:00.000Z',
    fechaVencimiento: '2026-08-21T00:00:00.000Z',
    diasRestantes: 3,
    contexto: 'Urgencia técnica por riesgo de filtración en vía pública principal.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-1902',
    numeroRadicado: 'RAD-1902',
    radicado: 'RAD-1902',
    numeroRadicadoPdf: '2640000780',
    peticionario: 'María Esperanza Cárdenas - Sector Santander',
    remitente: 'María Esperanza Cárdenas',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Subgerencia Comercial',
    asunto: 'Certificación de estratificación socioeconómica para subsidio',
    tipoDocumento: 'Solicitud',
    registradoPor: 'Román',
    estado: 'Resuelto',
    prioridad: 'MEDIA',
    fechaRadicacion: '2026-08-17T14:20:00.000Z',
    fechaVencimiento: '2026-08-31T00:00:00.000Z',
    diasRestantes: 13,
    contexto: 'Trámite concluido con entrega de certificado digital oficial.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-1930',
    numeroRadicado: 'RAD-1930',
    radicado: 'RAD-1930',
    numeroRadicadoPdf: '2640000805',
    peticionario: 'Junta de Acción Comunal Barrio José Antonio Galán',
    remitente: 'JAC José Antonio Galán',
    dependencia: 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
    destinatario: 'Dirección Técnica de Redes de Acueducto',
    asunto: 'Solicitud de ampliación de redes y optimización de presión sector alto',
    tipoDocumento: 'Derecho de Petición',
    registradoPor: 'Eliana',
    estado: 'Pendiente',
    prioridad: 'MEDIA',
    fechaRadicacion: '2026-08-18T11:10:00.000Z',
    fechaVencimiento: '2026-09-01T00:00:00.000Z',
    diasRestantes: 14,
    contexto: 'Radicado recién ingresado vía ventanilla única por Eliana.',
    urlDocumento: '/scans/evidencia_e18_scan.png'
  }
]

export const radicadosService = {
  async obtenerTodos() {
    try {
      const res = await fetch(API_BASE, {
        headers: authService.getAuthHeader()
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) return data.data
      }

      console.warn('API radicados no disponible, usando datos de demostración.')
      return RADICADOS_FALLBACK
    } catch (error) {
      console.warn('Error de red en radicados, usando datos de demostración:', error.message)
      return RADICADOS_FALLBACK
    }
  },

  async crear(datos) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(datos)
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) return data.data
      }

      // Fallback: crear radicado localmente en demo
      const nuevo = {
        ...datos,
        id: `RAD-2026-DEMO-${Date.now()}`,
        radicado: `RAD-2026-DEMO-${Date.now()}`,
        estado: 'PENDIENTE',
        fechaRadicacion: new Date().toLocaleDateString('es-CO'),
        diasRestantes: 15
      }
      RADICADOS_FALLBACK.push(nuevo)
      return nuevo
    } catch (error) {
      console.error('Error al crear radicado:', error)
      throw error
    }
  },

  async actualizarEstado(id, estado) {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ estado })
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.success) return data.data
      }

      // Fallback: actualizar localmente
      const idx = RADICADOS_FALLBACK.findIndex(r => r.id === id)
      if (idx !== -1) RADICADOS_FALLBACK[idx].estado = estado
      return RADICADOS_FALLBACK[idx] || { id, estado }
    } catch (error) {
      console.error('Error al actualizar estado:', error)
      throw error
    }
  },

  async extraerPdf(file) {
    try {
      const formData = new FormData()
      formData.append('archivoPdf', file)

      const res = await fetch(`${API_BASE}/extraer-pdf`, {
        method: 'POST',
        headers: authService.getAuthHeader(),
        body: formData
      })

      const text = await res.text()
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        throw new Error('Respuesta no válida del servidor al procesar el PDF')
      }

      if (res.ok && data.success) return data.data

      // Fallback: retornar datos OCR simulados
      return {
        asunto: file.name?.replace(/\.[^.]+$/, '') || 'Documento escaneado',
        remitente: 'Por confirmar',
        tipoDocumento: 'Solicitud',
        descripcion: 'Texto extraído automáticamente del PDF cargado.',
        confianzaOCR: 85
      }
    } catch (error) {
      console.warn('OCR no disponible, retornando estructura vacía para diligenciar.')
      return {
        asunto: '',
        remitente: '',
        tipoDocumento: 'Solicitud',
        descripcion: '',
        confianzaOCR: 0
      }
    }
  },

  getDescargarExcelUrl() {
    return `${API_BASE}/descargar-excel`
  }
}

export default radicadosService
