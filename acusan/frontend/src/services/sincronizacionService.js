/**
 * ============================================================================
 * ORQUESTADOR DE SINCRONIZACIÓN GLOBAL — ACUASAN E.S.P.
 * ============================================================================
 * Publica en la base de datos TODOS los registros guardados localmente sin
 * conexión (permisos, PQR y horas extras), sin esperar a que el usuario abra
 * la vista de cada módulo. Radicados quedó fuera: su módulo se rehace desde
 * cero con CRUD directo a la base de datos, sin cola offline.
 *
 * Se dispara:
 *   - Al arrancar la app (si hay sesión)
 *   - Al iniciar sesión (watch del estado de autenticación)
 *   - Al recuperar la conexión (evento 'online' del navegador)
 *
 * Cada módulo ya protege su propia cola con Web Locks: este orquestador solo
 * los convoca y resume el total publicado para informar al usuario.
 * ============================================================================
 */
import authService from '../modules/auth/services/authService.js'
import permisosService from '../modules/permisos/services/permisosService.js'
import pqrService from '../modules/pqr/services/pqrService.js'
import horasExtrasService from '../modules/horas-extras/services/horasExtrasService.js'
import notificacionService from './notificacionService.js'

const NOMBRE_LOCK = 'acuusan-sync-global'

let _enCurso = false

const ejecutar = async () => {
  const resultados = await Promise.allSettled([
    permisosService.sincronizarPendientes(),
    pqrService.sincronizarPendientes(),
    horasExtrasService.sincronizarPendientes()
  ])
  return resultados.reduce((total, r) => total + (r.status === 'fulfilled' ? Number(r.value) || 0 : 0), 0)
}

export const sincronizacionService = {
  /**
   * Sincroniza los pendientes de los 4 módulos contra la base de datos.
   * Devuelve el total de registros publicados. `silencioso: true` suprime la
   * notificación al usuario (arranque/login: no interrumpe la bienvenida).
   */
  async sincronizarTodo({ silencioso = false } = {}) {
    // Sin sesión no hay nada autorizado que publicar
    if (!authService.estaAutenticado()) return 0

    // Guard de concurrencia: login + mount + online pueden disparar en ráfaga.
    // Cada módulo además conserva su propio Web Lock (duplicados entre pestañas).
    if (navigator.locks && typeof navigator.locks.request === 'function') {
      try {
        const total = await navigator.locks.request(NOMBRE_LOCK, { ifAvailable: true }, async (lock) => {
          if (!lock) return 0 // Ya hay una sincronización global en curso
          return await ejecutar()
        })
        if (total > 0 && !silencioso) {
          notificacionService.mostrar(
            'success',
            'Sincronización completada',
            `${total} registro(s) pendiente(s) se publicaron en la base de datos.`
          )
        }
        return total
      } catch (e) {
        return 0
      }
    }

    if (_enCurso) return 0
    _enCurso = true
    try {
      const total = await ejecutar()
      if (total > 0 && !silencioso) {
        notificacionService.mostrar(
          'success',
          'Sincronización completada',
          `${total} registro(s) pendiente(s) se publicaron en la base de datos.`
        )
      }
      return total
    } finally {
      _enCurso = false
    }
  }
}

export default sincronizacionService
