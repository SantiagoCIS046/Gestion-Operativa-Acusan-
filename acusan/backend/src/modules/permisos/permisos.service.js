// Servicio de Permisos Laborales — Acuasan E.S.P.
import { randomUUID } from "crypto";
import prisma from "../../config/prisma.js";

// Tamaño máximo del archivo Base64 guardado en MongoDB (~15MB binarios => ~20MB base64)
const MAX_BASE64_LENGTH = 20 * 1024 * 1024;

// Diccionario bidireccional de mapeo de tipos de permisos
const MAPA_TIPOS = {
  COMPENSATORIO: "Compensatorio",
  MEDICO: "Cita Médica",
  PERSONAL: "Personal",
  CALAMIDAD: "Calamidad Doméstica",
  ESTUDIO: "Estudio / Capacitación",
};

const normalizarTipoEnum = (tipoStr) => {
  if (!tipoStr) return "COMPENSATORIO";
  const t = String(tipoStr).toUpperCase().trim();
  if (t.includes("MEDIC") || t.includes("CITA")) return "MEDICO";
  if (t.includes("COMPENS")) return "COMPENSATORIO";
  if (t.includes("CALAMID")) return "CALAMIDAD";
  if (t.includes("ESTUD") || t.includes("CAPACIT")) return "ESTUDIO";
  if (t.includes("PERSON")) return "PERSONAL";
  return [
    "CALAMIDAD",
    "MEDICO",
    "PERSONAL",
    "COMPENSATORIO",
    "ESTUDIO",
  ].includes(t)
    ? t
    : "COMPENSATORIO";
};

const parsearFecha = (val) => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    if (val.includes("/")) {
      const partes = val.split("/");
      if (partes.length === 3) {
        const d = parseInt(partes[0], 10);
        const m = parseInt(partes[1], 10) - 1;
        const y = parseInt(partes[2], 10);
        return new Date(y, m, d);
      }
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const formatearFecha = (val) => {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

// Sanitizar archivo Base64: si excede el límite, no se guarda (se conserva el nombre y mime)
const sanitizarArchivo = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== "string") return "";
  if (!dataUrl.startsWith("data:")) return "";
  if (dataUrl.length > MAX_BASE64_LENGTH) return "";
  return dataUrl;
};

const formatearParaFrontend = (p, incluirArchivo = false) => {
  const fechaInicio = p.fechaInicio ? new Date(p.fechaInicio) : new Date();
  const fechaEntrega = formatearFecha(fechaInicio);
  const anio = fechaInicio.getFullYear();
  const mesNum = fechaInicio.getMonth() + 1;
  const dia = fechaInicio.getDate();

  const tipoAmigable = MAPA_TIPOS[p.tipo] || p.tipo;
  const mime = p.archivoMimeType || "";

  const resultado = {
    id: p.id,
    radicado: p.radicado,
    idLocal: p.idLocal || "",
    cedula: p.cedula,
    funcionario: p.nombreFuncionario,
    nombreFuncionario: p.nombreFuncionario,
    cargo: p.cargo || "Funcionario Acuasan",
    dependencia: p.dependencia || "Operativa",
    tipo: tipoAmigable,
    tipoEnum: p.tipo,
    fechaInicio: fechaEntrega,
    fechaFin: formatearFecha(p.fechaFin) || fechaEntrega,
    fechaEntrega,
    hora24: p.hora24 || "08:00",
    duracion: p.duracion || "",
    // Indica si el horario coincidió con la jornada completa del día
    jornadaCompleta: p.jornadaCompleta === true,
    motivo: p.justificacion || p.motivoManuscrito || "",
    motivoManuscrito: p.motivoManuscrito || "",
    observaciones: p.observaciones || "",
    soporte: p.soporte || "Permiso_Escaneado.pdf",
    soporteUrl: p.soporteUrl || "",
    // El Base64 del archivo solo viaja en el detalle (peso); el listado envía metadatos
    archivoUrl: incluirArchivo ? p.archivoUrl || "" : "",
    archivoMimeType: mime,
    // Indicadores de tipo de archivo para el visor de Gerencia/Encargado
    isPdf: mime
      ? mime === "application/pdf"
      : p.soporte
      ? p.soporte.toLowerCase().endsWith(".pdf")
      : false,
    isImage: mime
      ? mime.startsWith("image/")
      : /\.(png|jpe?g|webp|gif|bmp)$/i.test(p.soporte || ""),
    isWord: mime
      ? mime.includes("wordprocessingml") || mime.includes("msword")
      : /\.(docx?|odt)$/i.test(p.soporte || ""),
    isText: mime
      ? mime.startsWith("text/") ||
        mime.includes("json") ||
        mime.includes("xml")
      : /\.(txt|csv|md)$/i.test(p.soporte || ""),
    hasArchivo: Boolean(
      p.archivoUrl && String(p.archivoUrl).startsWith("data:")
    ),
    estado: p.estado,
    estadoEnvio: p.estado === "PENDIENTE" ? "APROBADO" : p.estado,
    aprobadoPor: p.aprobadoPor || "Registro Directo",
    fechaAprobacion: p.fechaAprobacion,
    ocrConfidence: p.ocrConfidence,
    anio,
    mesNum,
    dia,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };

  // Solo se incluye el archivo binario cuando se pide explícitamente (detalle)
  if (incluirArchivo) {
    resultado.archivoBinario = p.archivoUrl || "";
  }

  return resultado;
};

