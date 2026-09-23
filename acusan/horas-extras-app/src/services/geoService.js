/**
 * ============================================================================
 * GEOLOCALIZACIÓN — ACUASAN E.S.P. (App Horas Extras)
 * ============================================================================
 * Wrapper de una sola posición para adjuntar coordenadas a la foto de
 * evidencia. Devuelve null si el GPS no responde (sin permiso, apagado o
 * timeout): la foto sube igual SIN ubicación — jamás bloquea ni lanza.
 * ============================================================================
 */

const OPCIONES = {
  enableHighAccuracy: true,
  timeout: 8000,
  // Acepta una posición de hasta 30 s para no esperar un GPS frío
  maximumAge: 30000
}

/**
 * Obtiene la posición actual del dispositivo.
 *
 * @returns {Promise<{ latitud: number, longitud: number, precisionGps: number } | null>}
 *          Coordenadas listas para el body del endpoint, o null si no hay GPS.
 */
export const obtenerPosicion = () =>
  new Promise((resolver) => {
    if (!('geolocation' in navigator)) return resolver(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => resolver({
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude,
        precisionGps: pos.coords.accuracy
      }),
      () => resolver(null), // sin permiso, GPS apagado o timeout: foto sin GPS
      OPCIONES
    )
  })

export default { obtenerPosicion }
