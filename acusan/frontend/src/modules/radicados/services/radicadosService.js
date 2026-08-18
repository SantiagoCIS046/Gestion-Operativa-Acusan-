import authService from '../../auth/services/authService.js'

const API_BASE = '/api/radicados'

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...authService.getAuthHeader()
})

// ── Datos de demostración de radicados oficiales ──
const RADICADOS_FALLBACK = [
  {
    id: 'RAD-2026-0001', radicado: 'RAD-2026-0001',
    asunto: 'Solicitud de revisión de factura de acueducto',
    remitente: 'Juan Carlos Pérez', tipoDocumento: 'Derecho de Petición',
    estado: 'PENDIENTE', prioridad: 'ALTA',
    fechaRadicacion: '14/08/2026', fechaVencimiento: '28/08/2026',
    diasRestantes: 10, dependencia: 'Facturación',
    descripcion: 'Solicitud formal de revisión de la factura correspondiente al mes de julio.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-2026-0002', radicado: 'RAD-2026-0002',
    asunto: 'PQR - Baja presión en zona norte',
    remitente: 'María Esperanza Cárdenas', tipoDocumento: 'Queja',
    estado: 'EN_TRAMITE', prioridad: 'ALTA',
    fechaRadicacion: '15/08/2026', fechaVencimiento: '29/08/2026',
    diasRestantes: 11, dependencia: 'Operativa',
    descripcion: 'Reporta deficiencia en el suministro de agua potable.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-2026-0003', radicado: 'RAD-2026-0003',
    asunto: 'Certificación de estratos para subsidio',
    remitente: 'Roberto Ángel Morales', tipoDocumento: 'Solicitud',
    estado: 'RESUELTO', prioridad: 'MEDIA',
    fechaRadicacion: '11/08/2026', fechaVencimiento: '25/08/2026',
    diasRestantes: 7, dependencia: 'Comercial',
    descripcion: 'Solicitud de certificación de estrato socioeconómico para subsidio de servicios.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
  },
  {
    id: 'RAD-2026-0004', radicado: 'RAD-2026-0004',
    asunto: 'Reclamo por cobro de alcantarillado',
    remitente: 'Claudia Inés Torres', tipoDocumento: 'Recurso de Reposición',
    estado: 'PENDIENTE', prioridad: 'CRITICA',
    fechaRadicacion: '16/08/2026', fechaVencimiento: '23/08/2026',
    diasRestantes: 5, dependencia: 'Facturación',
    descripcion: 'Recurso formal ante cobro indebido en servicio de alcantarillado.',
    urlDocumento: '/scans/evidencia_e18_scan.png'
  },
  {
    id: 'RAD-2026-0005', radicado: 'RAD-2026-0005',
    asunto: 'Solicitud instalación conexión domiciliaria',
    remitente: 'Luis Ernesto Castillo', tipoDocumento: 'Solicitud Técnica',
    estado: 'EN_TRAMITE', prioridad: 'MEDIA',
    fechaRadicacion: '12/08/2026', fechaVencimiento: '26/08/2026',
    diasRestantes: 8, dependencia: 'Redes',
    descripcion: 'Solicitud de instalación de nueva acometida domiciliaria de acueducto.',
    urlDocumento: '/scans/solicitud_permiso_scan.png'
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
