import { Router } from 'express'
import { PqrController } from './pqr.controller.js'
import { verificarRol } from '../../middlewares/auth.middleware.js'

// Endpoints GET, POST, PUT — endurecimiento por rol (verificarToken previo en app.js).
// Los roles replican meta.roles de /pqr/gestion y /pqr/dashboard en el router del
// frontend: nadie con UI legítima recibe 403, y el resto queda fuera. El módulo
// PQR está además bloqueado temporalmente en el frontend (PQR_BLOQUEADO).
const ROLES_PQR = verificarRol('OPERATIVO', 'GERENCIA', 'ADMIN')

const router = Router()

router.get('/', ROLES_PQR, PqrController.listar)
router.get('/:id', ROLES_PQR, PqrController.obtenerDetalle)
router.post('/', ROLES_PQR, PqrController.radicar)
router.put('/:id/responder', ROLES_PQR, PqrController.responder)

export default router
