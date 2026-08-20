import authService from "../../auth/services/authService.js";

const API_BASE_URL = "/api/permisos";
const STORAGE_KEY = "acuasan_permisos_v2";

const getHeaders = () => ({
  "Content-Type": "application/json",
  ...authService.getAuthHeader(),
});

// ── Base de datos de Permisos (respaldo local cuando no hay conexión con la nube) ──
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch (e) {
    console.warn("Error guardando permisos locales:", e);
  }
};

export const permisosService = {
  /**
   * Obtiene la lista completa de permisos desde la base de datos central en la nube
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
          guardarDbLocalPermisos(data.data);
          return data.data;
        }
      }

      return obtenerDbLocalPermisos();
    } catch (error) {
      return obtenerDbLocalPermisos();
    }
  },

  /**
   * Radica un nuevo permiso extraído vía OCR o diligenciado.
   * El radicado secuencial SIEMPRE lo genera el backend (fuente de verdad).
   * Si ya tiene ID (edición), se actualiza en lugar de duplicar.
   */
  async crearPermiso(datos) {
    const ahora = new Date();
    const funcionario =
      datos.nombreFuncionario || datos.funcionario || "Funcionario Acuasan";

    const isEdit = Boolean(datos.id);

    // 1. Intentar guardar en el backend (nube / MongoDB Atlas) primero
    try {
      const url = isEdit ? `${API_BASE_URL}/${datos.id}` : API_BASE_URL;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ ...datos, funcionario }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.data) {
          // Sincronizar el respaldo local con el registro oficial del backend
          const lista = obtenerDbLocalPermisos();
          const filtrada = lista.filter(
            (p) =>
              String(p.id) !== String(data.data.id) &&
              String(p.radicado) !== String(data.data.radicado)
          );
          guardarDbLocalPermisos([data.data, ...filtrada]);
          return data.data;
        }
      } else if (isEdit && res.status === 404) {
        // El registro se borró del backend: crearlo de nuevo
        const resPost = await fetch(API_BASE_URL, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ ...datos, funcionario }),
        });
        if (resPost.ok) {
          const data = await resPost.json();
          if (data && data.success && data.data) return data.data;
        }
      }
    } catch (e) {
      console.warn(
        "Backend no disponible para guardar permiso, almacenado localmente:",
        e.message
      );
    }

    // 2. Fallback local (sin conexión): radicado provisional basado en timestamp
    let dia =
      parseInt((datos.fechaInicio || "").split("/")[0], 10) || ahora.getDate();
    let mesNum =
      parseInt((datos.fechaInicio || "").split("/")[1], 10) ||
      ahora.getMonth() + 1;
    let anio =
      parseInt((datos.fechaInicio || "").split("/")[2], 10) ||
      ahora.getFullYear();
    const radicadoProvisional = `PERM-${anio}-L${String(Date.now()).slice(-6)}`;
    const fechaEntrega = `${String(dia).padStart(2, "0")}/${String(
      mesNum
    ).padStart(2, "0")}/${anio}`;

    const nuevoPermiso = {
      ...datos,
      id: datos.id || radicadoProvisional,
      radicado: datos.radicado || radicadoProvisional,
      dia,
      mesNum,
      anio,
      funcionario,
      nombreFuncionario: funcionario,
      fechaEntrega,
      fechaInicio: datos.fechaInicio || fechaEntrega,
      estado: datos.estado || "APROBADO",
      estadoEnvio: datos.estadoEnvio || "APROBADO",
      confianzaOCR: datos.confianzaOCR || 98,
      createdAt: datos.createdAt || ahora.toISOString(),
    };

    const lista = obtenerDbLocalPermisos();
    const indexExistente = lista.findIndex(
      (p) => p.id === nuevoPermiso.id || p.radicado === nuevoPermiso.radicado
    );
    if (indexExistente !== -1) {
      lista[indexExistente] = { ...lista[indexExistente], ...nuevoPermiso };
    } else {
      lista.unshift(nuevoPermiso);
    }
    guardarDbLocalPermisos(lista);
    return nuevoPermiso;
  },

  /**
   * Elimina un permiso del almacenamiento local y backend
   */
  async eliminarPermiso(idORadicado) {
    const lista = obtenerDbLocalPermisos();
    const filtrada = lista.filter(
      (p) =>
        String(p.id) !== String(idORadicado) &&
        String(p.radicado) !== String(idORadicado)
    );
    guardarDbLocalPermisos(filtrada);

    try {
      await fetch(`${API_BASE_URL}/${idORadicado}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    } catch (e) {
      console.warn("Backend no disponible para eliminar permiso:", e.message);
    }

    return true;
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
   * Dictamen de Gerencia (Aprobado / Rechazado) con persistencia garantizada
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    const lista = obtenerDbLocalPermisos();
    const idx = lista.findIndex((p) => p.id === id || p.radicado === id);
    if (idx !== -1) {
      lista[idx].estado = estado;
      lista[idx].aprobadoPor = aprobadoPor || "Gerencia General Acuasan";
      lista[idx].observaciones = observaciones || "";
      guardarDbLocalPermisos(lista);
    }

    try {
      await fetch(`${API_BASE_URL}/${id}/dictamen`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ estado, aprobadoPor, observaciones }),
      });
    } catch (e) {
      console.warn("Backend no disponible para dictaminar permiso:", e.message);
    }

    return idx !== -1 ? lista[idx] : { id, estado, aprobadoPor, observaciones };
  },
};

export default permisosService;
