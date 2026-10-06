/**
 * ============================================================================
 * NÚCLEO DE OCR EN EL NAVEGADOR (compartido) — ACUASAN E.S.P.
 * ============================================================================
 * Lee el documento que el usuario selecciona y extrae su texto preservando
 * la estructura espacial real (columnas, sellos, bloques). Es la ruta de
 * PRODUCCIÓN: corre en el equipo del usuario y el parseo de campos lo hace
 * el backend Node (/api/radicados/extraer-campos[-respuesta] y
 * /api/ocr/extraer-campos-permisos). Este módulo devuelve texto fiel al
 * documento — nunca interpreta ni inventa.
 *
 *   1. PDF con texto embebido (digital) → pdfjs-dist reconstruye líneas
 *      agrupando items por posición Y real, respetando columnas.
 *   2. PDF escaneado → pdfjs renderiza a canvas y tesseract.js hace OCR en
 *      español. Si la config lo pide (radicados), un pase extra sobre el 38%
 *      superior de la página 1 recupera el sello físico de radicación.
 *   3. Imágenes PNG/JPG → OCR directo con preprocesamiento de contraste.
 *
 * Optimizaciones frente al motor original (ocrRadicados.js):
 *   · Worker de tesseract SINGLETON: se crea una sola vez y se reutiliza en
 *     todas las páginas y pasadas (antes se recreaba por pasada, pagando la
 *     inicialización del wasm cada vez). Se auto-libera tras 3 min de inactividad.
 *   · PSM por setParameters (no recreando el worker).
 *   · Escala 2.0 en páginas completas (la letra de cuerpo no necesita 4.4 MP);
 *     el 3.0 se reserva para el pase del sello.
 *   · Preprocesamiento CONDICIONAL: escala de grises + stretch siempre, Otsu
 *     solo cuando el escaneo tiene muchos tonos medios (letra borrosa). La
 *     binarización incondicional destruía el antialiasing de renders nítidos.
 *   · preserve_interword_spaces=1: los parsers usan el doble espacio como
 *     marca de columna ("CARGO X  ÁREA Y").
 * ============================================================================
 */

const TOLERANCIA_Y = 4; // pt: diferencia de Y para considerar misma línea
const IDLE_MS = 3 * 60 * 1000; // el worker muere tras 3 min sin uso (RAM ~50-80 MB)

// ── Config por módulo ────────────────────────────────────────────────────────
export const CONFIG_RADICADOS = {
  maxPages: 4, // el sello siempre está en la 1ª; anexos hasta la 4ª
  escalaPagina: 2.0,
  paseSello: true, // pase extra sobre el encabezado de la pág. 1
  escalaSello: 3.0, // letra pequeña del sticker (6-8pt) necesita zoom
  // Un PDF digital se acepta tal cual si además de ≥150 chars trae señales
  // claras de documento de radicado (mismos patrones del motor original).
  patronesDigitales: [
    /RADICADO/i,
    /ASUNTO|REFERENCIA/i,
    /SE[NÑ]OR|REMITENTE|PETICIONARIO|NOMBRE/i,
  ],
};

export const CONFIG_PERMISOS = {
  maxPages: 2, // el formulario vive en la pág. 1; anexo ocasional en la 2
  escalaPagina: 2.0,
  paseSello: false, // los permisos no traen sticker de radicación
  escalaSello: 3.0,
  patronesDigitales: [
    /PERMISO/i,
    /NOMBRE COMPLETO|FUNCIONARIO|SUSCRITO/i,
    /CEDULA|C[EÉ]DULA/i,
    /CARGO|MOTIVO|TIPO DE PERMISO|FECHA|JORNADA/i,
  ],
};

// Solo radicados: señal de que el texto ya contiene el número de radicación.
const PATRON_RADICADO = /(?:radicad|2[0-9OolI|]{8,10})/i;

// ── pdfjs (singleton) ────────────────────────────────────────────────────────
let pdfjsCache = null;
const getPdfjs = async () => {
  if (pdfjsCache) return pdfjsCache;
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const m = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = m.default;
    } catch {
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }
  }
  pdfjsCache = pdfjs;
  return pdfjs;
};

// ── Worker de tesseract (singleton persistente) ──────────────────────────────
let tesseractCache = null; // { createWorker, PSM }
let workerPromise = null; // Promise<Worker> — cacheada para evitar doble creación
let idleTimer = null;
let ultimoOnEtapa = null; // el logger del worker reenvía al callback vigente

const cargarTesseract = async () => {
  if (!tesseractCache) tesseractCache = await import("tesseract.js");
  return tesseractCache;
};

