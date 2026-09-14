# -*- coding: utf-8 -*-
r"""
server.py — Servicio Flask del Motor OCR Python de Acuusan
─────────────────────────────────────────────────────────────────────────────
Único cliente legítimo: el puente Node del backend (src/modules/ocr), que
aplica JWT + rol antes de reenviar. Por eso el servicio bindea 127.0.0.1,
NO monta CORS y solo expone:

  GET  /health                     → flags de motores (fitz / tesseract / spa)
  POST /api/ocr/escanear           → endpoint unificado Permisos + Radicados
  POST /api/permisos/ocr           → alias compatibilidad (respuesta legacy)
  POST /api/radicados/ocr          → alias compatibilidad (respuesta legacy)

Pipeline por debajo (extraction.py): PDF digital por página → rasterizado
300 dpi → preprocesado OpenCV (borroso/contraste) → multi-pase Tesseract
'spa' con selección por confianza → parsers puros (dato del documento o
campo vacío, jamás inventado).
"""

import base64
import logging
import os
import sys

from flask import Flask, jsonify, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from deteccion_documental import detectar_tipo_documental
from extraction import estado_motores, extraer_texto_documento
from parser_permisos import evaluar_campos_extraidos, parsear_texto_permiso
from parser_radicados import extraer_campos, extraer_campos_respuesta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    encoding="utf-8",
)
logger = logging.getLogger("acuusan_ocr")

app = Flask(__name__)
# Base64 de un PDF de ~28 MB ya redondea 40 MB de JSON; más que eso se rechaza.
app.config["MAX_CONTENT_LENGTH"] = 40 * 1024 * 1024

MAX_TEXTO_RESPUESTA = 8000


def decodificar_base64(data_base64):
    """Limpia el prefijo data:...;base64, y decodifica a bytes."""
    if not data_base64:
        return None
    if "," in data_base64:
        data_base64 = data_base64.split(",", 1)[1]
    try:
        return base64.b64decode(data_base64)
    except Exception:
        return None


def _escanear(data):
    """Lógica unificada del endpoint. Devuelve (respuesta_dict, codigo_http)."""
    archivo_base64 = data.get("archivoBase64") or data.get("archivo") or ""
    nombre_archivo = data.get("nombreArchivo") or data.get("nombre") or ""
    mime_type = data.get("mimeType") or ""
    texto_directo = (data.get("texto") or "").strip()
    dominio = (data.get("dominio") or "").lower()
    tipo_solicitado = (data.get("tipo") or "").upper()

    if dominio not in ("permisos", "radicados"):
        return {"success": False,
                "message": "Campo 'dominio' requerido: 'permisos' | 'radicados'."}, 400

    etapas = []

    def on_etapa(etapa, _progreso):
        etapas.append(etapa)

    if texto_directo:
        resultado = {"texto": texto_directo, "texto_pagina1": texto_directo,
                     "metodo": "texto-directo", "paginas": 1, "confianza": 100.0}
    elif archivo_base64:
        bytes_archivo = decodificar_base64(archivo_base64)
        if not bytes_archivo:
            return {"success": False,
                    "message": "archivoBase64 inválido o vacío."}, 400
        resultado = extraer_texto_documento(
            bytes_archivo, nombre_archivo=nombre_archivo,
            mime_type=mime_type, on_etapa=on_etapa)
        logger.info("Extracción %s → metodo=%s paginas=%s confianza=%s etapas=%s",
                    nombre_archivo or "(sin nombre)", resultado["metodo"],
                    resultado["paginas"], resultado["confianza"], etapas[-1] if etapas else "-")
    else:
        return {"success": False,
                "message": "Se requiere 'archivoBase64' o 'texto'."}, 400

    texto = resultado["texto"]
    if not texto.strip():
        return {"success": False,
                "message": "No se pudo extraer texto del documento (¿ilegible o sin motor OCR?).",
                "metodo": resultado["metodo"], "paginas": resultado["paginas"],
                "campos": {}, "confianza": 0, "faltantes": ["Todos"]}, 400

    # ── Interpretación por dominio (parsers puros: dato del documento o vacío) ──
    if dominio == "permisos":
        campos = parsear_texto_permiso(
            texto, nombre_archivo=nombre_archivo,
            texto_pagina1=resultado["texto_pagina1"])
        evaluacion = evaluar_campos_extraidos(campos)
        logger.info("Permiso %s → confianza %s%% | faltantes: %s",
                    nombre_archivo or "(sin nombre)", evaluacion["confianza"],
                    evaluacion["faltantes"])
        return {"success": True,
                "metodo": resultado["metodo"],
                "paginas": resultado["paginas"],
                "texto": texto[:MAX_TEXTO_RESPUESTA],
                "campos": campos,
                "confianza": evaluacion["confianza"],
                "faltantes": evaluacion["faltantes"]}, 200

    # dominio == "radicados"
    tipo = tipo_solicitado
    if tipo not in ("RADICADO", "RESPUESTA"):
        tipo = detectar_tipo_documental(texto).get("tipo", "RADICADO")
    campos = extraer_campos_respuesta(texto) if tipo == "RESPUESTA" else extraer_campos(texto)
    logger.info("Radicado %s → tipo=%s | campos: %s",
                nombre_archivo or "(sin nombre)", tipo,
                [k for k, v in campos.items() if v])
    return {"success": True,
            "metodo": resultado["metodo"],
            "paginas": resultado["paginas"],
            "texto": texto[:MAX_TEXTO_RESPUESTA],
            "tipo": tipo,
            "campos": campos}, 200


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    motores = estado_motores()
    return jsonify({
        "status": "online",
        "service": "Acuusan OCR Python Engine",
        "runtime": f"Python {sys.version.split()[0]}",
        **motores,
    })


