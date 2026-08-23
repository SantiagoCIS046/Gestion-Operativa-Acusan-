import { PermisosService } from './permisos.service.js'
import logger from '../../config/logger.js'

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
      logger.error('PERMISOS', 'LISTAR ERR', error.message)
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
      logger.error('PERMISOS', 'ENCARGADO ERR', error.message)
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
      const permisos = await PermisosService.listarPermisos()
      res.json({
        success: true,
        message: 'Listado consolidado de permisos para consulta gerencial',
        data: permisos
      })
    } catch (error) {
      logger.error('PERMISOS', 'GERENCIA ERR', error.message)
      res.status(500).json({
        success: false,
        message: 'Error al obtener permisos para consulta gerencial',
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
      logger.error('PERMISOS', 'DETALLE ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al obtener permiso', error: error.message })
    }
  },

  /**
   * Registrar o validar la extracción OCR y radicar permiso
   * POST /api/permisos/validar-ocr
   */
  async validarOCR(req, res) {
    try {
      const { cedula, nombreFuncionario, funcionario } = req.body
      const nombre = nombreFuncionario || funcionario

      if (!cedula || !nombre) {
        return res.status(400).json({
          success: false,
          message: 'Faltan cédula o nombre del funcionario para guardar la validación OCR'
        })
      }

      const nuevoPermiso = await PermisosService.crearPermiso(req.body)

      const usuario = req.usuario?.email || 'anónimo'
      logger.create(
        'PERMISOS',
        'OCR VALIDAR',
        `Por: ${usuario} | Funcionario: ${nombre} | Cédula: ${cedula}`
      )

      res.status(201).json({
        success: true,
        message: 'Validación de OCR guardada y radicada exitosamente',
        data: nuevoPermiso
      })
    } catch (error) {
      logger.error('PERMISOS', 'OCR ERROR', error.message)
      res.status(500).json({ success: false, message: 'Error al registrar validación OCR', error: error.message })
    }
  },

  /**
   * Registrar nuevo permiso de forma general
   * POST /api/permisos
   */
  async registrar(req, res) {
    try {
      const { cedula, nombreFuncionario, funcionario, tipoPermiso, tipo } = req.body
      const nombre = nombreFuncionario || funcionario

      if (!cedula || !nombre) {
        return res.status(400).json({
          success: false,
          message: 'Cédula y Nombre de funcionario son requeridos para radicar el permiso.'
        })
      }

      const nuevoPermiso = await PermisosService.crearPermiso(req.body)

      const usuario = req.usuario?.email || 'anónimo'
      logger.create(
        'PERMISOS',
        'CREAR',
        `Por: ${usuario} | Funcionario: ${nombre} | Cédula: ${cedula} | Tipo: ${tipoPermiso || tipo || '?'}`
      )

      res.status(201).json({
        success: true,
        message: 'Solicitud de permiso registrada correctamente',
        data: nuevoPermiso
      })
    } catch (error) {
      logger.error('PERMISOS', 'CREAR ERR', error.message)
      res.status(500).json({ success: false, message: 'Error al registrar permiso', error: error.message })
    }
  },

  /**
   * Servir el archivo original (PDF/Word/Imagen) adjunto al permiso
   * GET /api/permisos/:id/archivo
   */
  async servirArchivo(req, res) {
    try {
      const { id } = req.params
      const permiso = await PermisosService.obtenerPorId(id)
      if (!permiso || !permiso.archivoBinario) {
        return res.status(404).json({ success: false, message: 'El permiso no tiene archivo adjunto' })
      }

      const dataUrl = permiso.archivoBinario
      const matches = dataUrl.match(/^data:([^;]+);base64,(.*)$/s)
      if (!matches) {
        return res.status(422).json({ success: false, message: 'Formato de archivo almacenado no soportado' })
      }

      const mime = permiso.archivoMimeType || matches[1] || 'application/octet-stream'
      const buffer = Buffer.from(matches[2], 'base64')
      const nombreSeguro = (permiso.soporte || 'Permiso_Escaneado').replace(/["\r\n]/g, '')

      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Disposition', `inline; filename="${nombreSeguro}"`)
      res.setHeader('Cache-Control', 'private, max-age=300')
      return res.send(buffer)
    } catch (error) {
      logger.error('PERMISOS', 'ARCHIVO ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al servir el archivo del permiso', error: error.message })
    }
  },

  /**
   * Actualizar permiso existente
   * PUT /api/permisos/:id
   */
  async actualizar(req, res) {
    try {
      const { id } = req.params
      const actualizado = await PermisosService.actualizarPermiso(id, req.body)

      // null = el registro no existe en la BD (ej. es un provisional local sin sincronizar)
      if (!actualizado) {
        return res.status(404).json({
          success: false,
          message: 'El permiso no existe en la base de datos. Refresque el historial e inténtelo de nuevo.'
        })
      }

      const usuario = req.usuario?.email || 'anónimo'
      logger.update('PERMISOS', 'ACTUALIZAR', `Por: ${usuario} | ID: ${id}`)

      res.json({
        success: true,
        message: 'Permiso actualizado correctamente',
        data: actualizado
      })
    } catch (error) {
      logger.error('PERMISOS', 'ACTUALIZ ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(503).json({ success: false, message: 'Error al actualizar permiso', error: error.message })
    }
  },

  /**
   * Eliminar un permiso
   * DELETE /api/permisos/:id
   */
  async eliminar(req, res) {
    try {
      const { id } = req.params
      const eliminado = await PermisosService.eliminarPermiso(id)
      if (!eliminado) {
        return res.status(404).json({ success: false, message: 'No se encontró el permiso a eliminar' })
      }

      const usuario = req.usuario?.email || 'anónimo'
      logger.delete('PERMISOS', 'ELIMINAR', `Por: ${usuario} | ID: ${id}`)

      res.json({
        success: true,
        message: 'Permiso eliminado correctamente'
      })
    } catch (error) {
      logger.error('PERMISOS', 'ELIMINAR ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al eliminar permiso', error: error.message })
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

      const usuario = req.usuario?.email || 'anónimo'
      const nivel = estado === 'APROBADO' ? 'success' : 'warn'
      logger[nivel](
        'PERMISOS',
        'DICTAMINAR',
        `Por: ${usuario} | ID: ${id} | Estado: ${estado} | Aprobó: ${aprobadoPor || 'Gerencia'}`
      )

      res.json({
        success: true,
        message: `Permiso ${estado.toLowerCase()} correctamente`,
        data: permisoActualizado
      })
    } catch (error) {
      logger.error('PERMISOS', 'DICTAM ERR', `ID: ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al actualizar dictamen de permiso', error: error.message })
    }
  }
}
