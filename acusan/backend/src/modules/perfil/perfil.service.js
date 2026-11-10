// Perfil del usuario autenticado (GET /api/me)

import bcrypt from 'bcryptjs'
import prisma from '../../config/prisma.js'
import logger from '../../config/logger.js'
import { COSTO_BCRYPT, firmarSesion, usuarioDeSesion } from '../auth/auth.service.js'
import { validarPassword } from '../../lib/password.js'
import { invalidarCuenta } from '../../middlewares/auth.middleware.js'

const selectSinHash = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  areaId: true,
  activo: true,
  debeCambiarPassword: true,
  ultimoAcceso: true,
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

  /**
   * POST /api/me/password { actual, nueva } — cambio de la propia contraseña
   * (obligatorio tras una contraseña temporal). Cierra las demás sesiones y
   * devuelve un token nuevo para que esta siga abierta.
   */
  async cambiarPassword(usuarioId, { actual, nueva } = {}) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
    if (!usuario || !usuario.activo) throw { status: 401, message: 'Tu sesión ya no es válida.' }
    if (!actual || !(await bcrypt.compare(String(actual), usuario.passwordHash))) {
      throw { status: 400, message: 'La contraseña actual no es correcta.' }
    }
    validarPassword(nueva)
    if (await bcrypt.compare(String(nueva), usuario.passwordHash)) {
      throw { status: 400, message: 'La nueva contraseña debe ser distinta de la actual.' }
    }
    // sesionesDesde en el segundo actual: el token nuevo (mismo segundo) sigue
    // valiendo y los anteriores no.
    const ahora = new Date(Math.floor(Date.now() / 1000) * 1000)
    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash: await bcrypt.hash(String(nueva), COSTO_BCRYPT),
        debeCambiarPassword: false,
        sesionesDesde: ahora,
        resetTokenHash: null,
        resetTokenExpira: null,
      },
    })
    invalidarCuenta(usuario.id)
    logger.success('AUTH', 'PASSWORD', `Contraseña cambiada por ${usuario.email}`)
    return { token: firmarSesion(actualizado), usuario: usuarioDeSesion(actualizado) }
  },
}
