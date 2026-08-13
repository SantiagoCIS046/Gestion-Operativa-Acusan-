/**
 * Permisos API Service
 * Comunicación con el backend de Acuasan Express / Prisma / MongoDB
 */

const API_BASE_URL = '/api/permisos'

export const permisosService = {
  /**
   * Obtiene la lista completa de permisos para el encargado (con formateo para la plantilla Excel)
   */
  async obtenerHistorialPermisos(filtros = {}) {
    try {
      const params = new URLSearchParams()
      if (filtros.estado) params.append('estado', filtros.estado)
      if (filtros.cedula) params.append('cedula', filtros.cedula)
      if (filtros.tipo) params.append('tipo', filtros.tipo)

      const url = params.toString() ? `${API_BASE_URL}/encargado?${params.toString()}` : `${API_BASE_URL}/encargado`
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!res.ok) {
        throw new Error(`Error en el servidor (${res.status}): ${res.statusText}`)
      }

      const data = await res.json()
      return data.data || []
    } catch (error) {
      console.error('Error al obtener historial de permisos:', error)
      throw error
    }
  },

  /**
   * Radica un nuevo permiso extraído vía OCR o diligenciado por el encargado
   */
  async crearPermiso(datos) {
    try {
      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Error al radicar el permiso (${res.status})`)
      }

      return data.data
    } catch (error) {
      console.error('Error al crear permiso en el backend:', error)
      throw error
    }
  },

  /**
   * Obtiene el detalle de un permiso por su ID
   */
  async obtenerPermisoPorId(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo obtener el permiso')
      }

      return data.data
    } catch (error) {
      console.error('Error al obtener permiso por ID:', error)
      throw error
    }
  },

  /**
   * Dictamen de Gerencia (Aprobado / Rechazado)
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}/dictamen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, aprobadoPor, observaciones })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'No se pudo actualizar el estado del permiso')
      }

      return data.data
    } catch (error) {
      console.error('Error al dictaminar permiso:', error)
      throw error
    }
  }
}

export default permisosService
