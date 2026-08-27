/**
 * ============================================================================
 * MOTOR DE LECTURA DE RADICADOS (NAVEGADOR) — ACUASAN E.S.P.
 * ============================================================================
 * Lee el documento que el usuario selecciona y extrae su texto preservando
 * la estructura espacial real del documento (columnas, sellos, bloques).
 *
 *   1. PDF con texto embebido (digital)   → pdfjs-dist reconstruye líneas
 *      agrupando items por posición Y real (tolerancia 3 pt), respetando
 *      columnas y saltos de párrafo.
 *   2. PDF escaneado (sin texto / < 40 chars útiles) → pdfjs renderiza a
 *      canvas con escala alta y tesseract.js hace OCR en español con PSM 6
 *      (bloque de texto uniforme) para sellos y PSM 11 (texto disperso)
 *      como respaldo.
 *   3. Imágenes PNG/JPG → OCR directo con preprocesamiento de contraste.
 *
 * El texto resultante viaja a /api/radicados/extraer-campos donde el parser
 * de backend lo convierte en campos institucionales. Este módulo devuelve
 * texto fiel al documento — nunca interpreta ni inventa.
 * ============================================================================
 */

const MAX_PAGINAS = 4; // Páginas a leer: el sello siempre está en la 1ª
const ESCALA_OCR = 2.7; // Factor de zoom y ampliación de resolución para leer sellos con letra pequeña (6-8pt)
const TOLERANCIA_Y = 4; // pt: diferencia de Y para considerar misma línea

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

// ── Extracción estructurada de texto de una página pdfjs ────────────────────
/**
 * Agrupa los items de texto por líneas lógicas basándose en la posición Y del
 * viewport (no en hasEOL que es poco fiable). Dentro de cada línea ordena por
 * X para respetar columnas. Devuelve el texto de la página con saltos reales.
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

// ── Worker de tesseract de alta velocidad ─────────────────────────────────────
const crearWorker = async (psm, onProgreso) => {
  const { createWorker, PSM } = await import("tesseract.js");
  const modosPSM = {
    auto: PSM.AUTO,
    bloque: PSM.SINGLE_BLOCK,
    disperso: PSM.SPARSE_TEXT,
  };
  const worker = await createWorker("spa", 1, {
    logger: (m) => {
      if (m?.status && typeof m.progress === "number") {
        onProgreso?.(m.status, m.progress);
      }
    },
  });
  await worker.setParameters({
    tessedit_pageseg_mode: modosPSM[psm] ?? PSM.AUTO,
    user_defined_dpi: "300",
  });
  return worker;
};

const ocrCanvas = async (worker, canvas) => {
  const { data } = await worker.recognize(canvas);
  return (data?.text || "").trim();
};

/**
 * Preprocesa un canvas para OCR: convierte a escala de grises y binariza (Otsu).
 */
const preprocesarCanvasParaOCR = (src) => {
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext("2d");
  ctx.drawImage(src, 0, 0);
  const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imgData.data;

  const gris = new Uint8Array(d.length / 4);
  for (let i = 0; i < gris.length; i++) {
    gris[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  }

  const hist = new Array(256).fill(0);
  for (const g of gris) hist[g]++;
  const total = gris.length;
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * hist[i];
  let sumB = 0, wB = 0, maxVarianza = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumTotal - sumB) / wF;
    const varianza = wB * wF * (mB - mF) ** 2;
    if (varianza > maxVarianza) { maxVarianza = varianza; umbral = t; }
  }

  for (let i = 0; i < gris.length; i++) {
    const v = gris[i] < umbral ? 0 : 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return dst;
};

