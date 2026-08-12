import { PermisosService } from './permisos.service.js'

export const PermisosController = {
  /**
   * Listar todos los permisos generales
   */
  async listar(req, res) {
    try {
      const { estado, cedula, tipo } = req.query
      const permisos = await PermisosService.listarPermisos({ estado, cedula, tipo })
      res.json({
        success: true,
        data: permisos
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al listar permisos',
        error: error.message
      })
    }
  },

  /**
   * Obtener permisos para el encargado (Operativo / Carga y Procesamiento)
   * GET /api/permisos/encargado
   */
  async listarEncargado(req, res) {
    try {
      const permisos = await PermisosService.listarPermisos()
      res.json({
        success: true,
        message: 'Listado de permisos procesados por el encargado',
        data: permisos
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener permisos para el encargado',
        error: error.message
      })
    }
  },

  /**
   * Obtener permisos validados pendientes de decisión para Gerencia
   * GET /api/permisos/gerencia/pendientes
   */
  async listarGerenciaPendientes(req, res) {
    try {
      const permisosPendientes = await PermisosService.listarPermisos({ estado: 'PENDIENTE' })
      res.json({
        success: true,
        message: 'Listado de permisos validados listos para decisión gerencial',
        data: permisosPendientes
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener permisos pendientes para gerencia',
        error: error.message
      })
    }
  },

  /**
   * Obtener detalle de permiso por ID
   */
  async obtenerDetalle(req, res) {
    try {
      const { id } = req.params
      const permiso = await PermisosService.obtenerPorId(id)
      if (!permiso) {
        return res.status(404).json({ success: false, message: 'Permiso no encontrado' })
      }
      res.json({ success: true, data: permiso })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener permiso', error: error.message })
    }
  },

  /**
   * Registrar o validar la extracción OCR y radicar permiso
   * POST /api/permisos/validar-ocr
   */
  async validarOCR(req, res) {
    try {
      const { cedula, nombreFuncionario, cargo, dependencia, tipo, fechaInicio, fechaFin, justificacion, soporteUrl, ocrConfidence, ocrRawPayload } = req.body

      if (!cedula || !nombreFuncionario || !tipo || !fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios para guardar la validación OCR'
        })
      }

      const nuevoPermiso = await PermisosService.crearPermiso({
        cedula,
        nombreFuncionario,
        cargo,
        dependencia,
        tipo,
        fechaInicio,
        fechaFin,
        justificacion,
        soporteUrl,
        ocrConfidence,
        ocrRawPayload
      })

      res.status(201).json({
        success: true,
        message: 'Validación de OCR guardada exitosamente',
        data: nuevoPermiso
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al registrar validación OCR', error: error.message })
    }
  },

  /**
   * Registrar nuevo permiso de forma general
   */
  async registrar(req, res) {
    try {
      const nuevoPermiso = await PermisosService.crearPermiso(req.body)
      res.status(201).json({
        success: true,
        message: 'Solicitud de permiso registrada',
        data: nuevoPermiso
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al registrar permiso', error: error.message })
    }
  },

  /**
   * Aprobación / Rechazo por Gerencia
   * PUT /api/permisos/:id/dictamen
   */
  async dictaminar(req, res) {
    try {
      const { id } = req.params
      const { estado, aprobadoPor, observaciones } = req.body

      if (!['APROBADO', 'RECHAZADO'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser APROBADO o RECHAZADO'
        })
      }

      const permisoActualizado = await PermisosService.dictaminarPermiso(id, {
        estado,
        aprobadoPor: aprobadoPor || 'Gerencia General Acuasan',
        observaciones
      })

      res.json({
        success: true,
        message: `Permiso ${estado.toLowerCase()} correctamente`,
        data: permisoActualizado
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al actualizar dictamen de permiso', error: error.message })
    }
  }
}
