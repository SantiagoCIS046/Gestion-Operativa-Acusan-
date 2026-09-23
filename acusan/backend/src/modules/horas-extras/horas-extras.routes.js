import { Router } from 'express'
import { HorasExtrasController } from './horas-extras.controller.js'
import { EvidenciasController } from './evidencias.controller.js'
import { TurnosController } from './turnos.controller.js'
import { ReportesController } from './reportes.controller.js'
import { verificarToken, verificarRol } from '../../middlewares/auth.middleware.js'

const router = Router()

// ─── Sistema interno (Gerencia / Encargado / Admin) ───────────────────────────
// Nota: verificarToken ya se aplica globalmente en app.js antes de este router.
// Ramón (ENCARGADO) tiene a Horas Extras dentro de su cargo; la vista del módulo
// (/horas-extras/gerencia) admite ENCARGADO+GERENCIA+ADMIN, así que las lecturas
// y el dictamen cubren esos tres roles; la creación queda en ENCARGADO+ADMIN.
//
// ORDEN: las rutas LITERALES específicas van ANTES de las paramétricas /:id
// para que Express nunca capture un literal como parámetro.

// Literales del módulo base
router.get('/', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), HorasExtrasController.listar)
router.post('/', verificarRol('ENCARGADO', 'ADMIN'), HorasExtrasController.registrar)

// App externa (empleado de campo) — literales
router.get('/mis-registros', verificarToken, HorasExtrasController.misRegistros)
router.post('/autoreporte', verificarToken, HorasExtrasController.autoRegistrar)

// Sesiones de evidencias — literales antes de las paramétricas
router.post('/evidencias/iniciar', verificarRol('EMPLEADO_CAMPO'), EvidenciasController.iniciar)
router.get('/evidencias/mi-sesion-activa', verificarRol('EMPLEADO_CAMPO'), EvidenciasController.miSesionActiva)
router.get('/evidencias', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), EvidenciasController.listar)
router.put('/evidencias/revisar/:horaExtraId', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), EvidenciasController.revisar)

// Turnos — GET abierto a cualquier autenticado (la app de campo ve los
// activos; los internos pueden pasar ?inactivos=true); el CRUD es interno
router.get('/turnos', TurnosController.listar)
router.post('/turnos', verificarRol('ENCARGADO', 'ADMIN'), TurnosController.crear)

// Calendario festivo de Colombia (referencia para los turnos)
router.get('/festivos/:anio', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), ReportesController.festivos)

// Reportes, nómina y dashboard — solo horas/conteos (cero cálculo de dinero)
router.get('/reportes/mensual', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), ReportesController.mensual)
router.get('/reportes/csv', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), ReportesController.descargarCsv)
router.post('/nomina/enviar', verificarRol('GERENCIA', 'ADMIN'), ReportesController.enviarNomina)
router.get('/nomina/envios', verificarRol('GERENCIA', 'ADMIN'), ReportesController.listarEnvios)
router.get('/dashboard', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), ReportesController.dashboard)

// ─── Paramétricas (siempre después de los literales) ──────────────────────────
router.post('/evidencias/:horaExtraId/finalizar', verificarRol('EMPLEADO_CAMPO'), EvidenciasController.finalizar)
// Anular: dueño (EMPLEADO_CAMPO se valida por cédula en el controller) o interno
router.post('/evidencias/:horaExtraId/anular', verificarRol('EMPLEADO_CAMPO', 'ENCARGADO', 'ADMIN'), EvidenciasController.anular)
// Foto: campo solo ve SUS fotos (dueño verificado en el controller) + internos
router.get('/evidencias/:id/foto', verificarRol('EMPLEADO_CAMPO', 'ENCARGADO', 'GERENCIA', 'ADMIN'), EvidenciasController.obtenerFoto)

router.put('/turnos/:id', verificarRol('ENCARGADO', 'ADMIN'), TurnosController.actualizar)
router.delete('/turnos/:id', verificarRol('ENCARGADO', 'ADMIN'), TurnosController.eliminar)

router.put('/:id/dictamen', verificarRol('ENCARGADO', 'GERENCIA', 'ADMIN'), HorasExtrasController.dictaminar)
router.put('/:id/recalcular', verificarRol('ENCARGADO', 'ADMIN'), HorasExtrasController.recalcular)

export default router