const resetIdleTimer = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // Liberar RAM en equipos modestos; el próximo escaneo lo recrea (y ya
    // con el idioma en IndexedDB, la espera es de un par de segundos).
    workerPromise?.then((w) => w.terminate().catch(() => {})).catch(() => {});
    workerPromise = null;
    idleTimer = null;
  }, IDLE_MS);
};

const getWorker = async (onEtapa) => {
  ultimoOnEtapa = onEtapa || null;
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await cargarTesseract();
      return createWorker("spa", 1, {
        logger: (m) => {
          if (m?.status && typeof m.progress === "number") {
            try {
              ultimoOnEtapa?.(m.status, m.progress);
            } catch (_) {}
          }
        },
      });
    })().catch((e) => {
      workerPromise = null; // falló la creación: el próximo intento reintenta
      throw e;
    });
  }
  resetIdleTimer();
  return workerPromise;
};

/** Cambia el PSM del worker compartido sin recrearlo. */
const conPSM = async (psm, onEtapa) => {
  const { PSM } = await cargarTesseract();
  const modos = {
    auto: PSM.AUTO,
    bloque: PSM.SINGLE_BLOCK,
    disperso: PSM.SPARSE_TEXT,
  };
  const worker = await getWorker(onEtapa);
  await worker.setParameters({
    tessedit_pageseg_mode: modos[psm] ?? PSM.AUTO,
    user_defined_dpi: "300",
    preserve_interword_spaces: "1",
  });
  return worker;
};

const ocrCanvas = async (worker, canvas) => {
  const { data } = await worker.recognize(canvas);
  return { texto: (data?.text || "").trim(), confianza: Number(data?.confidence) || 0 };
};

/**
 * OCR de un canvas con el worker compartido: pasada AUTO y, solo si dio muy
 * poco texto, una dispersa; gana la de MAYOR CONFIANZA (lo verboso no es lo
 * correcto). Si el worker muere a mitad de pase, se descarta el singleton y
 * se reintenta una vez con uno fresco.
 */
const ocrMultimodo = async (canvas, onProgreso) => {
  try {
    const worker = await conPSM("auto", (status, p) => onProgreso?.(`OCR: ${status}`, p));
    const auto = await ocrCanvas(worker, canvas);
    if (auto.texto.replace(/\s/g, "").length >= 20) return auto.texto;

    const workerDisperso = await conPSM("disperso", (status, p) =>
      onProgreso?.(`OCR disperso: ${status}`, p)
    );
    const disperso = await ocrCanvas(workerDisperso, canvas);
    if (auto.texto && auto.confianza > disperso.confianza) return auto.texto;
    return disperso.texto;
  } catch (e) {
    // Worker en mal estado (pestaña suspendida, OOM): liberar y reintentar.
    workerPromise?.then((w) => w.terminate().catch(() => {})).catch(() => {});
    workerPromise = null;
    const worker = await conPSM("auto", (status, p) => onProgreso?.(`OCR: ${status}`, p));
    const reintento = await ocrCanvas(worker, canvas);
    return reintento.texto;
  }
};

// ── Preprocesamiento condicional ─────────────────────────────────────────────
/**
 * Escala de grises + stretch de histograma SIEMPRE y, solo cuando el escaneo
 * tiene muchos tonos medios (letra borrosa, fondo sucio), binarización Otsu
 * que afila el borde de la tinta. En imágenes limpias (render digital nítido)
 * no se binariza: el antialiasing ayuda al OCR.
 */
const preprocesarCanvasParaOCR = (src) => {
  const w = src.width;
  const h = src.height;
  const dst = document.createElement("canvas");
  dst.width = w;
  dst.height = h;
  const ctx = dst.getContext("2d");
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, w, h);
  const px = d.data;

  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  let min = 255;
  let max = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] < min) min = px[i];
    if (px[i] > max) max = px[i];
  }
  const rng = max - min || 1;
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(255, Math.round(((px[i] - min) / rng) * 255));
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }

  // Otsu condicional: umbral óptimo por varianza entre clases, aplicado solo
  // si >25% de los píxeles quedaron en la zona media (51-204) del histograma.
  const total = Math.floor(px.length / 4);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < px.length; i += 4) hist[px[i]]++;
  let sumaTotal = 0;
  for (let t = 0; t < 256; t++) sumaTotal += t * hist[t];
  let sumaB = 0;
  let pesoB = 0;
  let maxVar = -1;
  let umbral = 128;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t];
    if (pesoB === 0) continue;
    const pesoF = total - pesoB;
    if (pesoF === 0) break;
    sumaB += t * hist[t];
    const mB = sumaB / pesoB;
    const mF = (sumaTotal - sumaB) / pesoF;
    const varianza = pesoB * pesoF * (mB - mF) * (mB - mF);
    if (varianza > maxVar) {
      maxVar = varianza;
      umbral = t;
    }
  }
  let zonaMedia = 0;
  for (let t = 51; t < 204; t++) zonaMedia += hist[t];
  if (total > 0 && zonaMedia / total > 0.25) {
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i] <= umbral ? 0 : 255;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
  }

  ctx.putImageData(d, 0, 0);
  return dst;
};