export const PermisosService = {
  /**
   * Obtener lista de permisos con filtros.
   * El listado NO incluye el Base64 del archivo (peso), solo metadatos e indicadores.
   */
  async listarPermisos(filtros = {}) {
    const where = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.cedula) where.cedula = filtros.cedula;
    if (filtros.tipo) where.tipo = normalizarTipoEnum(filtros.tipo);

    // Sin catch silencioso: ante error de BD se propaga (500) para que el
    // frontend distinga "no hay datos" de "BD no disponible" y use su caché.
    const resultados = await prisma.permiso.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return resultados.map((p) => formatearParaFrontend(p, false));
  },

  /**
   * Obtener permiso por ID (incluye el archivo Base64 para el visor)
   */
  async obtenerPorId(id) {
    try {
      const item = await prisma.permiso.findUnique({ where: { id } });
      return item ? formatearParaFrontend(item, true) : null;
    } catch (e) {
      // Puede ser un radicado en lugar de ObjectId
      try {
        const item = await prisma.permiso.findFirst({
          where: { radicado: id },
        });
        return item ? formatearParaFrontend(item, true) : null;
      } catch (err) {
        return null;
      }
    }
  },

  /**
   * Genera el siguiente radicado secuencial real de la BD: PERM-<anio>-00XX
   * (sin colisiones, contando solo registros del año en curso)
   */
  async generarRadicadoUnico() {
    const anio = new Date().getFullYear();
    const prefijo = `PERM-${anio}-`;

    // Buscar el mayor consecutivo existente con ese prefijo
    const existentes = await prisma.permiso.findMany({
      where: { radicado: { startsWith: prefijo } },
      select: { radicado: true },
    });

    let maxSeq = 0;
    for (const r of existentes) {
      const m = r.radicado.match(new RegExp(`^${prefijo}(\\d+)$`));
      if (m) {
        const seq = parseInt(m[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    // Reintentos ante posibles colisiones por concurrencia
    for (let intento = 1; intento <= 5; intento++) {
      const candidato = `${prefijo}${String(maxSeq + intento).padStart(
        4,
        "0"
      )}`;
      const yaExiste = await prisma.permiso.findFirst({
        where: { radicado: candidato },
      });
      if (!yaExiste) return candidato;
    }

    // Último recurso: timestamp
    return `${prefijo}${Date.now()}`;
  },

  /**
   * Crear nueva solicitud de permiso.
   * El radicado SIEMPRE lo genera el backend (secuencial real) para evitar duplicados.
   * idLocal habilita idempotencia: un reintento de sincronización (respuesta perdida)
   * devuelve el registro ya creado en lugar de duplicarlo.
   */
  async crearPermiso(datos) {
    if (datos.idLocal) {
      const existente = await prisma.permiso.findFirst({
        where: { idLocal: String(datos.idLocal) },
      });
      if (existente) {
        console.warn(
          `[PermisosService] POST idempotente: idLocal=${datos.idLocal} ya existe como ${existente.radicado}`
        );
        return formatearParaFrontend(existente, false);
      }
    }

    const tipoEnum = normalizarTipoEnum(datos.tipo || datos.tipoPermiso);
    const fechaInicioParsed = parsearFecha(datos.fechaInicio);
    const fechaFinParsed = parsearFecha(datos.fechaFin || datos.fechaInicio);

    const ahora = new Date();
    const hora24Actual =
      datos.hora24 ||
      ahora.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

    const archivoUrl = sanitizarArchivo(
      datos.archivoUrl || datos.customFileUrl
    );

    const estadoInicial = ["PENDIENTE", "APROBADO", "RECHAZADO", "EN_REVISION"].includes(
      String(datos.estado || datos.estadoEnvio || "").toUpperCase()
    )
      ? String(datos.estado || datos.estadoEnvio).toUpperCase()
      : "APROBADO";

    const dataCrear = {
      cedula: String(datos.cedula || "").trim(),
      nombreFuncionario: datos.nombreFuncionario || datos.funcionario || "",
      cargo: datos.cargo || "Funcionario Acuasan",
      dependencia: datos.dependencia || "Operativa",
      tipo: tipoEnum,
      fechaInicio: fechaInicioParsed,
      fechaFin: fechaFinParsed,
      duracion: datos.duracion || datos.horasCalculadas || "",
      // El frontend la marca cuando las horas coinciden con la jornada del día
      jornadaCompleta: datos.jornadaCompleta === true,
      hora24: hora24Actual,
      justificacion: datos.justificacion || datos.motivo || "",
      motivoManuscrito: datos.motivoManuscrito || "",
      soporte:
        datos.soporte || datos.documentFileName || "Permiso_Escaneado.pdf",
      soporteUrl: datos.soporteUrl || "",
      archivoUrl,
      archivoMimeType: datos.archivoMimeType || "",
      // Confianza OCR real (0 si no se pudo leer); nunca se inventa un 0.98
      ocrConfidence: Number(datos.ocrConfidence ?? datos.confianzaOCR ?? 0),
      ocrRawPayload: datos.ocrRawPayload || {},
      observaciones: datos.observaciones || "",
      estado: estadoInicial,
      aprobadoPor: datos.aprobadoPor || "Registro Directo",
      // NUNCA null: el índice único de MongoDB indexaría null como valor y solo
      // cabría un documento sin idLocal en toda la colección (P2002 masivo).
      idLocal: String(datos.idLocal || randomUUID()),
    };

    // Reintento real ante colisión concurrente del consecutivo (P2002)
    let ultimoError = null;
    for (let intento = 1; intento <= 4; intento++) {
      const radicado = await this.generarRadicadoUnico();
      try {
        const creado = await prisma.permiso.create({
          data: { ...dataCrear, radicado },
        });
        return formatearParaFrontend(creado, false);
      } catch (e) {
        ultimoError = e;
        if (e.code !== "P2002") break;
        console.warn(
          `[PermisosService] Colisión de radicado (intento ${intento}/4), regenerando: ${e.message}`
        );
      }
    }

    throw new Error(
      `No se pudo persistir el permiso: ${ultimoError?.message || "error desconocido"}`
    );
  },

  /**
   * Actualizar permiso existente.
   * Retorna null si el registro no existe (P2025) para responder 404 honesto.
   */
  async actualizarPermiso(id, datos) {
    const tipoEnum =
      datos.tipo || datos.tipoPermiso
        ? normalizarTipoEnum(datos.tipo || datos.tipoPermiso)
        : undefined;
    const fechaInicioParsed = datos.fechaInicio
      ? parsearFecha(datos.fechaInicio)
      : undefined;
    const fechaFinParsed = datos.fechaFin
      ? parsearFecha(datos.fechaFin)
      : undefined;

    const archivoUrl = sanitizarArchivo(
      datos.archivoUrl || datos.customFileUrl
    );

    try {
      const actualizado = await prisma.permiso.update({
        where: { id },
        data: {
          cedula: datos.cedula ? String(datos.cedula).trim() : undefined,
          nombreFuncionario:
            datos.nombreFuncionario || datos.funcionario || undefined,
          cargo: datos.cargo || undefined,
          dependencia: datos.dependencia || undefined,
          tipo: tipoEnum,
          fechaInicio: fechaInicioParsed,
          fechaFin: fechaFinParsed,
          duracion: datos.duracion || datos.horasCalculadas || undefined,
          jornadaCompleta:
            typeof datos.jornadaCompleta === "boolean"
              ? datos.jornadaCompleta
              : undefined,
          hora24: datos.hora24 || undefined,
          justificacion: datos.justificacion || datos.motivo || undefined,
          motivoManuscrito: datos.motivoManuscrito || undefined,
          soporte: datos.soporte || datos.documentFileName || undefined,
          soporteUrl: datos.soporteUrl || undefined,
          archivoUrl: archivoUrl || undefined,
          archivoMimeType: datos.archivoMimeType || undefined,
          observaciones: datos.observaciones || undefined,
        },
      });

      return formatearParaFrontend(actualizado, false);
    } catch (e) {
      if (e.code === "P2025") return null; // No existe → 404 en el controller
      throw e;
    }
  },

  /**
   * Eliminar un permiso (por ID o radicado)
   */
  async eliminarPermiso(id) {
    try {
      await prisma.permiso.delete({ where: { id } });
      return true;
    } catch (e) {
      try {
        const permiso = await prisma.permiso.findFirst({
          where: { radicado: id },
        });
        if (permiso) {
          await prisma.permiso.delete({ where: { id: permiso.id } });
          return true;
        }
      } catch (err) {
        return false;
      }
      return false;
    }
  },

  /**
   * Dictamen de Gerencia: Aprobación o Rechazo
   */
  async dictaminarPermiso(id, { estado, aprobadoPor, observaciones }) {
    const actualizado = await prisma.permiso.update({
      where: { id },
      data: {
        estado,
        aprobadoPor: aprobadoPor || "Gerencia General Acuasan",
        observaciones: observaciones || undefined,
        fechaAprobacion: new Date(),
      },
    });

    return formatearParaFrontend(actualizado, false);
  },
};
