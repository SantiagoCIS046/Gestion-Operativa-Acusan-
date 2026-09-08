import { Router } from 'express'
import { WhatsappController } from './whatsapp.controller.js'
import { verificarToken } from '../../middlewares/auth.middleware.js'

const router = Router()

// Verificación del webhook: Meta llama GET una sola vez al configurar la URL
// en el panel de la app (envía hub.mode/hub.verify_token/hub.challenge)
router.get('/', WhatsappController.verificar)

// Recepción de eventos: mensajes entrantes y acuses de estado (statuses).
// Responde 200 inmediato y delega al worker asíncrono
router.post('/', WhatsappController.recibir)

// Respuesta manual del operario al ciudadano (Fase 6). A diferencia del
// webhook, este POST SÍ está protegido: lo invoca el frontend con JWT
router.post('/responder', verificarToken, WhatsappController.responder)

export default router
