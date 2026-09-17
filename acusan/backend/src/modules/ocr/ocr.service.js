// ocr.service.js — Puente HTTP hacia el motor OCR Python (Flask :5001)
// ─────────────────────────────────────────────────────────────────────────────
// El único cliente del servicio Python es este backend: la autenticación
// (JWT + rol) vive aquí y el servicio queda privado por construcción
// (bind 127.0.0.1, sin CORS). Sin dependencias nuevas: fetch y
// AbortController son globales en Node 18+.
//
// Degradación elegante: si el servicio Python no está (caído, o producción
// en Vercel sin OCR_PY_URL apuntando a un host real), el fetch a localhost
// falla en milisegundos (ECONNREFUSED) y devolvemos 503 — el frontend cae
// al OCR del navegador sin que el usuario note nada.

import logger from '../../config/logger.js'

const OCR_PY_URL = process.env.OCR_PY_URL || process.env.URL_PY_OCR || 'http://127.0.0.1:5001'
const OCR_PY_TIMEOUT_MS = Number(process.env.OCR_PY_TIMEOUT_MS || 90000)

// Permisos arrastra la ronda de refuerzo por campos faltantes: en el motor
// free de Render una SOLA página medida tardó ~174s (87s ronda 1 + 87s
// refuerzo) — un techo de 115s lo aborta siempre y el permiso queda vacío.
// Techo propio para permisos, siempre por debajo del maxDuration 300 del
// lambda. Radicados (sin refuerzo, ~35s/pág) conserva OCR_PY_TIMEOUT_MS.
const timeoutPara = (dominio) =>
  dominio === 'permisos'
    ? Number(process.env.OCR_PY_TIMEOUT_PERMISOS_MS || 280000)
    : OCR_PY_TIMEOUT_MS

// Valor especial "DISABLED": usado en Vercel/producción donde no existe el
// servicio Python. Devuelve 503 instantáneamente sin abrir ninguna conexión
// (evita el timeout de 30s que Vercel aplica a sus Serverless Functions).
const OCR_PY_DESHABILITADO = OCR_PY_URL.trim().toUpperCase() === 'DISABLED'

// Base64 de un PDF de ~28 MB ya redondea 40 MB de JSON — mismo tope que
// MAX_CONTENT_LENGTH del servicio Python.
const MAX_BASE64_LENGTH = 40 * 1024 * 1024

/**
 * Reenvía la solicitud de escaneo al motor Python.
 * @param {{ archivoBase64?: string, nombreArchivo?: string, mimeType?: string,
 *           dominio: 'permisos'|'radicados', tipo?: string, texto?: string }} payload
 * @returns {Promise<{ status: number, cuerpo: object }>}
 *   status 200 → cuerpo tal cual del motor (success/data ya mapeados por el controller).
 *   Errores tipados: { status, codigo: 'no-disponible'|'timeout'|'error-python' }
 */
