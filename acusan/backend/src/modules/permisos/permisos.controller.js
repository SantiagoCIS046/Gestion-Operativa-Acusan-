import { PermisosService } from './permisos.service.js'

export const PermisosController = {
  /**
   * Listar todos los permisos
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
   * Registrar nuevo permiso tras validación OCR
   */
  async registrar(req, res) {
    try {
      const { cedula, nombreFuncionario, cargo, dependencia, tipo, fechaInicio, fechaFin, justificacion, soporteUrl, ocrConfidence } = req.body

      if (!cedula || !nombreFuncionario || !tipo || !fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios para radicar el permiso'
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
        ocrConfidence
      })

      res.status(201).json({
        success: true,
        message: 'Solicitud de permiso registrada exitosamente',
        data: nuevoPermiso
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al registrar permiso', error: error.message })
    }
  },

  /**
   * Aprobación / Rechazo por Gerencia
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
  },

  /**
   * Simulación de procesamiento OCR para extracción de texto estructurado
   */
  async procesarOCR(req, res) {
    try {
      const { archivoUrl } = req.body
      // En integración real se conecta a Google Cloud Vision / Tesseract / AWS Textract
      const ocrMockResult = {
        cedula: '1098765432',
        nombreFuncionario: 'Carlos Andrés Gómez Ortiz',
        cargo: 'Operario de Redes',
        dependencia: 'División Técnica Acueducto',
        tipoPermiso: 'CALAMIDAD',
        fechaInicio: '2026-08-15',
        fechaFin: '2026-08-16',
        justificacionExtraida: 'Se solicita permiso por calamidad doméstica con soporte médico adjunto.',
        confianza: 96.5
      }

      res.json({
        success: true,
        message: 'Documento procesado por motor OCR',
        data: ocrMockResult
      })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error en procesamiento OCR', error: error.message })
    }
  }
}
