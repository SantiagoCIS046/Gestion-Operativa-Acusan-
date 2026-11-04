// Perfil del usuario autenticado (GET /api/me)

import prisma from '../../config/prisma.js'

const selectSinHash = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  areaId: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
  area: {
    select: { id: true, nombre: true, codigo: true, parentId: true },
  },
}

export const PerfilService = {
  /**
   * Rehidrata la sesión desde la BD (el token puede traer datos viejos).
   * Devuelve null si el usuario fue borrado o desactivado.
   */
  async obtenerPerfil(usuarioId) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: selectSinHash,
    })

    if (!usuario || !usuario.activo) return null
    return usuario
  },
}
