# -*- coding: utf-8 -*-
r"""
server.py — Servicio Flask del Motor OCR Python de Acuusan
─────────────────────────────────────────────────────────────────────────────
Único cliente legítimo: el puente Node del backend (src/modules/ocr), que
aplica JWT + rol antes de reenviar. En local bindea 127.0.0.1:5001 (npm run
dev); en Render (HOST=0.0.0.0, PORT=10000) sirve al puente desplegado en
Vercel. NO monta CORS y expone:

  GET  /health                     → flags de motores (fitz / tesseract / spa)
  POST /api/ocr/escanear           → endpoint unificado Permisos + Radicados (síncrono)
  POST /api/ocr/trabajos           → inicia un escaneo asíncrono → {jobId} (202)
  GET  /api/ocr/trabajos/<jobId>   → estado del trabajo: procesando | listo + respuesta
  POST /api/permisos/ocr           → alias compatibilidad (respuesta legacy)
  POST /api/radicados/ocr          → alias compatibilidad (respuesta legacy)

El flujo asíncrono existe porque un permiso escaneado tarda ~100s por página
en el plan free y el lambda de Vercel muere a los 300s: con trabajos, el
POST vuelve en segundos y el cliente consulta el estado — ninguna conexión
vive minutos. El registro de trabajos es EN MEMORIA (proceso único,
threaded=True) y se pierde si el motor se reinicia: un jobId desconocido
responde 404 para que el cliente reinicie el escaneo.

Pipeline por debajo (extraction.py): PDF digital por página → rasterizado
300 dpi → preprocesado OpenCV (borroso/contraste) → multi-pase Tesseract
'spa' con selección por confianza → parsers puros (dato del documento o
campo vacío, jamás inventado).
"""

import base64
import logging
import os
import sys
import threading
import time
import uuid

from flask import Flask, jsonify, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from deteccion_documental import detectar_tipo_documental
from extraction import estado_motores, extraer_texto_documento, refuerzo_texto_documento
from parser_permisos import (
    CAMPOS_OCR,
    completar_campos_faltantes,
    evaluar_campos_extraidos,
    parsear_texto_permiso,
)
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

# ── Trabajos asíncronos (el plan free tarda ~100s/página: ninguna conexión
# HTTP puede vivir eso dentro del lambda de Vercel). Proceso único con
# threaded=True → el dict EN MEMORIA es compartido y seguro con lock. Se
# pierde al reiniciar: jobId desconocido → 404 y el cliente reintenta. ──────
TRABAJOS = {}
TRABAJOS_LOCK = threading.Lock()
TRABAJOS_TTL_S = 600          # un resultado vive 10 min tras finalizar
TRABAJOS_MAX = 20             # tope del registro (purga de los más viejos)
TRABAJOS_SIMULTANEOS = int(os.environ.get("OCR_TRABAJOS_SIMULTANEOS", "1") or 1)


def _purgar_trabajos(ahora):
    """Expira resultados viejos y recorta el registro. Llamar con el lock."""
    vivos = [(jid, t) for jid, t in TRABAJOS.items()
             if t["finalizado"] is None or ahora - t["finalizado"] <= TRABAJOS_TTL_S]
    if len(vivos) > TRABAJOS_MAX:
        vivos = sorted(vivos, key=lambda p: p[1]["creado_en"])[-TRABAJOS_MAX:]
    TRABAJOS.clear()
    TRABAJOS.update(dict(vivos))


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


