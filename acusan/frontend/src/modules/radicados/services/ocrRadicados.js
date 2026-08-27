/**
 * ============================================================================
 * MOTOR DE LECTURA DE RADICADOS (NAVEGADOR) — ACUASAN E.S.P.
 * ============================================================================
 * Lee el documento que el usuario selecciona desde su PC y extrae su texto:
 *
 *   1. PDF con texto embebido (nativo/digital) → pdfjs-dist lo lee exacto.
 *   2. PDF escaneado (sin texto) → pdfjs lo renderiza a canvas y tesseract.js
 *      hace OCR en español.
 *   3. Imágenes (png/jpg) → OCR directo con tesseract.js.
 *
 * El texto viaja luego al backend (/api/radicados/extraer-campos) donde se
 * convierte en los campos institucionales. Este módulo NO interpreta nada:
 * solo devuelve texto fiel del documento.
 *
 * pdfjs y tesseract se cargan con import() dinámico: quien no radica un
 * documento no descarga varios MB de librerías.
 * ============================================================================
 */

const MAX_PAGINAS_OCR = 4; // Balance: cobertura del documento vs. tiempo de OCR
const ESCALA_RENDER = 2.2; // Ampliación del render: los sellos usan letra pequeña

let pdfjsCache = null;
const getPdfjs = async () => {
  if (pdfjsCache) return pdfjsCache;
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      // Vite resuelve la URL del worker en dev y en el build de producción
      const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
    } catch (e) {
      // Respaldo: CDN público con la versión exacta de pdfjs instalada
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }
  }
  pdfjsCache = pdfjs;
  return pdfjs;
};

/**
 * Worker de tesseract.js v7 en español. El logger entrega el avance
 * (loading language data / recognizing) que se refleja al usuario.
 */
const crearWorkerOcr = async (onProgreso) => {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    logger: (m) => {
      if (m && m.status && typeof m.progress === "number") {
        onProgreso?.(m.status, m.progress);
      }
    },
  });
  // v7: la configuración del motor se aplica con setParameters (no en createWorker)
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
  });
  return worker;
};

/**
 * OCR de un canvas/imagen con el worker ya creado (reutilizado entre páginas).
 */
const ocrCanvas = async (worker, canvas) => {
  const { data } = await worker.recognize(canvas);
  return (data?.text || "").trim();
};

/**
 * Dibuja una imagen en canvas ampliada: tesseract rinde mejor con texto
 * grande y nítido que con el archivo original comprimido.
 */
const imagenACanvas = (img) => {
  const escala = img.naturalWidth < 1200 ? 2 : 1.3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("No fue posible abrir la imagen del documento"));
    img.src = src;
  });

/**
 * Extrae el texto de un File del radicado.
 *
 * @param {File} file Documento seleccionado por el usuario (PDF/imagen/texto)
 * @param {(etapa:string, progreso:number)=>void} onEtapa Avance 0..1 para la UI
 * @returns {Promise<{texto:string, metodo:string}>} Texto fiel + cómo se leyó
 */
export const ocrRadicados = {
  async extraerTexto(file, onEtapa = () => {}) {
    const reportar = (etapa, progreso) => {
      try {
        onEtapa(etapa, Math.max(0, Math.min(1, progreso || 0)));
      } catch (e) {
        /* UI opcional */
      }
    };

    // ── Imágenes: OCR directo ────────────────────────────────────────────────
    if (file.type.startsWith("image/")) {
      reportar("Abriendo imagen", 0.05);
      const url = URL.createObjectURL(file);
      let worker = null;
      try {
        const img = await cargarImagen(url);
        const canvas = imagenACanvas(img);
        reportar("Reconociendo texto (OCR)", 0.15);
        worker = await crearWorkerOcr((status, p) =>
          reportar(`OCR: ${status}`, 0.15 + p * 0.8),
        );
        const texto = await ocrCanvas(worker, canvas);
        reportar("Lectura completa", 1);
        return { texto, metodo: "OCR de imagen" };
      } finally {
        URL.revokeObjectURL(url);
        if (worker) await worker.terminate().catch(() => {});
      }
    }

    // ── Texto plano ──────────────────────────────────────────────────────────
    if (file.type.startsWith("text/") || /\.(txt|csv|md)$/i.test(file.name)) {
      reportar("Leyendo texto", 0.5);
      const texto = await file.text();
      reportar("Lectura completa", 1);
      return { texto, metodo: "Archivo de texto" };
    }

    // ── PDF: texto embebido, o render + OCR si es escaneado ──────────────────
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      reportar("Abriendo PDF", 0.05);
      const pdfjs = await getPdfjs();
      const buffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      try {
        // 1) Texto embebido: fidelidad exacta, sin OCR. Los items de pdfjs no
        // traen '\n': el salto real de cada línea lo marca item.hasEOL.
        reportar("Buscando texto del PDF", 0.15);
        let embebido = "";
        const totalPaginas = Math.min(doc.numPages, MAX_PAGINAS_OCR);
        for (let i = 1; i <= totalPaginas; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          for (const it of content.items) {
            embebido += it.str;
            if (it.hasEOL) embebido += "\n";
          }
          embebido += "\n";
          reportar("Leyendo texto del PDF", 0.15 + (i / totalPaginas) * 0.2);
        }
        const charsUtiles = embebido.replace(/\s/g, "").length;
        if (charsUtiles > 40) {
          reportar("Lectura completa", 1);
          return { texto: embebido.trim(), metodo: "Texto digital del PDF" };
        }

        // 2) Escaneado: renderizar páginas a canvas y OCR en español
        let worker = null;
        try {
          reportar("PDF escaneado: preparando OCR", 0.4);
          worker = await crearWorkerOcr(() => {});
          let texto = "";
          for (let i = 1; i <= totalPaginas; i++) {
            const page = await doc.getPage(i);
            const viewport = page.getViewport({ scale: ESCALA_RENDER });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // v6: el parámetro canvas es el camino conforme a los tipos;
            // canvasContext quedó como compatibilidad hacia atrás
            await page.render({ canvas, viewport }).promise;

            const base = 0.4 + ((i - 1) / totalPaginas) * 0.55;
            const ancho = 0.55 / totalPaginas;
            // recognize no pasa por el logger por página: reportar antes/después
            reportar(`OCR página ${i} de ${totalPaginas}`, base);
            const textoPagina = await ocrCanvas(worker, canvas);
            reportar(`OCR página ${i} de ${totalPaginas}`, base + ancho);
            texto += `${textoPagina}\n`;
            canvas.width = 0; // libera la memoria del bitmap ya reconocido
          }
          reportar("Lectura completa", 1);
          return {
            texto: texto.trim(),
            metodo: `OCR de PDF escaneado (${totalPaginas} pág.)`,
          };
        } finally {
          if (worker) await worker.terminate().catch(() => {});
        }
      } finally {
        // pdfjs levanta un Worker dedicado por getDocument que solo se libera
        // con loadingTask.destroy() (v6 quitó destroy() del documento):
        // sin esto, cada PDF leído deja un hilo vivo colgado.
        try {
          await doc.loadingTask?.destroy();
        } catch (e) {
          /* ya destruido */
        }
      }
    }

    throw new Error(
      `Tipo de documento no soportado para lectura automática: ${file.type || file.name}. Puede llenar los campos manualmente.`,
    );
  },
};

export default ocrRadicados;
