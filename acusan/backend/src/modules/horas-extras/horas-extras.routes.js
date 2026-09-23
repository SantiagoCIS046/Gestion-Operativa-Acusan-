import { Router } from 'express'
import { HorasExtrasController } from './horas-extras.controller.js'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware.js'

const router = Router()

// ─── Rutas del sistema interno (Gerencia / Encargado / Admin) ─────────────────
// Nota: verificarToken ya se aplica globalmente en app.js antes de este router.
// Ramón (ENCARGADO) tiene a Horas Extras dentro de su cargo; la vista del módulo
// (/horas-extras/gerencia) admite ENCARGADO+GERENCIA+ADMIN, así que las lecturas
// y el dictamen cubren esos tres roles; la creación queda en ENCARGADO+ADMIN.
router.get('/', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), HorasExtrasController.listar)
router.post('/', verificarRol('ENCARGADO', 'ADMIN'), HorasExtrasController.registrar)
router.put('/:id/dictamen', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), HorasExtrasController.dictaminar)

// ─── Rutas de la App Externa (Portal del Empleado) ───────────────────────────
// Estas rutas usan verificarToken con rol EMPLEADO_CAMPO (token generado
// automáticamente por cédula — sin contraseña completa).
// IMPORTANTE: estas rutas están DENTRO del bloque verificarToken global de app.js;
// el token-empleado es generado por el endpoint público en /api/auth/token-empleado.
router.get('/mis-registros', verificarToken, HorasExtrasController.misRegistros)
router.post('/autoreporte', verificarToken, HorasExtrasController.autoRegistrar)

export default router
