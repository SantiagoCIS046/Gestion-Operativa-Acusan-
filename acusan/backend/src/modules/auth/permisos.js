// Permisos por rol del módulo de vencimientos.
//
//   lider_general : ve y gestiona TODAS las áreas.
//   lider_area    : ve y gestiona SOLO su área.
//   usuario       : ve SOLO su área; no crea, edita, renueva ni elimina.
//                   SÍ puede registrar recepción (se aplica en el endpoint
//                   correspondiente de archivos, no en puedeGestionar).
//
// `usuario` es el payload normalizado del token: { id, rol, areaId, ... }.

export const ROLES = {
  LIDER_GENERAL: 'LIDER_GENERAL',
  LIDER_AREA: 'LIDER_AREA',
  USUARIO: 'USUARIO',
}

export const esLiderGeneral = (usuario) => usuario?.rol === ROLES.LIDER_GENERAL
export const esLiderArea = (usuario) => usuario?.rol === ROLES.LIDER_AREA

/**
 * ¿Puede el usuario VER el área dada?
 * lider_general ve todas; lider_area y usuario solo la suya.
 */
export function puedeVer(usuario, areaId) {
  if (!usuario?.id || !areaId) return false
  if (esLiderGeneral(usuario)) return true
  return usuario.areaId === areaId
}

/**
 * ¿Puede el usuario GESTIONAR (crear/editar/renovar/eliminar) en el área dada?
 * lider_general gestiona todas; lider_area solo la suya; usuario ninguna.
 */
export function puedeGestionar(usuario, areaId) {
  if (!usuario?.id || !areaId) return false
  if (esLiderGeneral(usuario)) return true
  if (esLiderArea(usuario)) return usuario.areaId === areaId
  return false
}

/**
 * Regla clave del área objetivo en escrituras: el areaId sale del TOKEN,
 * nunca del cuerpo de la petición — salvo para lider_general, que puede
 * fijar cualquier área. Si un lider_area (o usuario) manda otra areaId,
 * queda forzado a la suya.
 */
export function areaEfectiva(usuario, areaIdPedido) {
  if (esLiderGeneral(usuario)) {
    return areaIdPedido || usuario.areaId || null
  }
  return usuario?.areaId || null
}
