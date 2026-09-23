/**
 * turnos.service.js — CRUD de turnos de referencia por cuadrilla/área.
 *
 * El match contra los registros de horas extras es TEXTUAL sobre
 * HoraExtra.cuadrillaArea (mismo criterio del clasificador). Las horas están
 * en hora local de Colombia (UTC-5 fijo) y se admite cruce de medianoche
 * (ej: 22:00→06:00). El DELETE es lógico (activo=false) para no romper los
 * cálculos ya snapshoteados en registros históricos.
 */

import prisma from '../../config/prisma.js'
import { parsearHHmm } from './clasificadorRecargos.js'

export const TurnosService = {
  /**
   * Lista turnos. Por defecto solo activos; ?inactivos=true los trae todos
   * (para la gestión interna). La app de campo siempre ve solo activos.
   */
  async listar({ inactivos = false } = {}) {
    return prisma.turno.findMany({
      where: inactivos ? {} : { activo: true },
      orderBy: [{ cuadrillaArea: 'asc' }, { horaInicio: 'asc' }]
    })
  },

  /**
   * Turno vigente (activo) que corresponde a una cuadrilla/área por match
   * textual exacto insensible a mayúsculas. Null si no hay turno configurado.
   */
  async buscarPorCuadrilla(cuadrillaArea) {
    if (!cuadrillaArea) return null
    return prisma.turno.findFirst({
      where: { activo: true, cuadrillaArea: { equals: cuadrillaArea.trim(), mode: 'insensitive' } },
      orderBy: { updatedAt: 'desc' }
    })
  },

  /** Valida y normaliza los datos del turno. Lanza 400 si algo no cuadra. */
  _validar({ nombre, cuadrillaArea, horaInicio, horaFin, jornadaEstandar }) {
    if (!nombre || !cuadrillaArea || !horaInicio || !horaFin) {
      throw Object.assign(
        new Error('Faltan campos obligatorios del turno: nombre, cuadrillaArea, horaInicio, horaFin.'),
        { status: 400 }
      )
    }
    if (parsearHHmm(horaInicio) === null || parsearHHmm(horaFin) === null) {
      throw Object.assign(
        new Error('horaInicio y horaFin deben tener formato HH:mm (ej: 07:30).'),
        { status: 400 }
      )
    }
    if (parsearHHmm(horaInicio) === parsearHHmm(horaFin)) {
      throw Object.assign(
        new Error('La hora de inicio y de fin del turno no pueden ser iguales.'),
        { status: 400 }
      )
    }
    const jornada = jornadaEstandar == null ? 8 : Number(jornadaEstandar)
    if (!Number.isFinite(jornada) || jornada <= 0 || jornada > 24) {
      throw Object.assign(
        new Error('jornadaEstandar debe ser un número de horas entre 0 (exclusivo) y 24.'),
        { status: 400 }
      )
    }
    return { nombre: nombre.trim(), cuadrillaArea: cuadrillaArea.trim(), horaInicio, horaFin, jornadaEstandar: jornada }
  },

  async crear(datos) {
    const { nombre, cuadrillaArea, horaInicio, horaFin, jornadaEstandar } = this._validar(datos)
    try {
      return await prisma.turno.create({
        data: { nombre, cuadrillaArea, horaInicio, horaFin, jornadaEstandar }
      })
    } catch (error) {
      if (error.code === 'P2002') {
        throw Object.assign(new Error(`Ya existe un turno llamado "${nombre}".`), { status: 409 })
      }
      throw error
    }
  },

  async actualizar(id, datos) {
    // Reactivación/baja aislada: un PUT que solo trae { activo } no exige el
    // resto de campos (la web lo usa para reactivar un turno desactivado).
    const claves = Object.keys(datos || {})
    const soloActivo = claves.length > 0 && claves.every((k) => k === 'activo') && typeof datos.activo === 'boolean'
    if (soloActivo) {
      try {
        return await prisma.turno.update({ where: { id }, data: { activo: datos.activo } })
      } catch (error) {
        if (error.code === 'P2025') {
          throw Object.assign(new Error('Turno no encontrado.'), { status: 404 })
        }
        throw error
      }
    }

    const { nombre, cuadrillaArea, horaInicio, horaFin, jornadaEstandar } = this._validar(datos)
    try {
      return await prisma.turno.update({
        where: { id },
        data: {
          nombre,
          cuadrillaArea,
          horaInicio,
          horaFin,
          jornadaEstandar,
          // El interruptor "Turno activo" del formulario de edición
          ...(typeof datos.activo === 'boolean' ? { activo: datos.activo } : {})
        }
      })
    } catch (error) {
      if (error.code === 'P2025') {
        throw Object.assign(new Error('Turno no encontrado.'), { status: 404 })
      }
      if (error.code === 'P2002') {
        throw Object.assign(new Error(`Ya existe un turno llamado "${nombre}".`), { status: 409 })
      }
      throw error
    }
  },

  /** Eliminación LÓGICA: el turno queda inactivo y deja de aplicar. */
  async eliminar(id) {
    try {
      return await prisma.turno.update({ where: { id }, data: { activo: false } })
    } catch (error) {
      if (error.code === 'P2025') {
        throw Object.assign(new Error('Turno no encontrado.'), { status: 404 })
      }
      throw error
    }
  }
}