// ── Extracción estructurada de texto de una página pdfjs ─────────────────────
/**
 * Agrupa los items de texto por líneas lógicas según la posición Y del
 * viewport. Dentro de cada línea ordena por X para respetar columnas y marca
 * los saltos de columna con doble espacio (los parsers los usan).
 */
const extraerTextoPagina = async (page) => {
  const content = await page.getTextContent({ includeMarkedContent: false });
  const viewport = page.getViewport({ scale: 1 });
  const altoPagina = viewport.height;

  const items = content.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: altoPagina - it.transform[5],
      ancho: it.width || 0,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  if (!items.length) return "";

  const lineas = [];
  let lineaActual = [items[0]];
  let yRef = items[0].y;

  for (let i = 1; i < items.length; i++) {
    const it = items[i];
    if (Math.abs(it.y - yRef) <= TOLERANCIA_Y) {
      lineaActual.push(it);
    } else {
      lineas.push(lineaActual.sort((a, b) => a.x - b.x));
      lineaActual = [it];
      yRef = it.y;
    }
  }
  if (lineaActual.length) lineas.push(lineaActual.sort((a, b) => a.x - b.x));

  return lineas
    .map((linea) => {
      let resultado = "";
      for (let i = 0; i < linea.length; i++) {
        if (i === 0) {
          resultado = linea[i].str;
        } else {
          const prev = linea[i - 1];
          const gap = linea[i].x - (prev.x + prev.ancho);
          resultado += (gap > 8 ? "  " : " ") + linea[i].str;
        }
      }
      return resultado.trimEnd();
    })
    .filter((l) => l.trim())
    .join("\n");
};

// ── Renderizado ──────────────────────────────────────────────────────────────
const renderizarPaginaACanvas = async (page, escala) => {
  const viewport = page.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
};

// Solo el encabezado (38% superior) donde residen los sellos de radicación.
const renderizarEncabezadoACanvas = async (page, escala) => {
  const viewport = page.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = Math.round(viewport.height * 0.38);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
};

// ── Imagen seleccionada por el usuario ───────────────────────────────────────
const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No fue posible abrir la imagen del documento"));
    img.src = src;
  });

