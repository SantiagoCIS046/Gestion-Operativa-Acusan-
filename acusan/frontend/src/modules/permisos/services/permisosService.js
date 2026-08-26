import authService from "../../auth/services/authService.js";
import adjuntosOffline from "../../../services/adjuntosOffline.js";

const API_BASE_URL = "/api/permisos";
const STORAGE_KEY = "acuasan_permisos_v2";

const getHeaders = () => ({
  "Content-Type": "application/json",
  ...authService.getAuthHeader(),
});

// ── Caché local (espejo del servidor + registros provisionales sin conexión) ──
const obtenerDbLocalPermisos = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // fallback
  }
  return [];
};

const guardarDbLocalPermisos = (lista) => {
  // La cuota de localStorage (~5MB) puede agotarse: el fallo NO se traga,
  // se propaga para que el llamador informe honestamente al usuario.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
};

// Nunca persistir el documento Base64 en localStorage (desborda la cuota con un
// solo escaneo). El archivo vive en la BD; el caché guarda metadatos + hasArchivo.
const sanitizarParaCache = (item) => {
  if (!item || typeof item !== "object") return item;
  const { archivoBinario, archivoUrl, customFileUrl, ...resto } = item;
  const teniaArchivo =
    Boolean(archivoBinario) ||
    (typeof archivoUrl === "string" && archivoUrl.startsWith("data:")) ||
    (typeof customFileUrl === "string" && customFileUrl.startsWith("data:"));
  return { ...resto, hasArchivo: resto.hasArchivo || teniaArchivo };
};

