import authService from '../../auth/services/authService.js'

const API_BASE = '/api/radicados'

export const radicadosService = {
  async obtenerTodos() {
    const res = await fetch(API_BASE, {
      headers: {
        ...authService.getAuthHeader()
      }
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al obtener radicados')
    }
    return data.data
  },

  async crear(datos) {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify(datos)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al crear el radicado')
    }
    return data.data
  },

  async actualizarEstado(id, estado) {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeader()
      },
      body: JSON.stringify({ estado })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al actualizar el estado')
    }
    return data.data
  },

  async extraerPdf(file) {
    const formData = new FormData()
    formData.append('archivoPdf', file)

    const res = await fetch(`${API_BASE}/extraer-pdf`, {
      method: 'POST',
      headers: {
        ...authService.getAuthHeader()
      },
      body: formData
    })
    
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch (e) {
      throw new Error('Respuesta no válida del servidor al procesar el PDF')
    }

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Error al procesar el archivo PDF')
    }
    return data.data
  },


  getDescargarExcelUrl() {
    return `${API_BASE}/descargar-excel`
  }
}

export default radicadosService