const imagenACanvas = (img) => {
  // Zoom óptico para maximizar nitidez de letra pequeña
  const escala = Math.max(2.0, 2600 / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

// ── API pública ───────────────────────────────────────────────────────────────
export const ocrNavegador = {
  /**
   * Precalienta el worker (idioma spa + wasm) fuera del camino crítico —
   * lo llama el warmup al abrir el file picker: la primera descarga del
   * idioma (~10-15 MB) se paga ahí, no durante el escaneo.
   */
  async prepararWorker() {
    try {
      await conPSM("auto", null);
    } catch (_) {
      /* fire-and-forget: si falla, el escaneo real reintenta */
    }
  },

  /** Termina el worker de inmediato (pruebas / descarte explícito). */
  async terminarWorker() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    const promesa = workerPromise;
    workerPromise = null;
    await promesa?.then((w) => w.terminate().catch(() => {})).catch(() => {});
  },

  /**
   * Extrae el texto de un File (PDF, imagen o texto plano).
   *
   * @param {File} file              Documento seleccionado por el usuario
   * @param {Object} config          CONFIG_RADICADOS | CONFIG_PERMISOS
   * @param {Function} onEtapa       Callback (etapa:string, progreso:0..1)
   * @returns {Promise<{texto:string, metodo:string}>}
   */
  async extraerTexto(file, config = CONFIG_RADICADOS, onEtapa = () => {}) {
    const reportar = (etapa, progreso) => {
      try {
        onEtapa(String(etapa), Math.max(0, Math.min(1, progreso || 0)));
      } catch (_) {}
    };

    // ── Texto plano ────────────────────────────────────────────────────────
    if (file.type.startsWith("text/") || /\.(txt|csv|md)$/i.test(file.name)) {
      reportar("Leyendo texto plano", 0.5);
      const texto = await file.text();
      reportar("Lectura completa", 1);
      return { texto, metodo: "Archivo de texto" };
    }

    // ── Imagen ────────────────────────────────────────────────────────────
    if (file.type.startsWith("image/")) {
      reportar("Abriendo imagen", 0.05);
      const url = URL.createObjectURL(file);
      try {
        const img = await cargarImagen(url);
        const canvas = imagenACanvas(img);
        const procesado = preprocesarCanvasParaOCR(canvas);
        reportar("Reconociendo texto (OCR)", 0.2);
        const texto = await ocrMultimodo(procesado, (etapa, p) =>
          reportar(etapa, 0.2 + p * 0.75)
        );
        reportar("Lectura completa", 1);
        return { texto, metodo: "OCR de imagen" };
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    // ── PDF ───────────────────────────────────────────────────────────────
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      reportar("Abriendo PDF", 0.05);
      const pdfjs = await getPdfjs();
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: buffer, useSystemFonts: true });
      const doc = await loadingTask.promise;

      try {
        const totalPags = Math.min(doc.numPages, config.maxPages);

        // ── INTENTO 1: texto digital embebido (≥150 chars + señales del
        //    tipo de documento según la config) — instantáneo, sin OCR.
        reportar("Leyendo texto del PDF…", 0.1);
        let textoDigital = "";
        for (let i = 1; i <= totalPags; i++) {
          const page = await doc.getPage(i);
          try {
            textoDigital += (await extraerTextoPagina(page)) + "\n\n";
          } finally {
            page.cleanup();
          }
          reportar(`Procesando página ${i} de ${totalPags}`, 0.1 + (i / totalPags) * 0.25);
        }
        const charsDigital = textoDigital.replace(/\s/g, "").length;
        const tieneTextoDigitalRico =
          charsDigital >= 150 &&
          config.patronesDigitales.some((p) => p.test(textoDigital));

        if (tieneTextoDigitalRico) {
          reportar("Lectura digital completada", 1);
          return {
            texto: textoDigital.trim(),
            metodo: "Lectura digital directa (instantánea)",
          };
        }

        // ── INTENTO 2: PDF escaneado o mixto → OCR de páginas ─────────────
        reportar("Documento escaneado — ejecutando OCR…", 0.3);
        let textoOcr = "";
        for (let i = 1; i <= totalPags; i++) {
          const page = await doc.getPage(i);
          try {
            const canvas = await renderizarPaginaACanvas(page, config.escalaPagina);
            const procesado = preprocesarCanvasParaOCR(canvas);
            canvas.width = 0; // libera el bitmap original

            const base = 0.3 + ((i - 1) / totalPags) * 0.65;
            const ancho = 0.65 / totalPags;
            const textoPagina = await ocrMultimodo(procesado, (etapa, p) =>
              reportar(`Pág ${i}: ${etapa}`, base + p * ancho)
            );
            textoOcr += `\n--- PÁGINA ${i} ---\n` + textoPagina + "\n\n";
            procesado.width = 0;
          } finally {
            page.cleanup();
          }
        }

        let textoFinal = (textoDigital.trim() ? `${textoDigital.trim()}\n\n` : "") + textoOcr.trim();

        // ── Pase del sello (solo radicados): si ninguna página trajo el
        //    patrón de radicado, el sticker físico pudo quedar ilegible en el
        //    OCR de página completa. Un pase PSM bloque sobre el 38% superior
        //    de la página 1 con zoom alto es barato y lo recupera; su texto
        //    solo se antepone si trae el patrón.
        if (config.paseSello && !PATRON_RADICADO.test(textoFinal)) {
          reportar("Buscando el sello de radicación…", 0.96);
          const page1 = await doc.getPage(1);
          try {
            const canvasSello = await renderizarEncabezadoACanvas(page1, config.escalaSello);
            const procesadoSello = preprocesarCanvasParaOCR(canvasSello);
            canvasSello.width = 0;
            const workerSello = await conPSM("bloque", (status, p) =>
              reportar(`Sello: ${status}`, 0.96 + p * 0.03)
            );
            const sello = await ocrCanvas(workerSello, procesadoSello);
            procesadoSello.width = 0;
            if (sello.texto && PATRON_RADICADO.test(sello.texto)) {
              textoFinal = `${sello.texto.trim()}\n\n${textoFinal}`;
            }
          } finally {
            page1.cleanup();
          }
        }
        reportar("Lectura completa", 1);
        return {
          texto: textoFinal.trim(),
          metodo: `OCR de alta precisión (${totalPags} pág.)`,
        };
      } finally {
        try {
          await loadingTask.destroy();
        } catch (_) {}
      }
    }

    throw new Error(
      `Tipo de documento no soportado: ${file.type || file.name}. Llene los campos manualmente o convierta el documento a PDF.`
    );
  },
};

export default ocrNavegador;