@app.route("/api/ocr/escanear", methods=["POST"])
def escanear():
    try:
        data = request.get_json(silent=True) or {}
        respuesta, codigo = _escanear(data)
        return jsonify(respuesta), codigo
    except Exception as error:  # noqa: BLE001 - el servicio nunca debe morir
        logger.exception("Error en /api/ocr/escanear:")
        return jsonify({"success": False,
                        "message": f"Error interno del motor OCR: {error}"}), 500


# ── Alias de compatibilidad (contrato legacy de la integración 9a51158) ─────

@app.route("/api/permisos/ocr", methods=["POST"])
def permisos_ocr():
    try:
        data = request.get_json(silent=True) or {}
        data["dominio"] = "permisos"
        respuesta, codigo = _escanear(data)
        # Claves legacy (textoExtraido) para clientes antiguos / curl manual
        if "texto" in respuesta:
            respuesta["textoExtraido"] = respuesta.pop("texto")
        return jsonify(respuesta), codigo
    except Exception as error:  # noqa: BLE001
        logger.exception("Error en /api/permisos/ocr:")
        return jsonify({"success": False, "message": str(error)}), 500


@app.route("/api/radicados/ocr", methods=["POST"])
def radicados_ocr():
    try:
        data = request.get_json(silent=True) or {}
        data["dominio"] = "radicados"
        respuesta, codigo = _escanear(data)
        if "texto" in respuesta:
            respuesta["textoExtraido"] = respuesta.pop("texto")
        return jsonify(respuesta), codigo
    except Exception as error:  # noqa: BLE001
        logger.exception("Error en /api/radicados/ocr:")
        return jsonify({"success": False, "message": str(error)}), 500


if __name__ == "__main__":
    puerto = int(os.environ.get("PORT_OCR", 5001))
    logger.info("Iniciando Acuasan OCR Python en http://127.0.0.1:%s", puerto)
    logger.info("Motores: %s", estado_motores())
    # threaded=True (default del dev server): suficiente para el uso local
    # mono-usuario detrás del puente Node.
    app.run(host="127.0.0.1", port=puerto, debug=False, threaded=True)
