// POST|GET /api/cron/alertas — revisión diaria SIN usuario, para llamarla
// desde cron del sistema, GitHub Actions o Vercel Cron. Protegida con el
// secreto CRON_SECRET del .env (nunca asumimos dónde corre el backend).

import { Router } from 'express'
import { timingSafeEqual } from 'node:crypto'

import { AlertaController } from './alerta.controller.js'

const router = Router()

// El secreto puede llegar en el header x-cron-secret, como Bearer token o en
// ?secreto=… (Vercel Cron no permite headers propios, solo GET con query).
function secretoRecibido(req) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  return req.get('x-cron-secret') || req.query.secreto || bearer || ''
}

function protegerCron(req, res, next) {
  const esperado = process.env.CRON_SECRET
  if (!esperado) {
    return res.status(503).json({
      success: false,
      message: 'CRON_SECRET no está configurado en el servidor.',
    })
  }
  const a = Buffer.from(String(secretoRecibido(req)))
  const b = Buffer.from(esperado)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: 'Secreto de cron no válido.' })
  }
  next()
}

router.post('/', protegerCron, AlertaController.ejecutarCron)
router.get('/', protegerCron, AlertaController.ejecutarCron)

export default router
