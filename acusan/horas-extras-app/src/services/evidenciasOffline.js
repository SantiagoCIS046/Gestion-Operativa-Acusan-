/**
 * ============================================================================
 * EVIDENCIAS OFFLINE (INDEXEDDB) — ACUASAN E.S.P. (App Horas Extras)
 * ============================================================================
 * Cola local para evidencias fotográficas creadas sin conexión (mismo patrón
 * que adjuntosOffline.js del frontend principal). IndexedDB guarda registros
 * con data URLs de cientos de KB sin problema de cuota, así la foto sobrevive
 * offline y se envía al recuperar la señal.
 *
 * Dos tipos de registro conviven en el store 'sesiones' (keyPath idLocal):
 *   - Pendientes de sincronizar: { idLocal, tipo: 'INICIAR'|'FINALIZAR',
 *     payload, createdAt, ... } — la cola que vacía sincronizarPendientes().
 *   - Borrador de sesión activa: registro reservado con idLocal fijo
 *     '__sesion_activa__' — último estado conocido de la sesión EN_CURSO
 *     para pintar la tarjeta sin conexión.
 *
 * Degradación honesta: si IndexedDB no está disponible (modo privado, etc.),
 * toda operación resuelve null/false y NUNCA lanza al llamador — no se finge
 * un guardado.
 * ============================================================================
 */

const NOMBRE_DB = 'acuusan-evidencias-db'
const NOMBRE_STORE = 'sesiones'
const VERSION_DB = 1
// Registro reservado dentro del mismo store: borrador de la sesión activa
const ID_SESION_LOCAL = '__sesion_activa__'

let _promesaDb = null

const abrirDb = () => {
  if (!('indexedDB' in window)) return Promise.resolve(null)
  if (_promesaDb) return _promesaDb

  _promesaDb = new Promise((resolver) => {
    try {
      const solicitud = window.indexedDB.open(NOMBRE_DB, VERSION_DB)
      solicitud.onupgradeneeded = () => {
        const db = solicitud.result
        if (!db.objectStoreNames.contains(NOMBRE_STORE)) {
          db.createObjectStore(NOMBRE_STORE, { keyPath: 'idLocal' })
        }
      }
      solicitud.onsuccess = () => resolver(solicitud.result)
      solicitud.onerror = () => resolver(null)
      solicitud.onblocked = () => resolver(null)
    } catch (e) {
      resolver(null)
    }
  })
  return _promesaDb
}

const operarStore = async (modo, operacion) => {
  const db = await abrirDb()
  if (!db) return null

  return new Promise((resolver) => {
    try {
      const tx = db.transaction(NOMBRE_STORE, modo)
      const store = tx.objectStore(NOMBRE_STORE)
      const solicitud = operacion(store)
      // Escrituras: éxito explícito true (el result de un put es la CLAVE, no un
      // booleano — compararlo con === true en el llamador marcaba como fallido
      // un guardado exitoso). Lecturas: el valor o null.
      solicitud.onsuccess = () => resolver(modo === 'readonly' ? (solicitud.result ?? null) : true)
      solicitud.onerror = () => resolver(modo === 'readonly' ? null : false)
      tx.onabort = () => resolver(modo === 'readonly' ? null : false)
    } catch (e) {
      resolver(modo === 'readonly' ? null : false)
    }
  })
}

export const evidenciasOffline = {
  /**
   * Guarda una evidencia en la cola de pendientes de sincronización.
   * Resuelve true si quedó persistida; false si IndexedDB no está disponible.
   * @param {{ idLocal: string, tipo: 'INICIAR'|'FINALIZAR', payload: object,
   *           horaExtraId?: string, idLocalPadre?: string, createdAt?: string }} item
   */
  async guardarPendiente(item) {
    if (!item?.idLocal) return false
    const ok = await operarStore('readwrite', (store) =>
      store.put({
        createdAt: new Date().toISOString(),
        ...item,
        idLocal: String(item.idLocal)
      })
    )
    return ok === true
  },

  /**
   * Lista los pendientes de sincronización en orden de creación (FIFO).
   * Excluye el borrador de sesión activa. Resuelve [] si no hay IndexedDB.
   */
  async listarPendientes() {
    const todos = await operarStore('readonly', (store) => store.getAll())
    if (!Array.isArray(todos)) return []
    return todos
      .filter((r) => r.idLocal !== ID_SESION_LOCAL)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  },

  /**
   * Elimina un pendiente (fire-and-forget tras sincronizar o descartar).
   */
  async eliminarPendiente(idLocal) {
    if (!idLocal) return
    await operarStore('readwrite', (store) => store.delete(String(idLocal)))
  },

  /**
   * Guarda el borrador de la sesión activa (último estado conocido).
   */
  async guardarSesionLocal(sesion) {
    if (!sesion) return false
    const ok = await operarStore('readwrite', (store) =>
      store.put({
        ...sesion,
        idLocal: ID_SESION_LOCAL,
        guardadaEn: new Date().toISOString()
      })
    )
    return ok === true
  },

  /**
   * Obtiene el borrador de sesión activa o null.
   */
  async obtenerSesionLocal() {
    const registro = await operarStore('readonly', (store) => store.get(ID_SESION_LOCAL))
    return registro ?? null
  },

  /**
   * Elimina el borrador de sesión activa (al finalizar o anular).
   */
  async eliminarSesionLocal() {
    await operarStore('readwrite', (store) => store.delete(ID_SESION_LOCAL))
  }
}

export default evidenciasOffline
