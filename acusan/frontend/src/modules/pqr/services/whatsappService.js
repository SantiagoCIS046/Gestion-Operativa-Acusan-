import authService from '../../auth/services/authService.js'

/**
 * whatsappService — Respuesta manual del operario al ciudadano (Fase 6).
 * POST /api/pqr/whatsapp/responder (protegido con el JWT del login).
 */
const responderPorWhatsApp = async ({ telefono, mensaje, pqrId = null }) => {
  const res = await fetch('/api/pqr/whatsapp/responder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authService.getAuthHeader()
    },
    body: JSON.stringify({
      telefono,
      mensaje,
      ...(pqrId ? { pqrId } : {})
    })
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok || !data.success) {
    throw new Error(data.message || `Error ${res.status} al enviar la respuesta`)
  }

  return data
}

export const whatsappService = { responderPorWhatsApp }
export default whatsappService
