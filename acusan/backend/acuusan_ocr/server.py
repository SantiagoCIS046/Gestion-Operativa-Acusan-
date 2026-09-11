# -*- coding: utf-8 -*-
"""
server.py — Servidor Flask para el Motor OCR y Extracción Documental en Python
─────────────────────────────────────────────────────────────────────────────
Endpoints expuestos para Permisos, Radicados y Detección Documental.
Ejecuta de forma nativa en Python con pypdf y los motores de parseo puros:
- parser_permisos.py
- parser_radicados.py
- deteccion_documental.py
"""

import base64
import io
import os
import sys
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Añadir el directorio actual al path para importar módulos locales
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from parser_permisos import parsear_texto_permiso, evaluar_campos_extraidos
from parser_radicados import extraer_campos, extraer_campos_respuesta
from deteccion_documental import detectar_tipo_documental

try:
    import pypdf
except ImportError:
    pypdf = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("acuusan_ocr")

app = Flask(__name__)
CORS(app)


def decodificar_base64(data_base64):
    """Limpia el prefijo data:...;base64, y decodifica a bytes."""
    if not data_base64:
        return None
    if "," in data_base64:
        data_base64 = data_base64.split(",", 1)[1]
    return base64.b64decode(data_base64)


def extraer_texto_pdf(bytes_pdf):
    """Extrae texto de un archivo PDF usando pypdf."""
    if not pypdf:
        logger.warning("pypdf no está instalado")
        return "", ""
    try:
        reader = pypdf.PdfReader(io.BytesIO(bytes_pdf))
        num_paginas = len(reader.pages)
        texto_paginas = []
        for i, pagina in enumerate(reader.pages):
            txt = pagina.extract_text() or ""
            texto_paginas.append(txt)

        texto_p1 = texto_paginas[0] if texto_paginas else ""
        texto_completo = "\n\n".join(texto_paginas)
        return texto_completo, texto_p1
    except Exception as e:
        logger.error(f"Error extrayendo texto del PDF con pypdf: {e}")
        return "", ""


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "Acuasan OCR Python Engine",
        "runtime": f"Python {sys.version.split()[0]}",
        "pypdf_disponible": pypdf is not None
    })


@app.route("/api/permisos/ocr", methods=["POST"])
def permisos_ocr():
    try:
        data = request.get_json(silent=True) or {}
        archivo_base64 = data.get("archivoBase64") or data.get("archivo") or ""
        nombre_archivo = data.get("nombreArchivo") or data.get("nombre") or ""
        mime_type = data.get("mimeType") or ""
        texto_directo = data.get("texto") or ""

        texto_completo = texto_directo
        texto_pagina1 = ""

        if archivo_base64:
            bytes_archivo = decodificar_base64(archivo_base64)
            if bytes_archivo:
                # Detectar PDF por primeros bytes %PDF o mime
                if bytes_archivo.startswith(b"%PDF") or "pdf" in mime_type.lower() or nombre_archivo.lower().endswith(".pdf"):
                    texto_completo, texto_pagina1 = extraer_texto_pdf(bytes_archivo)
                elif "text" in mime_type.lower() or nombre_archivo.lower().endswith(".txt"):
                    texto_completo = bytes_archivo.decode("utf-8", errors="ignore")
                    texto_pagina1 = texto_completo

        if not texto_completo and not texto_directo:
            return jsonify({
                "success": False,
                "message": "No se pudo extraer texto del documento proporcionado o el archivo está vacío.",
                "campos": {},
                "confianza": 0,
                "faltantes": ["Todos"]
            }), 400

        # Procesar con el motor puro de Python
        campos = parsear_texto_permiso(texto_completo, nombre_archivo=nombre_archivo, texto_pagina1=texto_pagina1)
        evaluacion = evaluar_campos_extraidos(campos)

        logger.info(f"Permiso procesado: {nombre_archivo} -> Confianza: {evaluacion['confianza']}% | Faltantes: {evaluacion['faltantes']}")

        return jsonify({
            "success": True,
            "message": f"OCR Python completado con {evaluacion['confianza']}% de confianza",
            "campos": campos,
            "confianza": evaluacion["confianza"],
            "faltantes": evaluacion["faltantes"],
            "textoExtraido": texto_completo[:5000]
        })
    except Exception as e:
        logger.exception("Error en endpoint /api/permisos/ocr:")
        return jsonify({
            "success": False,
            "message": f"Error interno en motor OCR Python: {str(e)}"
        }), 500


@app.route("/api/radicados/ocr", methods=["POST"])
def radicados_ocr():
    try:
        data = request.get_json(silent=True) or {}
        archivo_base64 = data.get("archivoBase64") or ""
        nombre_archivo = data.get("nombreArchivo") or ""
        texto = data.get("texto") or ""
        tipo_solicitado = data.get("tipo") or ""

        if archivo_base64 and not texto:
            bytes_archivo = decodificar_base64(archivo_base64)
            if bytes_archivo and bytes_archivo.startswith(b"%PDF"):
                texto, _ = extraer_texto_pdf(bytes_archivo)

        if not texto:
            return jsonify({"success": False, "message": "No se proporcionó texto ni documento válido"}), 400

        # Detección de tipo si no se especificó
        if not tipo_solicitado:
            res_tipo = detectar_tipo_documental(texto)
            tipo_solicitado = res_tipo.get("tipo", "RADICADO")

        if tipo_solicitado == "RESPUESTA":
            campos = extraer_campos_respuesta(texto)
        else:
            campos = extraer_campos(texto)

        return jsonify({
            "success": True,
            "tipo": tipo_solicitado,
            "campos": campos,
            "textoExtraido": texto[:5000]
        })
    except Exception as e:
        logger.exception("Error en /api/radicados/ocr:")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/api/documentos/detectar-tipo", methods=["POST"])
def detectar_tipo():
    try:
        data = request.get_json(silent=True) or {}
        texto = data.get("texto") or ""
        if not texto:
            archivo_base64 = data.get("archivoBase64") or ""
            if archivo_base64:
                bytes_archivo = decodificar_base64(archivo_base64)
                if bytes_archivo and bytes_archivo.startswith(b"%PDF"):
                    texto, _ = extraer_texto_pdf(bytes_archivo)

        resultado = detectar_tipo_documental(texto)
        return jsonify({"success": True, "resultado": resultado})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == "__main__":
    puerto = int(os.environ.get("PORT_OCR", 5001))
    logger.info(f"Iniciando Acuasan OCR Python en http://127.0.0.1:{puerto}")
    app.run(host="0.0.0.0", port=puerto, debug=False)
