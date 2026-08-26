/**
 * ============================================================================
 * ADJUNTOS OFFLINE (INDEXEDDB) — ACUASAN E.S.P.
 * ============================================================================
 * Almacén temporal para documentos adjuntos de registros creados sin conexión
 * cuyo Base64 no cabe en localStorage (~5MB de cuota). IndexedDB guarda Blobs
 * con una cuota de cientos de MB, así el documento sobrevive offline y se
 * re-adjunta al payload en la sincronización.
 *
 * Ciclo de vida:
 *   1. guardarAdjunto(idLocal, {...})  — al guardar el registro pendiente local
 *   2. obtenerAdjunto(idLocal)         — visor offline / re-attach al sincronizar
 *   3. eliminarAdjunto(idLocal)        — tras publicar en la BD (o descartar)
 *
 * Degradación honesta: si IndexedDB no está disponible (modo privado, etc.),
 * toda operación resuelve null/false y NUNCA lanza al llamador — el flujo
 * anterior (archivoOmitido) sigue su curso y no se finge un guardado.
 * ============================================================================
 */

const NOMBRE_DB = 'acuasan-adjuntos-db'
const NOMBRE_STORE = 'adjuntos'
const VERSION_DB = 1

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
      // un guardado exitoso y perdía el documento). Lecturas: el valor o null.
      solicitud.onsuccess = () => resolver(modo === 'readonly' ? (solicitud.result ?? null) : true)
      solicitud.onerror = () => resolver(modo === 'readonly' ? null : false)
      tx.onabort = () => resolver(modo === 'readonly' ? null : false)
    } catch (e) {
      resolver(modo === 'readonly' ? null : false)
    }
  })
}

export const adjuntosOffline = {
  /**
   * Guarda el adjunto (data URL completo) asociado a un idLocal.
   * Resuelve true si quedó persistido; false si IndexedDB no está disponible.
   */
  async guardarAdjunto(idLocal, { dataUrl, mime, nombre }) {
    if (!idLocal || !dataUrl) return false
    const ok = await operarStore('readwrite', (store) =>
      store.put({
        idLocal: String(idLocal),
        dataUrl,
        mime: mime || '',
        nombre: nombre || '',
        createdAt: new Date().toISOString()
      })
    )
    return ok === true
  },

  /**
   * Obtiene el adjunto { idLocal, dataUrl, mime, nombre, createdAt } o null.
   */
  async obtenerAdjunto(idLocal) {
    if (!idLocal) return null
    const registro = await operarStore('readonly', (store) => store.get(String(idLocal)))
    return registro && registro.dataUrl ? registro : null
  },

  /**
   * Elimina un adjunto (fire-and-forget tras sincronizar o descartar).
   */
  async eliminarAdjunto(idLocal) {
    if (!idLocal) return
    await operarStore('readwrite', (store) => store.delete(String(idLocal)))
  },

  /**
   * Elimina varios adjuntos a la vez.
   */
  async eliminarAdjuntos(idsLocales) {
    for (const id of idsLocales || []) {
      await this.eliminarAdjunto(id)
    }
  }
}

export default adjuntosOffline
