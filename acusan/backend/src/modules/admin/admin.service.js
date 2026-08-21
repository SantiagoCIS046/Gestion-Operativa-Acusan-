/**
 * admin.service.js — Lógica de negocio para la gestión de usuarios por el Administrador
 */

import prisma from '../../config/prisma.js'
import bcrypt from 'bcryptjs'

export const AdminService = {
  /**
   * Listar todos los usuarios del sistema (sin exponer contraseñas)
   */
  async listarUsuarios() {
    return prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        cedula: true,
        cargo: true,
        activo: true,
        ultimoAcceso: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'asc' }
    })
  },

  /**
   * Obtener un usuario por ID (sin contraseña)
   */
  async obtenerPorId(id) {
    return prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        cedula: true,
        cargo: true,
        activo: true,
        ultimoAcceso: true,
        createdAt: true
      }
    })
  },

  /**
   * Editar datos de un usuario (nombre, cargo, rol, activo, cédula)
   * Opcionalmente también cambia la contraseña si se envía nuevaPassword
   */
  async editarUsuario(id, datos) {
    const { nombre, cargo, rol, activo, cedula, nuevaPassword } = datos

    const rolesValidos = ['ENCARGADO', 'GERENCIA', 'OPERATIVO', 'ADMIN', 'RADICADOS']

    const dataActualizar = {}

    if (nombre !== undefined)   dataActualizar.nombre = nombre.trim()
    if (cargo !== undefined)    dataActualizar.cargo  = cargo.trim()
    if (cedula !== undefined)   dataActualizar.cedula = cedula.trim()
    if (activo !== undefined)   dataActualizar.activo = Boolean(activo)

    if (rol !== undefined) {
      const rolNorm = rol.toUpperCase().trim()
      if (!rolesValidos.includes(rolNorm)) {
        throw { status: 400, message: `Rol inválido. Opciones: ${rolesValidos.join(', ')}` }
      }
      dataActualizar.rol = rolNorm
    }

    if (nuevaPassword && nuevaPassword.length >= 6) {
      dataActualizar.password = await bcrypt.hash(nuevaPassword, 10)
    }

    if (Object.keys(dataActualizar).length === 0) {
      throw { status: 400, message: 'No se enviaron campos para actualizar.' }
    }

    return prisma.usuario.update({
      where: { id },
      data: dataActualizar,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        cedula: true,
        cargo: true,
        activo: true,
        ultimoAcceso: true
      }
    })
  },

  /**
   * Eliminar un usuario del sistema (operación irreversible)
   */
  async eliminarUsuario(id) {
    return prisma.usuario.delete({ where: { id } })
  }
}
