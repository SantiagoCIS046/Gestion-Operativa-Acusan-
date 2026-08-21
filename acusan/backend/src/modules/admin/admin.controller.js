/**
 * admin.controller.js — Handlers HTTP para la gestión de usuarios (exclusivo ADMIN)
 */

import { AdminService } from './admin.service.js'
import logger from '../../config/logger.js'

export const AdminController = {

  /**
   * GET /api/admin/usuarios
   * Lista todos los usuarios del sistema
   */
  async listarUsuarios(req, res) {
    try {
      const usuarios = await AdminService.listarUsuarios()
      logger.info('SISTEMA', 'ADMIN LIST', `${req.usuario?.email} consultó lista de usuarios (${usuarios.length} registros)`)
      res.json({ success: true, data: usuarios })
    } catch (error) {
      logger.error('SISTEMA', 'ADMIN ERR', `listarUsuarios — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al listar usuarios', error: error.message })
    }
  },

  /**
   * PUT /api/admin/usuarios/:id
   * Edita datos de un usuario: nombre, cargo, rol, activo, cédula, contraseña opcional
   */
  async editarUsuario(req, res) {
    try {
      const { id } = req.params
      const usuarioEditado = await AdminService.editarUsuario(id, req.body)

      const admin = req.usuario?.email || 'admin'
      const cambios = Object.keys(req.body).filter(k => k !== 'nuevaPassword').join(', ')
      logger.update(
        'SISTEMA',
        'ADMIN EDITAR',
        `Por: ${admin} | Usuario ID: ${id} | Campos: ${cambios}`
      )

      res.json({
        success: true,
        message: 'Usuario actualizado correctamente',
        data: usuarioEditado
      })
    } catch (error) {
      const status = error.status || 500
      logger.error('SISTEMA', 'ADMIN ERR', `editarUsuario ID ${req.params.id} — ${error.message}`)
      res.status(status).json({ success: false, message: error.message || 'Error al editar usuario' })
    }
  },

  /**
   * DELETE /api/admin/usuarios/:id
   * Elimina permanentemente un usuario del sistema
   */
  async eliminarUsuario(req, res) {
    try {
      const { id } = req.params

      // Evitar que el admin se elimine a sí mismo
      if (req.usuario?.id === id) {
        return res.status(400).json({
          success: false,
          message: 'No puede eliminar su propia cuenta de administrador.'
        })
      }

      await AdminService.eliminarUsuario(id)

      const admin = req.usuario?.email || 'admin'
      logger.delete('SISTEMA', 'ADMIN ELIM.', `Por: ${admin} | Usuario ID: ${id} eliminado permanentemente`)

      res.json({ success: true, message: 'Usuario eliminado correctamente del sistema' })
    } catch (error) {
      logger.error('SISTEMA', 'ADMIN ERR', `eliminarUsuario ID ${req.params.id} — ${error.message}`)
      res.status(500).json({ success: false, message: 'Error al eliminar usuario', error: error.message })
    }
  }
}
