import { Router } from 'express'
import { HorasExtrasController } from './horas-extras.controller.js'
import { verificarRol } from '../../middlewares/auth.middleware.js'

const router = Router()

// Endpoints GET, POST, PUT — endurecimiento por rol (verificarToken previo en app.js).
// Ramón (ENCARGADO) tiene a Horas Extras dentro de su cargo; la vista del módulo
// (/horas-extras/gerencia) admite ENCARGADO+GERENCIA+ADMIN, así que las lecturas
// y el dictamen cubren esos tres roles; la creación queda en ENCARGADO+ADMIN.
router.get('/', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), HorasExtrasController.listar)
router.post('/', verificarRol('ENCARGADO', 'ADMIN'), HorasExtrasController.registrar)
router.put('/:id/dictamen', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), HorasExtrasController.dictaminar)

export default router
