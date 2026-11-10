// Reglas de contraseña y utilidades de credenciales (una sola fuente para
// registro, creación por un administrador, restablecimiento y cambio propio).

import crypto from 'node:crypto'

export const LONGITUD_MINIMA = 8

/**
 * Lanza { status: 400 } si la contraseña no cumple la política:
 * mínimo 8 caracteres, con al menos una letra y un número.
 */
export function validarPassword(password) {
  const p = String(password ?? '')
  if (p.length < LONGITUD_MINIMA) {
    throw { status: 400, message: `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.` }
  }
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p) || !/\d/.test(p)) {
    throw { status: 400, message: 'La contraseña debe combinar letras y números.' }
  }
  if (p.length > 128) {
    throw { status: 400, message: 'La contraseña es demasiado larga (máximo 128 caracteres).' }
  }
}

/**
 * Contraseña temporal legible (sin caracteres ambiguos como 0/O o 1/l):
 * 4 letras + 4 números + 2 letras, p. ej. "Kmtp-4827-Qr".
 */
export function passwordTemporal() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  const digitos = '23456789'
  const elegir = (fuente, n) => Array.from({ length: n }, () => fuente[crypto.randomInt(fuente.length)]).join('')
  return `${elegir(letras, 4)}-${elegir(digitos, 4)}-${elegir(letras, 2)}`
}

// Token de recuperación: el valor viaja por correo; en la base solo su hash
export function nuevoTokenRecuperacion() {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

export const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
