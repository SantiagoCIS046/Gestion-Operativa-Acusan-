import moment from "moment";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { randomUUID } from "crypto";
import Tesseract from "tesseract.js";
import { createObjectCsvWriter } from "csv-writer";
import prisma from "../../config/prisma.js";

const require = createRequire(import.meta.url);

// pdf-parse se carga perezosamente: el build que Vercel empaqueta en la
// función serverless referencia globals de navegador (DOMMatrix) durante su
// inicialización y mataría el proceso completo si se require al importar el
// módulo. Cargándolo bajo demanda, un entorno sin DOM degrada a la respuesta
// vacía honesta (el navegador hace la extracción) en vez de tumbar el API.
let _pdfParse = null;
const getPdfParse = () => {
  if (_pdfParse === null) {
    const pdfParseModule = require("pdf-parse");
    _pdfParse =
      typeof pdfParseModule === "function"
        ? pdfParseModule
        : pdfParseModule.default || pdfParseModule;
  }
  return _pdfParse;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auxiliares OCR & Limpieza
const limpiar = (str) =>
  (str || "")
    .replace(/^[:\s\-]+/, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const isBodySentence = (str) => {
  if (!str) return false;
  return /^(?:En atenci[oó]n|Una vez|Por medio|De acuerdo|En este sentido|deber[aá]|solicitar|mediante|que la|se evidencia|con el fin|respetuosamente|me permito|para la|jurisdicci[oó]n)/i.test(
    str.trim()
  );
};

// OCR de imágenes directamente con Tesseract.js (sin dependencias nativas ni disco).
// Los PDF escaneados se procesan en el navegador (pdfjs-dist + tesseract.js)
// y el texto extraído se envía al endpoint /extraer-campos para su parsing.
async function extraerTextoImagenConOCR(buffer) {
  try {
    const res = await Tesseract.recognize(buffer, "spa");
    return res?.data?.text || "";
  } catch (errWorker) {
    console.warn("⚠️ Error Tesseract OCR:", errWorker.message);
    return "";
  }
}

const extraerCamposPdf = (texto) => {
  const resultado = {
    numeroRadicadoPdf: "",
    fechaDocumento: "",
    lugarFecha: "",
    peticionario: "",
    dependencia: "",
    destinatario: "",
    asunto: "",
    referencia: "",
    contexto: "",
  };

  if (!texto || texto.trim().length === 0) return resultado;

  const rawLines = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. NÚMERO DE RADICADO PDF
  const mRad =
    texto.match(/(?:Rad(?:icado)?|No\.?|RAD)\s*[:.-]?\s*([0-9]{7,12})/i) ||
    texto.match(/\b(2[610]\d{7,9})\b/) ||
    texto.match(/\b([0-9]{8,12})\b/);
  if (mRad) resultado.numeroRadicadoPdf = mRad[1].trim();

  // 2. FECHA / HORA SELLO
  const mFechaSello = texto.match(
    /(?:FECHA|Fecha)\s*[:.-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
  );
  const mFechaHora = texto.match(
    /(\d{1,2}\/[a-zA-ZáéíóúÁÉÍÓÚ]{3,4}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i
  );
  const mFechaStd = texto.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);

  if (mFechaSello) resultado.fechaDocumento = mFechaSello[1].trim();
  else if (mFechaHora) resultado.fechaDocumento = mFechaHora[1].trim();
  else if (mFechaStd) resultado.fechaDocumento = mFechaStd[1].trim();

  // 3. LUGAR Y FECHA CARTA
  const mLugarF =
    texto.match(
      /((?:San Gil|Pinchote|Socorro|Bucaramanga|Bogot[aá])[^,\n\r]*,\s*\d{1,2}\s+(?:de\s+)?[a-zA-ZáéíóúÁÉÍÓÚ]+\s+(?:de\s+)?\d{4})/i
    ) ||
    texto.match(
      /([A-ZÁÉÍÓÚ][a-záéíóú]+,\s*\d{1,2}\s+de\s+[a-zA-Z]+\s+de\s+\d{4})/i
    );
  if (mLugarF) resultado.lugarFecha = mLugarF[1].trim();

  // 4. EMPRESA DESTINATARIA
  if (/ACUASAN/i.test(texto) || /ACUEDUCTO/i.test(texto)) {
    resultado.dependencia =
      "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.";
  } else {
    const mEmp = texto.match(/Se[ñn]ores\s*:\s*([^\n\r]+)/i);
    if (mEmp) resultado.dependencia = mEmp[1].trim();
  }

  // 5. PETICIONARIO & DESTINATARIO
  const mRem = texto.match(/Remitente\s*[:：]?\s*([^\n\r]+)/i);
  const mDest = texto.match(/Destinatario\s*[:：]?\s*([^\n\r]+)/i);

  if (mRem && !isBodySentence(mRem[1])) {
    resultado.peticionario = mRem[1].replace(/-\s*r\/l.*$/i, "").trim();
  }
  if (mDest && !isBodySentence(mDest[1])) {
    resultado.destinatario = mDest[1].trim();
  }

  if (!resultado.peticionario || isBodySentence(resultado.peticionario)) {
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (/^(?:SEÑORA|SEÑOR|SR|SRA)\s*:/i.test(line)) {
        let nombre = "";
        let cargo = "";
        for (let j = i + 1; j < Math.min(i + 4, rawLines.length); j++) {
          const nextL = rawLines[j];
          if (/REFERENCIA|ASUNTO|FECHA|San Gil|Pinchote/i.test(nextL)) break;
          if (
            nextL.length > 3 &&
            !/^\d+$/.test(nextL) &&
            !/@/.test(nextL) &&
            !/Celular/i.test(nextL)
          ) {
            if (!nombre && /^[A-ZÁÉÍÓÚ\s]+$/i.test(nextL) && nextL.length > 4) {
              nombre = nextL;
            } else if (
              nombre &&
              /PRESIDENTA|REPRESENTANTE|ALCALDE|GERENTE|JAC/i.test(nextL)
            ) {
              cargo = nextL;
            }
          }
        }
        if (nombre && !isBodySentence(nombre)) {
          resultado.peticionario = cargo ? `${nombre} - ${cargo}` : nombre;
          break;
        }
      }
    }
  }

  if (!resultado.peticionario || isBodySentence(resultado.peticionario)) {
    const mYo = texto.match(/Yo[,\s]+([A-ZÁÉÍÓÚ\s]{6,40})[,\s]+identificad/i);
    if (mYo) resultado.peticionario = mYo[1].trim();
  }

  if (!resultado.destinatario || isBodySentence(resultado.destinatario)) {
    resultado.destinatario = "ACUASAN E.I.C.E. - E.S.P.";
  }

  // 6. REFERENCIA
  const mRef =
    texto.match(/REFERENCIA\s*[:：]?\s*([^\n\r]+)/i) ||
    texto.match(/Referencia\s*[:：]?\s*([^\n\r]+)/i) ||
    texto.match(/(C[oó]digo de suscriptor[^\n\r]*)/i);

  if (mRef && !isBodySentence(mRef[1])) {
    resultado.referencia = mRef[1].trim();
  }

  // 7. ASUNTO
  const mAsunto = texto.match(/Asunto\s*[:：]?\s*([^\n\r]+)/i);
  if (mAsunto && !isBodySentence(mAsunto[1])) {
    resultado.asunto = mAsunto[1].trim();
  } else if (resultado.referencia) {
    resultado.asunto = resultado.referencia;
  } else {
    const mSolicitud = texto.match(/(Solicitud[^\n\r]+)/i);
    if (mSolicitud && !isBodySentence(mSolicitud[1]))
      resultado.asunto = mSolicitud[1].trim();
  }

  // 8. CONTEXTO
  const bodyLines = rawLines.filter((line) => {
    if (
      /^(?:REPUBLICA|DEPARTAMENTO|EMPRESA DE ACUEDUCTO|NIT|NUIR|San Gil,|Pinchote,|SEÑOR|SEÑORA|REFERENCIA:|E\s*950-|Rad\.|No\.|FECHA:)/i.test(
        line
      )
    )
      return false;
    if (/^[\s_.\-\=\*]+$/.test(line)) return false;
    if (line.length < 15 && !/[a-záéíóú]/i.test(line)) return false;
    return true;
  });

  let contextoTexto = "";
  const regexParrafoClave =
    /(?:En atenci[oó]n|Por medio|Solicit|Se solicita|Mediante|Yo,|Con el fin|Una vez|Respetado)[^\n\r]*[\s\S]{30,600}/i;
  const matchClave = texto.match(regexParrafoClave);

  if (matchClave && matchClave[0]) {
    contextoTexto = matchClave[0]
      .replace(/[\r\n]+/g, " ")
      .replace(/[\s._\-]{3,}/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  } else if (bodyLines.length > 0) {
    contextoTexto = bodyLines
      .slice(0, 4)
      .join(" ")
      .replace(/[\r\n]+/g, " ")
      .replace(/[\s._\-]{3,}/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  if (contextoTexto.length > 450) {
    let sub = contextoTexto.substring(0, 450);
    const lastPeriod = sub.lastIndexOf(".");
    if (lastPeriod > 200) sub = sub.substring(0, lastPeriod + 1);
    else {
      const lastSpace = sub.lastIndexOf(" ");
      if (lastSpace > 200) sub = sub.substring(0, lastSpace) + "...";
    }
    contextoTexto = sub;
  }

  resultado.contexto = contextoTexto || "";

  // 9. DÍAS PARA VENCER
  let diasSugeridos = 10;
  const mPlazoNum = texto.match(
    /(?:plazo|t[eé]rmino|tiempo|vence|vencimiento|en|dentro de)\s*(?:un\s+t[eé]rmino\s+de\s*)?(?:de\s*)?\b([0-9]{1,2})\b\s*d[ií]as/i
  );
  if (mPlazoNum && mPlazoNum[1]) {
    const num = parseInt(mPlazoNum[1], 10);
    if ([3, 5, 10, 15, 30].includes(num)) diasSugeridos = num;
    else if (num <= 4) diasSugeridos = 3;
    else if (num <= 7) diasSugeridos = 5;
    else if (num <= 12) diasSugeridos = 10;
    else if (num <= 20) diasSugeridos = 15;
    else diasSugeridos = 30;
  } else {
    if (
      /tutela|urgente|inmediato|derecho de petici[oó]n prioritario/i.test(texto)
    )
      diasSugeridos = 3;
    else if (/informaci[oó]n|copias|documentos/i.test(texto))
      diasSugeridos = 10;
    else if (
      /consulta|viabilidad|disponibilidad|reclamo|queja|peticion/i.test(texto)
    )
      diasSugeridos = 15;
  }

  resultado.diasParaVencer = diasSugeridos;

  if (isBodySentence(resultado.peticionario)) resultado.peticionario = "";
  if (isBodySentence(resultado.destinatario))
    resultado.destinatario = "ACUASAN E.I.C.E. - E.S.P.";
  if (isBodySentence(resultado.asunto))
    resultado.asunto = resultado.referencia || "";

  return resultado;
};

// Respuesta vacía y honesta cuando no hay texto legible (sin datos inventados)
const respuestaSinTexto = (metodo, originalname) => ({
  mensaje:
    "El documento no contiene texto legible. Complete los campos manualmente.",
  metodo,
  peticionario: "",
  dependencia: "",
  registradoPor: "Encargada",
  contexto: "",
  numeroRadicadoPdf: "",
  fechaDocumento: "",
  lugarFecha: "",
  destinatario: "",
  asunto: "",
  referencia: "",
  diasParaVencer: null,
  nombreArchivo: originalname || "documento.pdf",
});

// Estados válidos de un radicado (el alta offline puede sincronizar un estado distinto de Pendiente)
const ESTADOS_RADICADO_VALIDOS = ["Pendiente", "En Proceso", "Resuelto", "Contestado", "Anulado"];

export const RadicadosService = {
  /**
   * Lista todos los radicados SIN el archivo Base64 (peso).
   * El documento original se sirve bajo demanda desde /:id/archivo.
   */
  async obtenerTodos() {
    try {
      const dbRadicados = await prisma.radicado.findMany({
        orderBy: { fechaRadicacion: "desc" },
      });
      return dbRadicados.map(({ archivoBase64, ...resto }) => ({
        ...resto,
        hasArchivo: Boolean(archivoBase64),
      }));
    } catch (e) {
      // Error real de BD: se propaga (el cliente usa su caché local, nunca datos inventados)
      throw new Error(`Base de datos no disponible: ${e.message}`);
    }
  },

  /**
   * Obtiene un radicado completo (incluye archivoBase64) por ID o numeroRadicado
   */
  async obtenerPorId(id) {
    try {
      return await prisma.radicado.findUnique({ where: { id: String(id) } });
    } catch (e) {
      try {
        return await prisma.radicado.findFirst({
          where: { numeroRadicado: String(id) },
        });
      } catch (err) {
        return null;
      }
    }
  },

  /**
   * Genera el siguiente radicado secuencial real de la BD: RAD-<anio>-000X
   * (máximo consecutivo + reintentos, sin colisiones por registros borrados)
   */
  async generarRadicadoUnico() {
    const anio = new Date().getFullYear();
    const prefijo = `RAD-${anio}-`;

    const existentes = await prisma.radicado.findMany({
      where: { numeroRadicado: { startsWith: prefijo } },
      select: { numeroRadicado: true },
    });

    let maxSeq = 0;
    for (const r of existentes) {
      const m = r.numeroRadicado.match(new RegExp(`^${prefijo}(\\d+)$`));
      if (m) {
        const seq = parseInt(m[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }

    for (let intento = 1; intento <= 5; intento++) {
      const candidato = `${prefijo}${String(maxSeq + intento).padStart(4, "0")}`;
      const yaExiste = await prisma.radicado.findFirst({
        where: { numeroRadicado: candidato },
      });
      if (!yaExiste) return candidato;
    }

    // Último recurso: timestamp
    return `${prefijo}${Date.now()}`;
  },

  async crear(payload) {
    const {
      peticionario,
      dependencia,
      correoDrive,
      registradoPor,
      contexto,
      diasParaVencer,
      archivoNombre,
      destinatario,
      asunto,
      referencia,
      fechaDocumento,
      lugarFecha,
      numeroRadicadoPdf,
      archivoBase64,
      archivoUrl,
      idLocal,
    } = payload;

    // IDEMPOTENCIA: si la sincronización offline ya creó este registro (la respuesta
    // se perdió y el cliente reintentó), se devuelve el registro existente sin duplicar.
    if (idLocal) {
      const existente = await prisma.radicado.findFirst({ where: { idLocal: String(idLocal) } });
      if (existente) {
        console.warn(`Radicado idempotente: idLocal=${idLocal} ya existe como ${existente.numeroRadicado}`);
        return existente;
      }
    }

    const fechaVencimiento = moment()
      .add(parseInt(diasParaVencer) || 10, "days")
      .toDate();

    // El estado puede venir de un alta offline que ya cambió de estado (ej. Resuelto)
    const estadoInicial = ESTADOS_RADICADO_VALIDOS.includes(payload.estado)
      ? payload.estado
      : "Pendiente";

    // ⚠️ No enviar `id`: el schema define id como ObjectId autogenerado por MongoDB.
    // Enviarlo causa error de validación y el radicado NUNCA se persistía en la BD.
    const itemData = {
      peticionario,
      dependencia,
      correoDrive: correoDrive || "encargada@acuasan.gov.co",
      registradoPor: registradoPor || "Encargada",
      contexto: contexto || "Registro documental de radicación.",
      destinatario: destinatario || null,
      asunto: asunto || null,
      referencia: referencia || null,
      fechaDocumento: fechaDocumento || null,
      lugarFecha: lugarFecha || null,
      numeroRadicadoPdf: numeroRadicadoPdf || null,
      fechaRadicacion: new Date(),
      fechaVencimiento,
      estado: estadoInicial,
      archivoNombre: archivoNombre || null,
      archivoUrl: archivoUrl || null,
      archivoBase64: archivoBase64 || null,
      // NUNCA null: el índice único de MongoDB indexaría null como valor y solo
      // cabría un documento sin idLocal en toda la colección (P2002 masivo).
      idLocal: String(idLocal || randomUUID()),
    };

    // Radicado secuencial RAD-AAAA-0001 generado por el backend (fuente de verdad).
    // Reintento real ante colisión concurrente (P2002 en numeroRadicado): se
    // regenera el consecutivo; NUNCA se responde con un registro solo en memoria.
    let ultimoError = null;
    for (let intento = 1; intento <= 4; intento++) {
      let numeroRadicado;
      try {
        numeroRadicado = await this.generarRadicadoUnico();
      } catch (eCount) {
        throw new Error(`No se pudo generar la numeración del radicado: ${eCount.message}`);
      }

      try {
        return await prisma.radicado.create({
          data: { ...itemData, numeroRadicado },
        });
      } catch (e) {
        ultimoError = e;
        const esColision = e.code === "P2002";
        if (!esColision) break;
        console.warn(
          `Colisión de numeración (intento ${intento}/4), regenerando consecutivo: ${e.message}`
        );
      }
    }

    throw new Error(
      `No se pudo persistir el radicado en la base de datos: ${ultimoError?.message || "error desconocido"}`
    );
  },

  async actualizarEstado(id, estado) {
    try {
      return await prisma.radicado.update({
        where: { id: String(id) },
        data: { estado },
      });
    } catch (e) {
      // Si falla (ej. id no es un ObjectId válido), intentar localizar por numeroRadicado
      try {
        const porNumero = await prisma.radicado.findFirst({
          where: { numeroRadicado: String(id) },
        });
        if (porNumero) {
          return await prisma.radicado.update({
            where: { id: porNumero.id },
            data: { estado },
          });
        }
        // No existe en la BD (posible provisional local aún sin sincronizar)
        return null;
      } catch (e2) {
        throw new Error(`Base de datos no disponible: ${e2.message}`);
      }
    }
  },

  /**
   * Elimina un radicado por ID o numeroRadicado.
   * Solo lo puede ejecutar la encargada de Radicados (controlado en ruta/middleware).
   */
  async eliminar(id) {
    try {
      return await prisma.radicado.delete({
        where: { id: String(id) },
      });
    } catch (e) {
      // Intentar por numeroRadicado si el id no es un ObjectId válido
      try {
        const porNumero = await prisma.radicado.findFirst({
          where: { numeroRadicado: String(id) },
        });
        if (porNumero) {
          return await prisma.radicado.delete({
            where: { id: porNumero.id },
          });
        }
        return null;
      } catch (e2) {
        throw new Error(`Error al eliminar el radicado: ${e2.message}`);
      }
    }
  },


  async parsearTexto(texto, originalname) {
    const campos = extraerCamposPdf(texto);
    return {
      mensaje: "Texto del documento analizado exitosamente",
      metodo: "OCR navegador + parser servidor",
      peticionario: campos.peticionario || "",
      dependencia: campos.dependencia || "",
      registradoPor: "Encargada",
      contexto: campos.contexto || "",
      numeroRadicadoPdf: campos.numeroRadicadoPdf || "",
      fechaDocumento: campos.fechaDocumento || "",
      lugarFecha: campos.lugarFecha || "",
      destinatario: campos.destinatario || "",
      asunto: campos.asunto || "",
      referencia: campos.referencia || "",
      diasParaVencer: campos.diasParaVencer || 10,
      nombreArchivo: originalname || "documento.pdf",
    };
  },

  /**
   * Extracción desde el buffer del archivo (endpoint legado /extraer-pdf).
   * PDFs vectoriales vía pdf-parse; imágenes vía Tesseract.js.
   * Los PDFs escaneados (sin capa de texto) devuelven respuesta vacía honesta:
   * el OCR de esos documentos lo realiza el navegador.
   */
  async extraerPdf(dataBuffer, mimeType, originalname) {
    let texto = "";
    let metodo = "";

    if (mimeType === "application/pdf" || !mimeType) {
      try {
        const data = await getPdfParse()(dataBuffer);
        texto = (data.text || "").trim();
        if (texto.length > 40) {
          metodo = "pdf-parse";
        } else {
          texto = "";
        }
      } catch (errPdf) {
        console.warn(
          "pdf-parse no extrajo texto suficiente — el documento escaneado debe procesarse desde el navegador"
        );
        texto = "";
      }
    } else if (mimeType && mimeType.startsWith("image/")) {
      try {
        texto = await extraerTextoImagenConOCR(dataBuffer);
        metodo = "OCR (Tesseract.js)";
      } catch (errOCR) {
        console.error("Error en OCR:", errOCR.message);
        texto = "";
      }
    }

    if (!texto) {
      return respuestaSinTexto("documento-escaneado-sin-texto", originalname);
    }

    const campos = extraerCamposPdf(texto);

    return {
      mensaje: `Documento procesado exitosamente (método: ${metodo})`,
      metodo,
      peticionario: campos.peticionario || "",
      dependencia: campos.dependencia || "",
      registradoPor: "Encargada",
      contexto: campos.contexto || "",
      numeroRadicadoPdf: campos.numeroRadicadoPdf || "",
      fechaDocumento: campos.fechaDocumento || "",
      lugarFecha: campos.lugarFecha || "",
      destinatario: campos.destinatario || "",
      asunto: campos.asunto || "",
      referencia: campos.referencia || "",
      diasParaVencer: campos.diasParaVencer || 10,
      nombreArchivo: originalname || "documento.pdf",
    };
  },

  async generarExcel() {
    const radicados = await prisma.radicado.findMany({
      orderBy: { fechaRadicacion: "desc" },
    });
    const fileName = `Historial_Radicados_${moment().format("YYYY-MM-DD")}.csv`;
    // Escribir en /tmp (único directorio escribible en entornos serverless)
    const filePath = path.join(os.tmpdir(), fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "numeroRadicado", title: "CODIGO RADICADO SISTEMA" },
        { id: "numeroRadicadoPdf", title: "NUMERO RADICADO PDF" },
        { id: "fechaRadicacion", title: "FECHA REGISTRO" },
        { id: "fechaDocumento", title: "FECHA/HORA DOCUMENTO" },
        { id: "lugarFecha", title: "LUGAR Y FECHA CARTA" },
        { id: "peticionario", title: "REMITENTE / PETICIONARIO" },
        { id: "dependencia", title: "EMPRESA DESTINATARIA" },
        { id: "destinatario", title: "DESTINATARIO (FUNCIONARIO)" },
        { id: "asunto", title: "ASUNTO" },
        { id: "referencia", title: "REFERENCIA" },
        { id: "registradoPor", title: "REGISTRADO POR" },
        { id: "estado", title: "ESTADO" },
        { id: "fechaVencimiento", title: "FECHA VENCIMIENTO" },
        { id: "contexto", title: "CONTEXTO DE PETICION" },
      ],
    });

    const recordsFormatted = radicados.map((r) => ({
      numeroRadicado: r.numeroRadicado,
      numeroRadicadoPdf: r.numeroRadicadoPdf || "N/A",
      fechaRadicacion: moment(r.fechaRadicacion).format("YYYY-MM-DD HH:mm"),
      fechaDocumento: r.fechaDocumento || "N/A",
      lugarFecha: r.lugarFecha || "N/A",
      peticionario: r.peticionario,
      dependencia: r.dependencia,
      destinatario: r.destinatario || "N/A",
      asunto: r.asunto || "N/A",
      referencia: r.referencia || "N/A",
      registradoPor: r.registradoPor || r.peticionario || "Encargada",
      estado: r.estado,
      fechaVencimiento: moment(r.fechaVencimiento).format("YYYY-MM-DD"),
      contexto: (r.contexto || "").replace(/\n/g, " "),
    }));

    await csvWriter.writeRecords(recordsFormatted);
    return { filePath, fileName };
  },
};
