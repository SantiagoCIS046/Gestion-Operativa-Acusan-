// Envío de correo del sistema (alertas, recuperación de contraseña, cuentas).
//
// Se activa con variables de entorno (backend/.env y Vercel):
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE ("true" para el puerto 465),
//   SMTP_USER, SMTP_PASS, CORREO_REMITENTE ("Acuasan <no-responder@…>")
//   APP_URL: dirección pública del sistema para los enlaces de los correos.
//
// Reglas:
// - Sin SMTP_HOST el correo queda DESACTIVADO: cada envío se registra en el
//   log (el comportamiento de siempre) y la operación sigue normal.
// - Nunca lanza: un servidor de correo caído no puede tumbar un radicado,
//   una revisión de alertas ni un restablecimiento. Devuelve el resultado.
// - En pruebas (NODE_ENV=test o SMTP_HOST=prueba) los mensajes van a una
//   bandeja en memoria (bandejaPrueba) en vez de salir a la red.

import nodemailer from 'nodemailer'
import logger from '../config/logger.js'

export const bandejaPrueba = []

const modoPrueba = () => process.env.NODE_ENV === 'test' || process.env.SMTP_HOST === 'prueba'

export function correoHabilitado() {
  return modoPrueba() || Boolean(process.env.SMTP_HOST?.trim())
}

// Dirección pública del sistema para armar enlaces (restablecer, ver radicado)
export function urlSistema() {
  const explicita = process.env.APP_URL?.trim()
  if (explicita) return explicita.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:5173'
}

let transporte = null
function obtenerTransporte() {
  if (transporte) return transporte
  const puerto = Number(process.env.SMTP_PORT || 587)
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port: puerto,
    secure: process.env.SMTP_SECURE === 'true' || puerto === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    // Un SMTP lento no debe colgar la petición que notifica
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return transporte
}

const escaparHtml = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Plantilla HTML común: encabezado institucional, párrafos y botón opcional.
 * parrafos: string[] (texto plano, se escapa) · boton: { texto, url } · tabla: string[][]
 */
export function plantillaCorreo({ titulo, parrafos = [], boton = null, tabla = null, pie = null }) {
  const filas = tabla
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${tabla
        .map(
          (fila, i) =>
            `<tr>${fila
              .map((c) =>
                i === 0
                  ? `<th style="text-align:left;padding:8px;background:#1f4e79;color:#fff">${escaparHtml(c)}</th>`
                  : `<td style="padding:8px;border-bottom:1px solid #e5e7eb">${escaparHtml(c)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')}</table>`
    : ''
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:600px;margin:0 auto;padding:24px">
  <div style="background:#0b3d6e;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0">
    <div style="font-size:12px;letter-spacing:.08em;opacity:.8">ACUASAN E.S.P. · GESTIÓN OPERATIVA</div>
    <div style="font-size:20px;font-weight:bold;margin-top:4px">${escaparHtml(titulo)}</div>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:0">
    ${parrafos.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${escaparHtml(p)}</p>`).join('')}
    ${filas}
    ${
      boton
        ? `<p style="margin:20px 0"><a href="${escaparHtml(boton.url)}" style="background:#1f4e79;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${escaparHtml(boton.texto)}</a></p>`
        : ''
    }
    <p style="font-size:12px;color:#6b7280;margin-top:24px">${escaparHtml(
      pie ?? 'Mensaje automático del sistema de gestión operativa de Acuasan. No responda a este correo.',
    )}</p>
  </div>
</div></body></html>`
  const texto = [
    titulo,
    '',
    ...parrafos,
    ...(tabla ? ['', ...tabla.map((f) => f.join(' | '))] : []),
    ...(boton ? ['', `${boton.texto}: ${boton.url}`] : []),
  ].join('\n')
  return { html, texto }
}

/**
 * Envía un correo. para: string | string[]. Devuelve
 * { enviado: boolean, canal: 'smtp' | 'log' | 'prueba', error? } — nunca lanza.
 */
export async function enviarCorreo({ para, asunto, html, texto }) {
  const destinos = [para].flat().filter(Boolean)
  if (!destinos.length) return { enviado: false, canal: 'ninguno' }

  if (modoPrueba()) {
    bandejaPrueba.push({ para: destinos, asunto, html, texto, fecha: new Date() })
    return { enviado: true, canal: 'prueba' }
  }

  if (!correoHabilitado()) {
    logger.info('CORREO', 'SIN SMTP', `(no enviado) ${asunto} → ${destinos.join(', ')}`)
    return { enviado: false, canal: 'log' }
  }

  try {
    await obtenerTransporte().sendMail({
      from: process.env.CORREO_REMITENTE || process.env.SMTP_USER,
      to: destinos.join(', '),
      subject: asunto,
      text: texto,
      html,
    })
    logger.success('CORREO', 'ENVIADO', `${asunto} → ${destinos.join(', ')}`)
    return { enviado: true, canal: 'smtp' }
  } catch (error) {
    logger.error('CORREO', 'FALLO', `${asunto} → ${destinos.join(', ')}: ${error.message}`)
    return { enviado: false, canal: 'smtp', error: error.message }
  }
}

// Para pruebas: el transporte se vuelve a crear si cambian las variables
export function reiniciarTransporte() {
  transporte = null
}