// Identificador de cliente para idempotencia de la sincronización (dedupe server-side)
const generarIdLocal = () =>
  window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `loc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Un permiso es local si su id/radicado lleva la marca -LOCAL- o si el id no es
// un ObjectId de MongoDB de 24 hex (formatos provisionales legados: PERM-<anio>-Lxxxxxx)
const esIdLocal = (idORadicado) =>
  typeof idORadicado === "string" &&
  (idORadicado.includes("-LOCAL-") || !/^[0-9a-f]{24}$/i.test(idORadicado));

// Reemplaza/inserta un registro en la caché local sin duplicados ni Base64
const fusionarEnCache = (item) => {
  const lista = obtenerDbLocalPermisos();
  const filtrada = lista.filter(
    (p) =>
      String(p.id) !== String(item.id) &&
      String(p.radicado) !== String(item.radicado)
  );
  guardarDbLocalPermisos([sanitizarParaCache(item), ...filtrada]);
};

export const permisosService = {
  /**
   * Obtiene la lista de permisos desde la base de datos central (fuente de verdad).
   * La caché local NUNCA se pisa con una lista vacía del servidor y los
   * registros provisionales (sin conexión) se conservan y se muestran al final.
   */
  async obtenerHistorialPermisos(filtros = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const params = new URLSearchParams();
      if (filtros.estado) params.append("estado", filtros.estado);
      if (filtros.cedula) params.append("cedula", filtros.cedula);
      if (filtros.tipo) params.append("tipo", filtros.tipo);

      const url = params.toString()
        ? `${API_BASE_URL}/encargado?${params.toString()}`
        : `${API_BASE_URL}/encargado`;
      const res = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 401) {
        authService.logout();
        window.location.href = "/login";
        return [];
      }

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          const localesPendientes = obtenerDbLocalPermisos().filter(
            (p) => p.sincronizado === false
          );
          // Una edición local pendiente (pendienteUpdate) desplaza a la versión
          // obsoleta del servidor con el mismo id — nunca se muestran duplicadas
          const idsPendientes = new Set(
            localesPendientes.flatMap((p) => [String(p.id), String(p.radicado)])
          );
          const delServidor = data.data
            .map(sanitizarParaCache)
            .filter(
              (p) => !idsPendientes.has(String(p.id)) && !idsPendientes.has(String(p.radicado))
            );
          if (data.data.length > 0 || localesPendientes.length === 0) {
            try {
              guardarDbLocalPermisos([...localesPendientes, ...delServidor]);
            } catch (eCuota) {
              console.warn("No se pudo actualizar el espejo local:", eCuota.message);
            }
          }
          return [...delServidor, ...localesPendientes];
        }
      }

      return obtenerDbLocalPermisos();
    } catch (error) {
      return obtenerDbLocalPermisos();
    }
  },

  /**
   * Radica un nuevo permiso o edita uno existente (datos.id).
   * El radicado secuencial SIEMPRE lo genera el backend (fuente de verdad).
   * Sin conexión: NUEVO → provisional pendiente de POST; EDICIÓN de provisional →
   * se actualiza el mismo provisional; EDICIÓN de registro del servidor → se
   * guarda la versión editada marcada pendienteUpdate (sincroniza con PUT,
   * nunca como POST nuevo) para no duplicar en la BD.
   */
  async crearPermiso(datos) {
    const ahora = new Date();
    const funcionario =
      datos.nombreFuncionario || datos.funcionario || "Funcionario Acuasan";

    const isEdit = Boolean(datos.id);
    const idLocal = datos.idLocal || generarIdLocal();
    const payload = { ...datos, funcionario, idLocal };

    // EDICIÓN de un provisional LOCAL: no existe en el servidor (un PUT daría
    // error). Se actualiza el provisional y se sincroniza YA si hay conexión
    // (POST idempotente por idLocal → nunca duplica).
    if (isEdit && esIdLocal(datos.id)) {
      const editado = await this._guardarOffline(datos, isEdit, idLocal, funcionario, ahora);
      try {
        const publicados = await this.sincronizarPendientes();
        if (publicados > 0) {
          const enCaché = obtenerDbLocalPermisos().find(
            (p) =>
              (editado.idLocal && p.idLocal === editado.idLocal) ||
              String(p.radicado) === String(editado.radicado)
          );
          if (enCaché && enCaché.sincronizado !== false) {
            return { ...enCaché, origen: "SERVIDOR" };
          }
        }
      } catch (e) {
        // Sin conexión: queda pendiente de sincronización automática
      }
      return editado;
    }

    // 1. Guardar en el backend (nube / MongoDB Atlas) — fuente de verdad
    try {
      const url = isEdit ? `${API_BASE_URL}/${datos.id}` : API_BASE_URL;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        authService.logout();
        window.location.href = "/login";
        throw new Error("Sesión expirada. Inicie sesión nuevamente.");
      }

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.data) {
          // Sincronizar el respaldo local con el registro oficial del backend
          try {
            fusionarEnCache(data.data);
          } catch (eCuota) {
            console.warn("Espejo local sin espacio; el permiso SÍ está en la BD:", eCuota.message);
          }
          return { ...data.data, origen: "SERVIDOR" };
        }
        throw new Error((data && data.message) || "El servidor rechazó el permiso.");
      }
      if (isEdit && res.status === 404) {
        // El registro fue eliminado del servidor: no se recrea en silencio.
        throw new Error(
          "El permiso ya no existe en la base de datos (pudo ser eliminado desde otro equipo). Refresque el historial."
        );
      }
      throw new Error(`El servidor respondió ${res.status}`);
    } catch (e) {
      if (e.message && e.message.startsWith("Sesión expirada")) throw e;
      if (e.message && e.message.startsWith("El permiso ya no existe")) throw e;

      // 2. Fallback local EXPLÍCITO (sin conexión)
      console.warn(
        "Backend no disponible para guardar permiso, almacenado localmente (pendiente de sincronización):",
        e.message
      );
      return await this._guardarOffline(datos, isEdit, idLocal, funcionario, ahora);
    }
  },

  /**
   * Persiste el permiso en la caché local (sin conexión o provisional local).
   * EDICIÓN: actualiza el MISMO registro (nunca crea un segundo). NUEVO: alta
   * provisional. Ante cuota llena reintenta sin el documento (archivoOmitido)
   * y si tampoco cabe lanza un error honesto.
   */
  async _guardarOffline(datos, isEdit, idLocal, funcionario, ahora) {
    const lista = obtenerDbLocalPermisos();

    // EDICIÓN: actualizar el MISMO registro, jamás crear un segundo
    if (isEdit) {
      const idx = lista.findIndex(
        (p) => String(p.id) === String(datos.id) || String(p.radicado) === String(datos.id)
      );
      if (idx !== -1) {
        const original = lista[idx];
        // ¿Provisional puro (id/radicado local)? → POST idempotente al sincronizar.
        // Registro del servidor (incluida una edición ya pendienteUpdate) → PUT.
        const esProvisional =
          esIdLocal(original.id) || esIdLocal(original.radicado);
        const editado = {
          ...original,
          ...datos,
          id: original.id,
          radicado: original.radicado,
          idLocal: esProvisional ? (original.idLocal || idLocal) : undefined,
          // Se CONSERVA en re-ediciones: seguir siendo PUT evita duplicados en la BD
          pendienteUpdate: !esProvisional,
          sincronizado: false,
          origen: "LOCAL",
        };
        if (!editado.idLocal) delete editado.idLocal;
        try {
          lista[idx] = editado;
          guardarDbLocalPermisos(lista);
          return editado;
        } catch (eCuota) {
          // Sin espacio en localStorage: resguardar el documento en IndexedDB
          // (cuota de cientos de MB) para no perderlo antes de omitirlo.
          const claveAdj = editado.idLocal || String(editado.id);
          const adjuntoEd = editado.archivoUrl || editado.customFileUrl || "";
          const guardadoEnIdb = adjuntoEd
            ? await adjuntosOffline.guardarAdjunto(claveAdj, {
                dataUrl: adjuntoEd,
                nombre: editado.soporte || "",
              })
            : false;
          lista[idx] = sanitizarParaCache({
            ...editado,
            ...(guardadoEnIdb ? { archivoEnIndexedDB: true } : { archivoOmitido: true }),
          });
          try {
            guardarDbLocalPermisos(lista);
            console.warn(
              guardadoEnIdb
                ? "Cuota de localStorage llena: documento resguardado en IndexedDB para su publicación posterior."
                : "Documento adjunto omitido por cuota de almacenamiento local: " + eCuota.message
            );
            return lista[idx];
          } catch (eCuota2) {
            if (guardadoEnIdb) adjuntosOffline.eliminarAdjunto(claveAdj);
            throw new Error(
              "No hay espacio en el almacenamiento local del navegador y el servidor no responde. Libere espacio e intente de nuevo."
            );
          }
        }
      }
      // El original no está en caché: tratar la edición como alta nueva (más abajo)
    }

    let dia =
      parseInt((datos.fechaInicio || "").split("/")[0], 10) || ahora.getDate();
    let mesNum =
      parseInt((datos.fechaInicio || "").split("/")[1], 10) ||
      ahora.getMonth() + 1;
    let anio =
      parseInt((datos.fechaInicio || "").split("/")[2], 10) ||
      ahora.getFullYear();
    const radicadoProvisional = `PERM-${anio}-LOCAL-${String(Date.now()).slice(-6)}`;
    const fechaEntrega = `${String(dia).padStart(2, "0")}/${String(
      mesNum
    ).padStart(2, "0")}/${anio}`;

    const nuevoPermiso = {
      ...datos,
      idLocal,
      id: radicadoProvisional,
      radicado: radicadoProvisional,
      dia,
      mesNum,
      anio,
      funcionario,
      nombreFuncionario: funcionario,
      fechaEntrega,
      fechaInicio: datos.fechaInicio || fechaEntrega,
      estado: datos.estado || "APROBADO",
      estadoEnvio: datos.estadoEnvio || "APROBADO",
      confianzaOCR: datos.confianzaOCR ?? 0,
      createdAt: datos.createdAt || ahora.toISOString(),
      sincronizado: false,
      origen: "LOCAL",
    };

    const idxExistente = lista.findIndex(
      (p) => p.id === nuevoPermiso.id || p.radicado === nuevoPermiso.radicado
    );
    try {
      if (idxExistente !== -1) {
        lista[idxExistente] = { ...lista[idxExistente], ...nuevoPermiso };
      } else {
        lista.unshift(nuevoPermiso);
      }
      guardarDbLocalPermisos(lista);
      return nuevoPermiso;
    } catch (eCuota) {
      // Sin espacio en localStorage: resguardar el documento en IndexedDB
      // (cuota de cientos de MB) para no perderlo antes de omitirlo.
      const adjuntoNuevo = nuevoPermiso.archivoUrl || nuevoPermiso.customFileUrl || "";
      const guardadoEnIdb = adjuntoNuevo
        ? await adjuntosOffline.guardarAdjunto(idLocal, {
            dataUrl: adjuntoNuevo,
            nombre: nuevoPermiso.soporte || "",
          })
        : false;
      const registro = sanitizarParaCache({
        ...nuevoPermiso,
        ...(guardadoEnIdb ? { archivoEnIndexedDB: true } : { archivoOmitido: true }),
      });
      const listaLimpia = lista.filter(
        (p) => p.id !== registro.id && p.radicado !== registro.radicado
      );
      try {
        guardarDbLocalPermisos([registro, ...listaLimpia]);
        console.warn(
          guardadoEnIdb
            ? "Cuota de localStorage llena: documento resguardado en IndexedDB para su publicación posterior."
            : "Documento adjunto omitido por cuota de almacenamiento local: " + eCuota.message
        );
        return registro;
      } catch (eCuota2) {
        if (guardadoEnIdb) adjuntosOffline.eliminarAdjunto(idLocal);
        throw new Error(
          "No hay espacio en el almacenamiento local del navegador y el servidor no responde. Libere espacio e intente de nuevo."
        );
      }
    }
  },

  /**
   * Reintenta enviar a la nube los permisos guardados localmente sin conexión.
   * Los marcados pendienteUpdate (edición offline de un registro del servidor)
   * se publican con PUT al id original; los nuevos, con POST idempotente (idLocal).
   * Lock (Web Locks / flag módulo): dos pestañas no duplican envíos.
   */
  async sincronizarPendientes() {
    const nombreLock = "acuasan-sync-permisos";
    if (navigator.locks && typeof navigator.locks.request === "function") {
      try {
        return await navigator.locks.request(nombreLock, { ifAvailable: true }, async (lock) => {
          if (!lock) return 0; // Otra pestaña ya está sincronizando
          return await this._ejecutarSincronizacion();
        });
      } catch (e) {
        return 0;
      }
    }
    if (this._sincronizando) return 0;
    this._sincronizando = true;
    try {
      return await this._ejecutarSincronizacion();
    } finally {
      this._sincronizando = false;
    }
  },

  async _ejecutarSincronizacion() {
    const pendientes = obtenerDbLocalPermisos().filter(
      (p) => p.sincronizado === false
    );
    let sincronizados = 0;
    for (const p of pendientes) {
      const esUpdateServidor = Boolean(p.pendienteUpdate) && !esIdLocal(p.id);
      const { sincronizado, origen, id, radicado, pendienteUpdate, archivoOmitido, archivoEnIndexedDB, ...payload } = p;
      try {
        // Adjunto resguardado en IndexedDB (no cupo en localStorage): re-adjuntar
        const conAdjunto = { ...payload };
        if (archivoEnIndexedDB && !conAdjunto.archivoUrl && !conAdjunto.customFileUrl) {
          const adj = await adjuntosOffline.obtenerAdjunto(p.idLocal || String(p.id));
          if (adj) conAdjunto.archivoUrl = adj.dataUrl;
        }

        let res;
        if (esUpdateServidor) {
          res = await fetch(`${API_BASE_URL}/${id}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(conAdjunto),
          });
          // El registro fue eliminado del servidor mientras estaba offline:
          // publicarlo como nuevo (mismo criterio que una alta)
          if (res.status === 404) {
            res = await fetch(API_BASE_URL, {
              method: "POST",
              headers: getHeaders(),
              body: JSON.stringify({ ...conAdjunto, idLocal: generarIdLocal() }),
            });
          }
        } else {
          res = await fetch(API_BASE_URL, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(conAdjunto),
          });
        }

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.data) {
            const lista = obtenerDbLocalPermisos().filter(
              (x) =>
                String(x.id) !== String(p.id) &&
                String(x.radicado) !== String(p.radicado)
            );
            let espejoOk = false;
            try {
              guardarDbLocalPermisos([sanitizarParaCache(data.data), ...lista]);
              espejoOk = true;
            } catch (eCuota) {
              console.warn("Espejo local sin espacio tras sincronizar:", eCuota.message);
            }
            // El adjunto de IndexedDB solo se borra si el espejo local se actualizó:
            // si la fila pendiente sobrevive por cuota llena, sigue apuntando a él
            // y el visor la resuelve desde ahí.
            if (archivoEnIndexedDB && espejoOk)
              adjuntosOffline.eliminarAdjunto(p.idLocal || String(p.id));
            sincronizados++;
          }
        }
      } catch (e) {
        // Sigue sin conexión: se reintentará en el próximo montaje
      }
    }
    return sincronizados;
  },

  /**
   * Elimina un permiso del servidor y de la caché local.
   * Solo los provisionales locales pueden eliminarse sin conexión;
   * para registros del servidor se informa el error real.
   */
  async eliminarPermiso(idORadicado) {
    const lista = obtenerDbLocalPermisos();
    const idx = lista.findIndex(
      (p) =>
        String(p.id) === String(idORadicado) ||
        String(p.radicado) === String(idORadicado)
    );
    const esLocalPendiente = idx !== -1 && lista[idx].sincronizado === false;

    try {
      const res = await fetch(`${API_BASE_URL}/${idORadicado}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      if (res.ok) {
        guardarDbLocalPermisos(
          lista.filter(
            (p) =>
              String(p.id) !== String(idORadicado) &&
              String(p.radicado) !== String(idORadicado)
          )
        );
        return true;
      }
      throw new Error(`El servidor respondió ${res.status}`);
    } catch (e) {
      if (esLocalPendiente) {
        guardarDbLocalPermisos(
          lista.filter(
            (p) =>
              String(p.id) !== String(idORadicado) &&
              String(p.radicado) !== String(idORadicado)
          )
        );
        return true;
      }
      throw new Error(
        "No se pudo eliminar el permiso: sin conexión con el servidor."
      );
    }
  },

  /**
   * Obtiene el detalle de un permiso por su ID (desde la nube, incluye el archivo Base64)
   */
  async obtenerDetallePermiso(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.data) return data.data;
      }
    } catch (e) {
      console.warn("Backend no disponible para obtener detalle:", e.message);
    }
    return null;
  },

  /**
   * Obtiene el detalle de un permiso (compatibilidad con el nombre anterior)
   */
  async obtenerPermisoPorId(id) {
    const detalle = await this.obtenerDetallePermiso(id);
    if (detalle) return detalle;
    const lista = obtenerDbLocalPermisos();
    return lista.find((p) => p.id === id || p.radicado === id) || null;
  },

  /**
   * Descarga el archivo original (PDF/Word/Imagen) del permiso como URL de objeto.
   * Usa Authorization header, por lo que no se puede usar directamente en <object src>.
   * Devuelve un objectURL listo para visores/pestañas.
   */
  async obtenerArchivoPermiso(id) {
    const res = await fetch(`${API_BASE_URL}/${id}/archivo`, {
      method: "GET",
      headers: authService.getAuthHeader(),
    });
    if (!res.ok)
      throw new Error("No fue posible obtener el archivo del permiso");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  /**
   * Dictamen de Gerencia (Aprobado / Rechazado) con persistencia en el servidor.
   * Solo los provisionales locales pueden dictaminarse sin conexión;
   * para registros del servidor se informa el error real.
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    const lista = obtenerDbLocalPermisos();
    const idx = lista.findIndex(
      (p) => String(p.id) === String(id) || String(p.radicado) === String(id)
    );
    const esLocalPendiente = idx !== -1 && lista[idx].sincronizado === false;

    try {
      const res = await fetch(`${API_BASE_URL}/${id}/dictamen`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ estado, aprobadoPor, observaciones }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          if (idx !== -1) {
            lista[idx] = {
              ...lista[idx],
              ...sanitizarParaCache(data.data || { estado, aprobadoPor, observaciones }),
            };
            try {
              guardarDbLocalPermisos(lista);
            } catch (eCuota) {
              console.warn("Espejo local sin espacio:", eCuota.message);
            }
          }
          return (
            (data.data) ||
            (idx !== -1 ? lista[idx] : { id, estado, aprobadoPor, observaciones })
          );
        }
        throw new Error((data && data.message) || "Respuesta inválida del servidor");
      }
      throw new Error(`El servidor respondió ${res.status}`);
    } catch (e) {
      if (esLocalPendiente) {
        lista[idx].estado = estado;
        lista[idx].aprobadoPor = aprobadoPor || "Gerencia General Acuasan";
        lista[idx].observaciones = observaciones || "";
        try {
          guardarDbLocalPermisos(lista);
        } catch (eCuota) {
          // Cuota llena: el dictamen vive en la sesión actual y se sincronizará igual
          console.warn("Espejo local sin espacio para el dictamen:", eCuota.message);
        }
        return lista[idx];
      }
      throw new Error(
        "No se pudo registrar el dictamen: sin conexión con el servidor."
      );
    }
  },
};

export default permisosService;
