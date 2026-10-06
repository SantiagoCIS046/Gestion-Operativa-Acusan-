/**
 * ============================================================================
 * OCR DE RADICADOS (NAVEGADOR) — envoltorio del núcleo compartido
 * ============================================================================
 * Toda la maquinaria (worker tesseract persistente, render pdfjs, pase del
 * sello, preprocesamiento condicional) vive en el núcleo compartido:
 * frontend/src/services/ocrNavegador.service.js. Este módulo solo fija la
 * CONFIG_RADICADOS (4 páginas, pase del sello, patrones de radicado) y
 * conserva el contrato extraerTexto(file, onEtapa) que consume
 * VistaRadicados. El texto resultante viaja a /api/radicados/extraer-campos
 * donde el parser de backend lo convierte en campos institucionales.
 * ============================================================================
 */

import ocrNavegador, { CONFIG_RADICADOS } from "../../../services/ocrNavegador.service.js";

export const ocrRadicados = {
  /**
   * Extrae el texto de un File (PDF, imagen o texto plano).
   *
   * @param {File} file              Documento seleccionado por el usuario
   * @param {Function} onEtapa       Callback (etapa:string, progreso:0..1)
   * @returns {Promise<{texto:string, metodo:string}>}
   */
  async extraerTexto(file, onEtapa = () => {}) {
    return ocrNavegador.extraerTexto(file, CONFIG_RADICADOS, onEtapa);
  },
};

export default ocrRadicados;
