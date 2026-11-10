// ÚNICO punto de envío de notificaciones de alertas (nadie más debe enviar
// notificaciones por su cuenta).
//
// Canal: correo (services/correo.js). Sin SMTP configurado, el correo queda
// en el log del servidor y el sistema sigue igual que antes.
//
// Privacidad: el asunto, el remitente y la descripción de un radicado se
// guardan CIFRADOS en la base; por eso los correos solo llevan número de
// radicado, nivel, fecha límite y área — el detalle se consulta en el sistema.

import logger from '../../config/logger.js'
import { enviarCorreo, plantillaCorreo, urlSistema } from '../../services/correo.js'

const NIVEL_LEGIBLE = {
  VENCIDO: 'Vencido',
  NUEVO: 'Nuevo / asignado',
  D1: 'Vence en 1 día',
  D3: 'Vence en 3 días',
  D7: 'Vence en 7 días',
  D15: 'Vence en 15 días',
  D30: 'Vence en 30 días',
}

const conCorreo = (destinatarios) => {
  const vistos = new Set()
  return (destinatarios ?? []).filter((d) => {
    const email = d?.email?.trim().toLowerCase()
    if (!email || vistos.has(email)) return false
    vistos.add(email)
    return true
  })
}

/**
 * Notificación puntual (radicado nuevo o reasignado): un correo a cada
 * destinatario. alerta: { nivel, mensaje } · destinatarios: [{ nombre, email }]
 */
export async function enviarNotificacion(alerta, destinatarios) {
  const lista = conCorreo(destinatarios)
  logger.info('ALERTAS', 'NOTIFICACIÓN', `${alerta.nivel} · ${alerta.mensaje} → ${lista.map((d) => d.email).join(', ')}`)
  const { html, texto } = plantillaCorreo({
    titulo: alerta.nivel === 'NUEVO' ? 'Tienes un radicado por responder' : 'Aviso de radicado',
    parrafos: [alerta.mensaje, 'Ingresa al sistema para ver el detalle y responder antes de la fecha límite.'],
    boton: { texto: 'Abrir radicados', url: `${urlSistema()}/radicados` },
  })
  const resultados = await Promise.all(
    lista.map((d) => enviarCorreo({ para: d.email, asunto: `Acuasan · ${alerta.mensaje}`, html, texto })),
  )
  return { canal: resultados[0]?.canal ?? 'ninguno', enviados: resultados.filter((r) => r.enviado).length }
}

/**
 * Resumen de una revisión de alertas: UN correo por persona con todas sus
 * alertas nuevas o reenviadas (una revisión puede generar decenas).
 * items: [{ alerta: { nivel, mensaje }, destinatarios: [{ nombre, email }] }]
 */
export async function enviarResumenAlertas(items) {
  const porPersona = new Map()
  for (const { alerta, destinatarios } of items) {
    for (const d of conCorreo(destinatarios)) {
      const clave = d.email.toLowerCase()
      if (!porPersona.has(clave)) porPersona.set(clave, { persona: d, alertas: [] })
      porPersona.get(clave).alertas.push(alerta)
    }
  }

  let enviados = 0
  for (const { persona, alertas } of porPersona.values()) {
    const vencidas = alertas.filter((a) => a.nivel === 'VENCIDO').length
    const { html, texto } = plantillaCorreo({
      titulo: vencidas ? `Tienes ${vencidas} radicado(s) vencido(s)` : 'Radicados próximos a vencer',
      parrafos: [
        `Hola ${persona.nombre ?? ''}. La revisión de vencimientos encontró ${alertas.length} aviso(s) para ti:`,
      ],
      tabla: [['Nivel', 'Detalle'], ...alertas.map((a) => [NIVEL_LEGIBLE[a.nivel] ?? a.nivel, a.mensaje])],
      boton: { texto: 'Ver mis alertas', url: `${urlSistema()}/alertas` },
    })
    const r = await enviarCorreo({
      para: persona.email,
      asunto: vencidas
        ? `Acuasan · ${vencidas} radicado(s) vencido(s) y ${alertas.length - vencidas} por vencer`
        : `Acuasan · ${alertas.length} radicado(s) por vencer`,
      html,
      texto,
    })
    if (r.enviado) enviados++
  }
  logger.info('ALERTAS', 'RESUMEN', `${items.length} alerta(s) notificadas a ${porPersona.size} persona(s)`)
  return { personas: porPersona.size, enviados }
}