def _escanear(data, cache_variantes=None, deadline=None):
    """Lógica unificada del endpoint. Devuelve (respuesta_dict, codigo_http).

    cache_variantes: dict por request donde extraction memoiza la variante A
    de cada página — el refuerzo y un eventual reintento reutilizan el
    preproceso caro (fastNlMeansDenoising) en vez de recalcularlo.

    deadline: epoch en que se agota el presupuesto del TRABAJO (ver
    _ejecutar_trabajo) — el pipeline lo respeta entre páginas y pases y
    entrega lo leído hasta ahí en vez de moler sin techo."""
    if cache_variantes is None:
        cache_variantes = {}
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
            mime_type=mime_type, on_etapa=on_etapa,
            cache_variantes=cache_variantes, deadline=deadline)
        logger.info("Extracción %s → metodo=%s paginas=%s confianza=%s etapas=%s",
                    nombre_archivo or "(sin nombre)", resultado["metodo"],
                    resultado["paginas"], resultado["confianza"], etapas[-1] if etapas else "-")
    else:
        return {"success": False,
                "message": "Se requiere 'archivoBase64' o 'texto'."}, 400

    texto = resultado["texto"]
    if not texto.strip():
        # Presupuesto agotado SIN texto: mensaje honesto de tiempo, no de
        # ilegible (el documento quizá era legible — el plan gratuito no dio
        # abasto). Con texto parcial el flujo sigue normal más abajo.
        if deadline is not None and time.time() > deadline:
            return {"success": False,
                    "message": "El escaneo agotó el tiempo del motor (plan gratuito: "
                               "CPU muy limitada) — intente con una foto más nítida, "
                               "menos páginas o diligencie manualmente.",
                    "metodo": resultado["metodo"], "paginas": resultado["paginas"],
                    "campos": {}, "confianza": 0, "faltantes": ["Todos"]}, 400
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

        # ── Verificación campo a campo y RECOLECCIÓN FORZADA de los vacíos ──
        # Si quedan campos sin llenar y el documento es ESCANEADO (el texto
        # vino del OCR, no de una capa digital limpia), se fuerza una segunda
        # ronda de pases distintos (PSM 4/12 + sello) y se fusiona SOLO sobre
        # los vacíos: lo ya llenado por la primera pasada queda congelado.
        refuerzo_llenados = []
        if (evaluacion["faltantes"] and archivo_base64
                and resultado["metodo"] in ("ocr-tesseract", "hibrido", "imagen-ocr")
                and not (deadline is not None and time.time() > deadline)):
            on_etapa("Verificando campos: recolección forzada de faltantes", 0.85)
            extra = refuerzo_texto_documento(
                bytes_archivo, nombre_archivo=nombre_archivo,
                mime_type=mime_type, on_etapa=on_etapa,
                cache_variantes=cache_variantes, deadline=deadline)
            if extra["texto"].strip():
                campos_extra = parsear_texto_permiso(
                    extra["texto"], nombre_archivo=nombre_archivo,
                    texto_pagina1=extra["texto_pagina1"])
                campos_antes = dict(campos)
                campos = completar_campos_faltantes(campos, campos_extra)
                refuerzo_llenados = sorted(
                    clave for clave, _ in CAMPOS_OCR
                    if not str(campos_antes.get(clave) or "").strip()
                    and str(campos.get(clave) or "").strip())
                if refuerzo_llenados:
                    evaluacion = evaluar_campos_extraidos(campos)
                    logger.info("Refuerzo %s → llenó %s | faltan: %s",
                                nombre_archivo or "(sin nombre)",
                                refuerzo_llenados, evaluacion["faltantes"])

        return {"success": True,
                "metodo": resultado["metodo"],
                "paginas": resultado["paginas"],
                "texto": texto[:MAX_TEXTO_RESPUESTA],
                "campos": campos,
                "confianza": evaluacion["confianza"],
                "faltantes": evaluacion["faltantes"],
                "refuerzo": refuerzo_llenados}, 200

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


