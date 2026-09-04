import { Router } from 'express'
import { WhatsappController } from './whatsapp.controller.js'

const router = Router()

// Verificación del webhook: Meta llama GET una sola vez al configurar la URL
// en el panel de la app (envía hub.mode/hub.verify_token/hub.challenge)
router.get('/', WhatsappController.verificar)

// Recepción de eventos: mensajes entrantes y acuses de estado (statuses).
// Responde 200 inmediato y delega al worker asíncrono
router.post('/', WhatsappController.recibir)

export default router
