// ÚNICO punto de envío de notificaciones de alertas.
// Hoy solo registra en el log; cuando toque enviar correo real, TODO el cambio
// vive en esta función (nadie más debe enviar notificaciones por su cuenta).

import logger from '../../config/logger.js'

/**
 * @param {object} alerta  - la alerta nueva o reabierta (nivel, mensaje, …)
 * @param {Array}  destinatarios - [{ id, nombre, email }] del área de la alerta
 */
export function enviarNotificacion(alerta, destinatarios) {
  const correos = destinatarios.map((d) => d.email).join(', ')
  logger.info('ALERTAS', 'NOTIFICACIÓN', `${alerta.nivel} · ${alerta.mensaje} → ${correos}`)
  return { canal: 'log', enviados: destinatarios.length }
}
