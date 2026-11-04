// Rutas de informes periódicos.
//   LIDER_GENERAL: ve todo (global por defecto, ?areaId= para un área),
//     dispara cierres (generar/sincronizar) y marca revisado.
//   LIDER_AREA: solo su área — el servidor la fuerza aunque la URL traiga
//     otra (resolverAlcance).
//   USUARIO: 403 en todo el módulo.

import { Router } from 'express'

import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import { InformesController } from './informes.controller.js'

const router = Router()

const puedeVer = [requireAuth, requireRole('LIDER_GENERAL', 'LIDER_AREA')]
const soloGerencia = [requireAuth, requireRole('LIDER_GENERAL')]

router.post('/generar', ...soloGerencia, InformesController.generar)
router.post('/sincronizar', ...soloGerencia, InformesController.sincronizar)
router.get('/', ...puedeVer, InformesController.listar)
router.get('/serie', ...puedeVer, InformesController.serie)
router.get('/gerencia/:anio/:mes', ...soloGerencia, InformesController.gerenciaMes)

// Control mensual vivo (métricas al momento; no son fotos guardadas)
router.get('/mes/:anio/:mes/excel', ...puedeVer, InformesController.excelMes)
router.get('/mes/:anio/:mes/semana/:numero', ...puedeVer, InformesController.semana)
router.get('/mes/:anio/:mes/pendientes', ...puedeVer, InformesController.pendientesMes)
router.get('/mes/:anio/:mes', ...puedeVer, InformesController.mes)

// Fotos guardadas (cierres)
router.get('/:id/excel', ...puedeVer, InformesController.excel)
router.get('/:id', ...puedeVer, InformesController.detalle)
router.post('/:id/revisar', ...soloGerencia, InformesController.revisar)

export default router
