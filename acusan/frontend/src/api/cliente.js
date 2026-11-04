// Cliente HTTP único del frontend.
//
// - Adjunta el JWT del authService a toda petición.
// - Un 401 invalida la sesión y devuelve al login (?sesion=expirada), sea un
//   JWT expirado/revocado o el token falso del fallback offline (que queda
//   inservible en cuanto el backend responde). El login mismo no pasa por aquí.
// - Todo error sale como Error con mensaje en español (el del backend si trae).

import authService from '@/modules/auth/services/authService.js'

const BASE = (import.meta.env.VITE_BACKEND_URL || '') + '/api'

const MENSAJES_ESTADO = {
  400: 'La petición no es válida.',
  401: 'Debe iniciar sesión para continuar.',
  403: 'No tiene permiso para esta acción.',
  404: 'El recurso solicitado no existe.',
  409: 'El registro choca con datos ya existentes.',
  500: 'Error interno del servidor. Intente de nuevo en unos momentos.',
}

async function enviar(ruta, { metodo = 'GET', cuerpo, params, formData, senal } = {}) {
  const token = authService.getToken()
  const url = new URL(BASE + ruta, window.location.origin)
  if (params) {
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        url.searchParams.set(clave, String(valor))
      }
    }
  }

  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'

  let respuesta
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers,
      body: formData ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
      // senal: AbortController.signal — cancela peticiones al desmontar la
      // vista o cambiar de parámetros de la consulta
      ...(senal ? { signal: senal } : {}),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.')
  }

  // Sesión inválida (JWT expirado/revocado o token del fallback offline):
  // se cierra sesión y se vuelve al login con el aviso correspondiente.
  if (respuesta.status === 401 && !ruta.includes('/login')) {
    authService.logout()
    const { default: router } = await import('@/router')
    if (router.currentRoute.value.path !== '/login') {
      router.push({ path: '/login', query: { sesion: 'expirada' } })
    }
    throw new Error('Su sesión no es válida o ha expirado. Ingrese nuevamente.')
  }

  return respuesta
}

async function leerError(respuesta) {
  let mensaje = ''
  try {
    const json = await respuesta.json()
    mensaje = json?.message || ''
  } catch {
    /* respuesta sin cuerpo legible */
  }
  throw new Error(mensaje || MENSAJES_ESTADO[respuesta.status] || `Error inesperado (${respuesta.status}).`)
}

// Lee una respuesta JSON exitosa y devuelve su `data` (o el JSON completo)
async function leerDatos(respuesta) {
  const json = await respuesta.json()
  if (json?.success === false) {
    throw new Error(json.message || 'La operación no pudo completarse.')
  }
  return json?.data !== undefined ? json.data : json
}

export const cliente = {
  async get(ruta, params, { senal } = {}) {
    const respuesta = await enviar(ruta, { params, senal })
    if (!respuesta.ok) await leerError(respuesta)
    return leerDatos(respuesta)
  },

  async post(ruta, cuerpo, opciones = {}) {
    const respuesta = await enviar(ruta, { metodo: 'POST', cuerpo, ...opciones })
    if (!respuesta.ok) await leerError(respuesta)
    return leerDatos(respuesta)
  },

  async put(ruta, cuerpo) {
    const respuesta = await enviar(ruta, { metodo: 'PUT', cuerpo })
    if (!respuesta.ok) await leerError(respuesta)
    return leerDatos(respuesta)
  },

  async patch(ruta, cuerpo) {
    const respuesta = await enviar(ruta, { metodo: 'PATCH', cuerpo })
    if (!respuesta.ok) await leerError(respuesta)
    return leerDatos(respuesta)
  },

  async del(ruta) {
    const respuesta = await enviar(ruta, { metodo: 'DELETE' })
    if (!respuesta.ok) await leerError(respuesta)
    return leerDatos(respuesta)
  },

  /** Descarga binaria (.xlsx): devuelve { blob, nombre } listo para guardar */
  async descargar(ruta, params, { senal } = {}) {
    const respuesta = await enviar(ruta, { params, senal })
    if (!respuesta.ok) await leerError(respuesta)
    const disposition = respuesta.headers.get('content-disposition') || ''
    const nombre = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || 'descarga.xlsx'
    return { blob: await respuesta.blob(), nombre }
  },
}

export default cliente