const escanearEnPython = async (payload) => {
  // Cortocircuito instantáneo en Vercel/producción (OCR_PY_URL=DISABLED)
  if (OCR_PY_DESHABILITADO) {
    return {
      status: 503,
      codigo: 'no-disponible',
      cuerpo: {
        success: false,
        motor: 'python',
        disponible: false,
        message: 'Motor OCR Python no disponible en esta instancia — use el OCR del navegador'
      }
    }
  }

  const controlador = new AbortController()
  const timeoutMs = timeoutPara(payload?.dominio)
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs)

  try {
    const respuesta = await fetch(`${OCR_PY_URL}/api/ocr/escanear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controlador.signal
    })

    let cuerpo
    try {
      cuerpo = await respuesta.json()
    } catch {
      cuerpo = { success: false, message: 'Respuesta no-JSON del motor OCR Python' }
    }

    if (!respuesta.ok) {
      // 4xx/5xx del Python: se propaga como 502 con el mensaje original
      return {
        status: 502,
        codigo: 'error-python',
        cuerpo: {
          success: false,
          motor: 'python',
          message: cuerpo?.message || `Motor OCR respondió ${respuesta.status}`
        }
      }
    }

    return { status: 200, cuerpo }
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        status: 504,
        codigo: 'timeout',
        cuerpo: {
          success: false,
          motor: 'python',
          disponible: true,
          message: `El motor OCR excedió ${Math.round(timeoutMs / 1000)}s de espera`
        }
      }
    }
    // ECONNREFUSED / DNS / red — el caso normal en Vercel sin servicio Python
    logger.warn('OCR-PY', 'NO DISPONIBLE', `${error.code || error.message} (${OCR_PY_URL})`)
    return {
      status: 503,
      codigo: 'no-disponible',
      cuerpo: {
        success: false,
        motor: 'python',
        disponible: false,
        message: 'Motor OCR Python no disponible — use el OCR del navegador'
      }
    }
  } finally {
    clearTimeout(temporizador)
  }
}

// Trabajos asíncronos: el OCR de un permiso escaneado tarda ~100s/página en
// el motor free — ninguna conexión HTTP puede esperar eso dentro del lambda
// (maxDuration 300). El flujo divide el escaneo en llamadas cortas: POST
// que enrola el trabajo (solo sube el base64) y GET de estado por jobId.
const OCR_PY_TIMEOUT_INICIO_MS = Number(process.env.OCR_PY_TIMEOUT_INICIO_MS || 90000)
const OCR_PY_TIMEOUT_CONSULTA_MS = Number(process.env.OCR_PY_TIMEOUT_CONSULTA_MS || 15000)

// Mapeo de errores compartido por las llamadas cortas al motor (el mismo
// contrato tipado de escanearEnPython: 503 no-disponible / 504 timeout /
// 502 error-python; 429 ocupado y 404 trabajo-perdido son del flujo de trabajos).
const _llamarPython = async (ruta, opciones, timeoutMs) => {
  if (OCR_PY_DESHABILITADO) {
    return {
      status: 503,
      codigo: 'no-disponible',
      cuerpo: {
        success: false,
        motor: 'python',
        disponible: false,
        message: 'Motor OCR Python no disponible en esta instancia — use el OCR del navegador'
      }
    }
  }

  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs)
  try {
    const respuesta = await fetch(`${OCR_PY_URL}${ruta}`, { ...opciones, signal: controlador.signal })
    let cuerpo
    try {
      cuerpo = await respuesta.json()
    } catch {
      cuerpo = { success: false, message: 'Respuesta no-JSON del motor OCR Python' }
    }
    if (!respuesta.ok) {
      if (respuesta.status === 429) {
        return { status: 429, codigo: 'ocupado', cuerpo }
      }
      if (respuesta.status === 404) {
        return { status: 404, codigo: 'trabajo-no-encontrado', cuerpo }
      }
      return {
        status: 502,
        codigo: 'error-python',
        cuerpo: {
          success: false,
          motor: 'python',
          message: cuerpo?.message || `Motor OCR respondió ${respuesta.status}`
        }
      }
    }
    return { status: respuesta.status, codigo: 'ok', cuerpo }
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        status: 504,
        codigo: 'timeout',
        cuerpo: {
          success: false,
          motor: 'python',
          disponible: true,
          message: `El motor OCR excedió ${Math.round(timeoutMs / 1000)}s de espera`
        }
      }
    }
    logger.warn('OCR-PY', 'NO DISPONIBLE', `${error.code || error.message} (${OCR_PY_URL})`)
    return {
      status: 503,
      codigo: 'no-disponible',
      cuerpo: {
        success: false,
        motor: 'python',
        disponible: false,
        message: 'Motor OCR Python no disponible — use el OCR del navegador'
      }
    }
  } finally {
    clearTimeout(temporizador)
  }
}

/**
 * Enrola un escaneo asíncrono en el motor Python y devuelve el jobId.
 * @param {{ archivoBase64?: string, nombreArchivo?: string, mimeType?: string,
 *           dominio: 'permisos'|'radicados', tipo?: string }} payload
 * @returns {Promise<{ status: 202, codigo: 'ok', cuerpo: { jobId } }|errores tipados>}
 */
const iniciarTrabajoPython = (payload) =>
  _llamarPython('/api/ocr/trabajos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, OCR_PY_TIMEOUT_INICIO_MS)

/**
 * Consulta el estado de un trabajo: procesando | listo (+respuesta/codigo).
 * @returns {Promise<{ status, codigo, cuerpo }>}
 */
const consultarTrabajoPython = (jobId) =>
  _llamarPython(`/api/ocr/trabajos/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  }, OCR_PY_TIMEOUT_CONSULTA_MS)

/**
 * Cancela un trabajo abandonado por el cliente: libera el único slot del
 * motor en vez de dejarlo OCR-eando en vano por minutos. Best-effort — un
 * 404 (ya expiró o terminó) se considera éxito silencioso.
 * @returns {Promise<{ status, codigo, cuerpo }>}
 */
const cancelarTrabajoPython = (jobId) =>
  _llamarPython(`/api/ocr/trabajos/${encodeURIComponent(jobId)}`, {
    method: 'DELETE'
  }, OCR_PY_TIMEOUT_CONSULTA_MS)

export const OcrService = { escanearEnPython, iniciarTrabajoPython, consultarTrabajoPython, cancelarTrabajoPython, MAX_BASE64_LENGTH }