@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    motores = estado_motores()
    return jsonify({
        "status": "online",
        "service": "Acuusan OCR Python Engine",
        "mensaje": "Servicio de motor OCR activo y operativo. La aplicacion web principal se encuentra en https://acuusan.vercel.app",
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


# ── Trabajos asíncronos: el escaneo corre en un hilo del proceso y el
# cliente consulta el estado — la conexión HTTP nunca espera al OCR. ────────

def _ejecutar_trabajo(job_id, data):
    """Corre _escanear en un hilo daemon y deja el resultado en TRABAJOS.

    Presupuesto total del trabajo (OCR_TRABAJO_PRESUPUESTO_S, 420 s): sin él,
    un documento ruidoso real a 0.1 CPU corría TODOS los pases + refuerzo +
    reintento y superaba los 10 min de espera del cliente (medido en
    producción: techo del frontend disparado con el trabajo aún 'procesando').
    El deadline se respeta entre páginas/pases y acota TAMBIÉN al reintento:
    el trabajo SIEMPRE termina con un veredicto en ~presupuesto + un pase.

    Reintento único ante texto vacío: en el worker free de 512MB se midieron
    fallos intermitentes donde tesseract corría completo y devolvía vacío (una
    misma imagen: 200 la primera vez, 400 'ilegible' en las siguientes). Con
    el cache de variantes compartido, el reintento no repite el preproceso
    caro — solo los pases de tesseract."""
    cache = {}
    deadline = time.time() + int(
        os.environ.get("OCR_TRABAJO_PRESUPUESTO_S", "420") or 420)
    try:
        respuesta, codigo = _escanear(data, cache_variantes=cache,
                                      deadline=deadline)
        tiene_archivo = bool(data.get("archivoBase64") or data.get("archivo"))
        if (codigo == 400 and tiene_archivo
                and "No se pudo extraer" in (respuesta.get("message") or "")
                and time.time() <= deadline):
            logger.info("Trabajo %s: texto vacío en ronda 1 — reintentando una vez", job_id)
            respuesta, codigo = _escanear(data, cache_variantes=cache,
                                          deadline=deadline)
    except Exception as error:  # noqa: BLE001 - el hilo jamás mata el servicio
        logger.exception("Error en el trabajo %s:", job_id)
        respuesta = {"success": False,
                     "message": f"Error interno del motor OCR: {error}"}
        codigo = 500
    finally:
        with TRABAJOS_LOCK:
            trabajo = TRABAJOS.get(job_id)
            if trabajo is not None:
                trabajo.update(estado="listo", respuesta=respuesta,
                               codigo=codigo, finalizado=time.time())


@app.route("/api/ocr/trabajos", methods=["POST"])
def crear_trabajo():
    try:
        data = request.get_json(silent=True) or {}
        dominio = (data.get("dominio") or "").lower()
        if dominio not in ("permisos", "radicados"):
            return jsonify({"success": False,
                            "message": "Campo 'dominio' requerido: 'permisos' | 'radicados'."}), 400
        if not (data.get("archivoBase64") or data.get("archivo") or "").strip() \
                and not (data.get("texto") or "").strip():
            return jsonify({"success": False,
                            "message": "Se requiere 'archivoBase64' (PDF/imagen) o 'texto'."}), 400

        with TRABAJOS_LOCK:
            _purgar_trabajos(time.time())
            activos = sum(1 for t in TRABAJOS.values() if t["finalizado"] is None)
            if activos >= TRABAJOS_SIMULTANEOS:
                return jsonify({"success": False,
                                "message": "El motor ya está procesando otro documento — "
                                           "puede tardar varios minutos; espere e intente "
                                           "de nuevo."}), 429
            job_id = uuid.uuid4().hex
            TRABAJOS[job_id] = {"estado": "procesando", "respuesta": None,
                                "codigo": None, "creado_en": time.time(),
                                "finalizado": None}

        try:
            threading.Thread(target=_ejecutar_trabajo, args=(job_id, data),
                             daemon=True).start()
        except Exception:
            # Si el hilo no arranca (p.ej. RuntimeError por presión de RAM), la
            # entrada quedaría 'procesando' para siempre y el contador de
            # activos bloquearía TODOS los escaneos con 429 hasta reiniciar.
            # Se purga y el cliente ve un 500 reintentable.
            with TRABAJOS_LOCK:
                TRABAJOS.pop(job_id, None)
            logger.exception("No se pudo iniciar el hilo del trabajo %s:", job_id)
            return jsonify({"success": False,
                            "message": "El motor no pudo iniciar el escaneo (sin "
                                       "memoria para un hilo más) — intente de nuevo."}), 500
        logger.info("Trabajo %s iniciado (%s)", job_id, dominio)
        return jsonify({"success": True, "jobId": job_id,
                        "estado": "procesando"}), 202
    except Exception as error:  # noqa: BLE001
        logger.exception("Error en /api/ocr/trabajos:")
        return jsonify({"success": False,
                        "message": f"Error interno del motor OCR: {error}"}), 500


@app.route("/api/ocr/trabajos/<job_id>", methods=["GET"])
def consultar_trabajo(job_id):
    with TRABAJOS_LOCK:
        trabajo = TRABAJOS.get(job_id)
    if trabajo is None:
        return jsonify({"success": False,
                        "message": "Trabajo no encontrado o expirado (el motor se "
                                   "reinició) — inicie el escaneo de nuevo."}), 404
    if trabajo["finalizado"] is None:
        return jsonify({"success": True, "estado": "procesando"}), 200
    return jsonify({"success": True, "estado": "listo",
                    "respuesta": trabajo["respuesta"],
                    "codigo": trabajo["codigo"]}), 200


@app.route("/api/ocr/trabajos/<job_id>", methods=["DELETE"])
def cancelar_trabajo(job_id):
    """Cancela un trabajo: lo saca de TRABAJOS y libera el slot de inmediato.

    El hilo sigue corriendo hasta terminar (tesseract no es interrumpible a
    mitad de pase), pero su resultado se descarta — el finally de
    _ejecutar_trabajo solo escribe si el trabajo sigue en el dict. Así, un
    escaneo abandonado por el cliente (re-selección de archivo, techo de
    espera) no bloquea el único slot de TRABAJOS_SIMULTANEOS por minutos.
    Idempotente: borrar un trabajo inexistente da 404 tipado (el cliente lo
    trata como éxito — ya no está)."""
    with TRABAJOS_LOCK:
        borrado = TRABAJOS.pop(job_id, None)
    if borrado is None:
        return jsonify({"success": False,
                        "message": "Trabajo no encontrado o expirado."}), 404
    if borrado["finalizado"] is None:
        logger.info("Trabajo %s cancelado por el cliente", job_id)
    return jsonify({"success": True, "estado": "cancelado"}), 200


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
    puerto = int(os.environ.get("PORT", os.environ.get("PORT_OCR", 5001)))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info("Iniciando Acuasan OCR Python en http://%s:%s", host, puerto)
    logger.info("Motores: %s", estado_motores())
    # threaded=True: atiende peticiones concurrentes del backend
    app.run(host=host, port=puerto, debug=False, threaded=True)