// ── OCR ultra-rápido (1 pasada por defecto) ──────────────────────────────────
const ocrMultimodo = async (canvas, onProgreso) => {
  let worker = null;
  try {
    worker = await crearWorker("auto", (status, p) =>
      onProgreso?.(`OCR: ${status}`, p)
    );
    const texto = await ocrCanvas(worker, canvas);
    const chars = (texto || "").replace(/\s/g, "").length;
    if (chars >= 20) return texto;

    // Respaldo rápido solo si la primera pasada dio muy poco texto
    await worker.terminate().catch(() => {});
    worker = await crearWorker("disperso", (status, p) =>
      onProgreso?.(`OCR disperso: ${status}`, p)
    );
    return await ocrCanvas(worker, canvas);
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
};

// ── Renderizado optimizado (solo el encabezado del 38% superior donde están los sellos) ──
const renderizarEncabezadoACanvas = async (page) => {
  const viewport = page.getViewport({ scale: ESCALA_OCR });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  // Solo los primeros 38% superiores de la página donde residen los sellos de radicación
  canvas.height = Math.round(viewport.height * 0.38);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
};

const renderizarPaginaACanvas = async (page) => {
  const viewport = page.getViewport({ scale: ESCALA_OCR });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
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
  // Aplicar zoom óptico 3.0x a imágenes para maximizar nitidez de sellos pequeños
  const escala = Math.max(2.8, 3500 / img.naturalWidth);
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
export const ocrRadicados = {
  /**
   * Extrae el texto de un File (PDF, imagen o texto plano).
   *
   * @param {File} file              Documento seleccionado por el usuario
   * @param {Function} onEtapa       Callback (etapa:string, progreso:0..1)
   * @returns {Promise<{texto:string, metodo:string}>}
   */
  async extraerTexto(file, onEtapa = () => {}) {
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
        const totalPags = Math.min(doc.numPages, MAX_PAGINAS);

        // ── INTENTO 1: texto digital embebido ─────────────────────────
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

        // ── INTENTO 1: PDF con texto digital → OCR de sello Pág. 1 + Texto Digital ──
        if (charsDigital >= 40) {
          reportar("Escaneando sello en página 1…", 0.35);
          try {
            const page1 = await doc.getPage(1);
            const canvas1 = await renderizarPaginaACanvas(page1);
            const proc1 = preprocesarCanvasParaOCR(canvas1);
            canvas1.width = 0;
            const textoOcrP1 = await ocrMultimodo(proc1, (etapa, p) =>
              reportar(`OCR de sello: ${etapa}`, 0.35 + p * 0.55)
            );
            proc1.width = 0;
            page1.cleanup();

            const textoCombinado = `${textoOcrP1.trim()}\n\n${textoDigital.trim()}`;
            reportar("Lectura completa", 1);
            return {
              texto: textoCombinado,
              metodo: "Lectura digital + OCR de sello (Pág. 1)",
            };
          } catch (eOcrP1) {
            console.warn("⚠️ No se pudo hacer OCR a Pág 1:", eOcrP1.message);
            reportar("Lectura completa", 1);
            return { texto: textoDigital.trim(), metodo: "Texto digital del PDF" };
          }
        }

        // ── INTENTO 2: PDF 100% escaneado → OCR completo ─────────
        reportar("PDF escaneado — preparando OCR de alta resolución…", 0.38);
        let textoOcr = "";
        for (let i = 1; i <= totalPags; i++) {
          const page = await doc.getPage(i);
          try {
            const canvas = await renderizarPaginaACanvas(page);
            const procesado = preprocesarCanvasParaOCR(canvas);
            canvas.width = 0; // libera el bitmap original

            const base = 0.38 + ((i - 1) / totalPags) * 0.57;
            const ancho = 0.57 / totalPags;
            const texto = await ocrMultimodo(procesado, (etapa, p) =>
              reportar(etapa, base + p * ancho)
            );
            textoOcr += texto + "\n\n";
            procesado.width = 0;
          } finally {
            page.cleanup();
          }
        }

        reportar("Lectura completa", 1);
        return {
          texto: textoOcr.trim(),
          metodo: `OCR de PDF escaneado (${totalPags} pág.)`,
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

export default ocrRadicados;
