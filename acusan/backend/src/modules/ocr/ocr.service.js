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
  const temporizador = setTimeout(() => controlador.abort(), OCR_PY_TIMEOUT_MS)

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
          message: `El motor OCR excedió ${Math.round(OCR_PY_TIMEOUT_MS / 1000)}s de espera`
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

export const OcrService = { escanearEnPython, MAX_BASE64_LENGTH }
