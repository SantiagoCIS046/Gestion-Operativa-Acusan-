# -*- coding: utf-8 -*-
"""Servidor Flask (server.py) — pruebas con test_client, sin puerto.

Cubre: /api/health con flags, escaneo unificado happy-path en ambos dominios
(PDF digital sintetico), errores 400 y alias de compatibilidad legacy.
"""

import base64
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest

fitz = pytest.importorskip("fitz")
pytest.importorskip("flask")

from acuusan_ocr import server  # noqa: E402  (el insert de sys.path vive en server.py)


def _pdf_digital_permiso():
    lineas = [
        "ACUASAN E.S.P. — PERMISO",
        "FECHA PERMISO: 18 de Agosto 2026",
        "Nombre: ROMAN DIAZ CARLOS",
        "Cedula: 1098765432",
        "Cargo: Lider Potabilizacion",
        "Dependencia: Planta de Tratamiento",
        "HORA: Jornada laboral",
        "Motivo: Calamidad domestica",
    ]
    doc = fitz.open()
    pagina = doc.new_page()
    for i, linea in enumerate(lineas):
        pagina.insert_text((72, 100 + 26 * i), linea, fontsize=12, fontname="helv")
    return doc.tobytes()


def _pdf_digital_radicado():
    lineas = [
        "REPUBLICA DE COLOMBIA",
        "Radicado No.: 2610000736 Folios: 1",
        "FECHA: 14/08/2026",
        "Remitente: PEREZ GOMEZ JOSE",
        "Asunto: Solicitud de revision de facturacion",
    ]
    doc = fitz.open()
    pagina = doc.new_page()
    for i, linea in enumerate(lineas):
        pagina.insert_text((72, 100 + 26 * i), linea, fontsize=12, fontname="helv")
    return doc.tobytes()


def _data_url(bytes_pdf):
    return "data:application/pdf;base64," + base64.b64encode(bytes_pdf).decode()


@pytest.fixture()
def cliente():
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c
    # Los trabajos asíncronos viven en el dict del proceso: sin limpiar, un
    # test contamina el siguiente (429 fantasma por un slot ocupado).
    with server.TRABAJOS_LOCK:
        server.TRABAJOS.clear()


def test_health_con_flags(cliente):
    respuesta = cliente.get("/api/health")
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo["status"] == "online"
    for clave in ("fitz_disponible", "tesseract_disponible", "spa_disponible"):
        assert clave in cuerpo


def test_escanear_permisos_pdf_digital(cliente):
    respuesta = cliente.post("/api/ocr/escanear", json={
        "archivoBase64": _data_url(_pdf_digital_permiso()),
        "nombreArchivo": "permiso.pdf",
        "mimeType": "application/pdf",
        "dominio": "permisos",
    })
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo["success"] is True
    assert cuerpo["metodo"] == "pdf-digital"
    assert isinstance(cuerpo["campos"], dict)
    assert "confianza" in cuerpo and isinstance(cuerpo["faltantes"], list)
    # Regla de oro: la cedula pintada debe llegar, sin invenciones de mas
    assert "1098765432" in cuerpo["texto"]


def test_escanear_radicados_pdf_digital(cliente):
    respuesta = cliente.post("/api/ocr/escanear", json={
        "archivoBase64": _data_url(_pdf_digital_radicado()),
        "nombreArchivo": "radicado.pdf",
        "mimeType": "application/pdf",
        "dominio": "radicados",
    })
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo["success"] is True
    assert cuerpo["tipo"] == "RADICADO"
    assert "2610000736" in cuerpo["texto"]


def test_escanear_radicados_tipo_forzado(cliente):
    respuesta = cliente.post("/api/ocr/escanear", json={
        "archivoBase64": _data_url(_pdf_digital_radicado()),
        "dominio": "radicados",
        "tipo": "RESPUESTA",
    })
    cuerpo = respuesta.get_json()
    assert cuerpo["tipo"] == "RESPUESTA"


def test_texto_directo_sin_archivo(cliente):
    respuesta = cliente.post("/api/ocr/escanear", json={
        "texto": "Oficio No. OF-2026-104 en respuesta al radicado 2610000736",
        "dominio": "radicados",
    })
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo["success"] is True
    assert cuerpo["metodo"] == "texto-directo"


def test_400_sin_archivo_ni_texto(cliente):
    respuesta = cliente.post("/api/ocr/escanear", json={"dominio": "permisos"})
    assert respuesta.status_code == 400


def test_400_dominio_invalido(cliente):
    respuesta = cliente.post("/api/ocr/escanear", json={"dominio": "pqr"})
    assert respuesta.status_code == 400


def test_alias_legacy_radicados(cliente):
    respuesta = cliente.post("/api/radicados/ocr", json={
        "archivoBase64": _data_url(_pdf_digital_radicado()),
    })
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo["success"] is True
    assert "textoExtraido" in cuerpo  # clave legacy


def test_alias_legacy_permisos(cliente):
    respuesta = cliente.post("/api/permisos/ocr", json={
        "archivoBase64": _data_url(_pdf_digital_permiso()),
    })
    assert respuesta.status_code == 200
    assert "textoExtraido" in respuesta.get_json()


# ── Refuerzo: verificación campo a campo + recolección forzada de vacíos ─────

def test_refuerzo_llena_solo_campos_vacios(cliente, monkeypatch):
    """Documento escaneado con campos vacíos → el refuerzo corre y fusiona
    SOLO los vacíos; un valor distinto del refuerzo para un campo ya lleno
    (NOMBRE: OTRA PERSONA) se ignora."""
    texto_1a = "SOLICITUD DE PERMISO\nNOMBRE: MARIA GOMEZ\nFECHA: 18-08-2026"

    def _primera(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None, deadline=None):
        return {"texto": texto_1a, "texto_pagina1": texto_1a,
                "metodo": "ocr-tesseract", "paginas": 1, "confianza": 80.0}

    def _refuerzo(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None, deadline=None):
        return {"texto": "CARGO: Fontanero\nHORA: 2:00 p.m. a 4:00 p.m.\nNOMBRE: OTRA PERSONA",
                "texto_pagina1": "CARGO: Fontanero"}

    monkeypatch.setattr(server, "extraer_texto_documento", _primera)
    monkeypatch.setattr(server, "refuerzo_texto_documento", _refuerzo)
    respuesta = cliente.post("/api/ocr/escanear", json={
        "archivoBase64": _data_url(b"%PDF-falso"),
        "nombreArchivo": "permiso.pdf",
        "mimeType": "application/pdf",
        "dominio": "permisos",
    })
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    campos = cuerpo["campos"]
    assert campos["nombreFuncionario"] == "MARIA GOMEZ"      # intacto
    assert campos["fechaInicio"] == "18/08/2026"             # intacto
    assert campos["cargo"] == "Fontanero"                    # llenado por refuerzo
    assert campos["horaInicio"] == "14:00"                   # llenado por refuerzo
    assert campos["horaFin"] == "16:00"
    assert set(cuerpo["refuerzo"]) == {"cargo", "dependencia", "horaInicio", "horaFin"}
    # faltantes y confianza coherentes con el estado FINAL
    assert "Cargo" not in cuerpo["faltantes"]
    assert "Nombre Completo del Trabajador" not in cuerpo["faltantes"]


def test_refuerzo_no_corre_sin_faltantes(cliente, monkeypatch):
    """Todos los campos llenos → no hay nada que forzar: el refuerzo jamás corre."""
    texto_completo = "\n".join([
        "SOLICITUD DE PERMISO",
        "NOMBRE: MARIA GOMEZ  CEDULA: 1.098.765.432",
        "CARGO: Fontanero  AREA: Distribución y Redes",
        "FECHA: 18-08-2026  HORA: 7:30 a 9:30 a.m.",
        "TIPO DE PERMISO: Personal",
        "MOTIVO: tramite personal en banco",
        "OBSERVACIONES: sin novedad",
    ])

    def _primera(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None, deadline=None):
        return {"texto": texto_completo, "texto_pagina1": texto_completo,
                "metodo": "ocr-tesseract", "paginas": 1, "confianza": 85.0}

    def _refuerzo_prohibido(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None, deadline=None):
        raise AssertionError("sin campos faltantes el refuerzo no debe correr")

    monkeypatch.setattr(server, "extraer_texto_documento", _primera)
    monkeypatch.setattr(server, "refuerzo_texto_documento", _refuerzo_prohibido)
    respuesta = cliente.post("/api/ocr/escanear", json={
        "archivoBase64": _data_url(b"%PDF-falso"),
        "dominio": "permisos",
    })
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo["faltantes"] == []
    assert cuerpo["refuerzo"] == []
    assert cuerpo["confianza"] == 100


def test_refuerzo_no_corre_para_pdf_digital(cliente, monkeypatch):
    """PDF digital limpio: la capa de texto es la autoridad — aunque falten
    campos no se fuerza OCR (un formato en blanco digital es un vacío real)."""
    texto = "SOLICITUD DE PERMISO\nNOMBRE: MARIA GOMEZ\nFECHA: 18-08-2026"

    def _primera(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None, deadline=None):
        return {"texto": texto, "texto_pagina1": texto,
                "metodo": "pdf-digital", "paginas": 1, "confianza": 99.0}

    def _refuerzo_prohibido(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None, deadline=None):
        raise AssertionError("un pdf-digital limpio no debe pasar por refuerzo")

    monkeypatch.setattr(server, "extraer_texto_documento", _primera)
    monkeypatch.setattr(server, "refuerzo_texto_documento", _refuerzo_prohibido)
    respuesta = cliente.post("/api/ocr/escanear", json={
        "archivoBase64": _data_url(b"%PDF-falso"),
        "dominio": "permisos",
    })
    assert respuesta.status_code == 200
    assert respuesta.get_json()["refuerzo"] == []


# ── Trabajos asíncronos (/api/ocr/trabajos) ─────────────────────────────────

import threading  # noqa: E402  (solo lo usan las pruebas de trabajos)
import time  # noqa: E402


def _esperar_listo(cliente, job_id, techo_s=5.0):
    """Consulta un trabajo hasta que esté listo (el hilo corre en paralelo)."""
    inicio = time.time()
    while time.time() - inicio < techo_s:
        respuesta = cliente.get(f"/api/ocr/trabajos/{job_id}")
        if respuesta.status_code == 200 and respuesta.get_json().get("estado") == "listo":
            return respuesta.get_json()
        time.sleep(0.05)
    raise AssertionError(f"el trabajo {job_id} no quedó listo en {techo_s}s")


def test_trabajo_asincrono_ciclo_completo(cliente, monkeypatch):
    def _escanear_ok(data, cache_variantes=None, deadline=None):
        return ({"success": True, "metodo": "ocr-tesseract", "paginas": 1,
                 "campos": {"nombreFuncionario": "GOMEZ MARIA"}}, 200)

    monkeypatch.setattr(server, "_escanear", _escanear_ok)
    alta = cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")})
    assert alta.status_code == 202
    job_id = alta.get_json()["jobId"]

    final = _esperar_listo(cliente, job_id)
    assert final["codigo"] == 200
    assert final["respuesta"]["campos"]["nombreFuncionario"] == "GOMEZ MARIA"


def test_trabajo_cancelado_libera_el_slot(cliente, monkeypatch):
    iniciado = threading.Event()

    def _escanear_lento(data, cache_variantes=None, deadline=None):
        iniciado.set()
        time.sleep(1.0)
        return ({"success": True, "metodo": "ocr-tesseract", "campos": {}}, 200)

    monkeypatch.setattr(server, "_escanear", _escanear_lento)
    alta = cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")})
    assert alta.status_code == 202
    job_id = alta.get_json()["jobId"]
    assert iniciado.wait(2), "el hilo del trabajo no arrancó"

    cancelacion = cliente.delete(f"/api/ocr/trabajos/{job_id}")
    assert cancelacion.status_code == 200
    assert cancelacion.get_json()["estado"] == "cancelado"

    # Fuera del dict: la consulta da 404 y el slot quedó libre (el próximo
    # POST no hereda un 429 aunque el hilo viejo siga durmiendo).
    assert cliente.get(f"/api/ocr/trabajos/{job_id}").status_code == 404
    segunda = cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")})
    assert segunda.status_code == 202

    # El hilo cancelado termina pero su resultado se descarta (no revive).
    time.sleep(1.2)
    assert cliente.get(f"/api/ocr/trabajos/{job_id}").status_code == 404


def test_fallo_al_iniciar_hilo_no_deja_zombie(cliente, monkeypatch):
    """Si Thread.start() lanza (presión de RAM), la entrada debe purgarse: sin
    esto el contador de activos bloquearía TODOS los escaneos con 429 para
    siempre (bug hallado por la revisión adversarial del commit eaeec49)."""

    class _HiloRoto:
        def __init__(self, *args, **kwargs):
            pass

        def start(self):
            raise RuntimeError("can't start new thread")

    monkeypatch.setattr(server.threading, "Thread", _HiloRoto)
    respuesta = cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")})
    assert respuesta.status_code == 500

    with server.TRABAJOS_LOCK:
        assert server.TRABAJOS == {}, "la entrada rota quedó huérfana (429 eterno)"


def test_trabajo_ocupado_responde_429(cliente, monkeypatch):
    iniciado = threading.Event()

    def _escanear_lento(data, cache_variantes=None, deadline=None):
        iniciado.set()
        time.sleep(0.8)
        return ({"success": True, "metodo": "ocr-tesseract", "campos": {}}, 200)

    monkeypatch.setattr(server, "_escanear", _escanear_lento)
    assert cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")}).status_code == 202
    assert iniciado.wait(2)

    ocupado = cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")})
    assert ocupado.status_code == 429
    assert "varios minutos" in ocupado.get_json()["message"]


# ── Presupuesto total del trabajo (OCR_TRABAJO_PRESUPUESTO_S) ────────────────

def test_trabajo_con_presupuesto_agotado_dictamina_rapido(cliente, monkeypatch):
    """Presupuesto 0 → el trabajo NO muele pases ni reintenta: dictamina 400
    con el mensaje honesto de tiempo (no 'ilegible') en segundos. Es el caso
    real de producción: documento ruidoso a 0.1 CPU superaba los 10 min del
    cliente con el trabajo aún 'procesando'."""
    monkeypatch.setenv("OCR_TRABAJO_PRESUPUESTO_S", "0")
    alta = cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")})
    assert alta.status_code == 202
    job_id = alta.get_json()["jobId"]

    final = _esperar_listo(cliente, job_id, techo_s=15)
    assert final["codigo"] == 400
    assert "agotó el tiempo" in final["respuesta"]["message"]


def test_presupuesto_agotado_no_reintenta(cliente, monkeypatch):
    """El reintento por texto vacío queda acotado por el deadline: con el
    presupuesto ya vencido, _escanear corre UNA sola vez."""
    llamadas = []

    def _escanear_espiado(data, cache_variantes=None, deadline=None):
        llamadas.append(deadline)
        # Simula el resultado real con presupuesto vencido: 400 de tiempo.
        return ({"success": False,
                 "message": "El escaneo agotó el tiempo del motor (plan gratuito: "
                            "CPU muy limitada) — intente con una foto más nítida, "
                            "menos páginas o diligencie manualmente.",
                 "campos": {}, "confianza": 0, "faltantes": ["Todos"]}, 400)

    monkeypatch.setattr(server, "_escanear", _escanear_espiado)
    alta = cliente.post("/api/ocr/trabajos", json={
        "dominio": "permisos", "archivoBase64": _data_url(b"%PDF-falso")})
    assert alta.status_code == 202
    final = _esperar_listo(cliente, alta.get_json()["jobId"])
    assert final["codigo"] == 400
    assert len(llamadas) == 1, f"el reintento corrió pese al deadline: {llamadas}"


def test_mejor_ocr_respeta_el_deadline(monkeypatch):
    """Deadline vencido → _mejor_ocr no arranca NI un pase."""
    extraction_mod = sys.modules["extraction"]

    def _pase_prohibido(imagen_np, psm):
        raise AssertionError("con el deadline vencido no debe correr ningún pase")

    monkeypatch.setattr(extraction_mod, "_ocr_un_pase", _pase_prohibido)
    texto, conf, n = extraction_mod._mejor_ocr(
        [("imagen-falsa", 6)], deadline=time.time() - 1)
    assert (texto, conf, n) == ("", -1.0, 0)


def test_pdf_a_texto_deadline_corta_el_ciclo_de_paginas():
    """Deadline vencido → no se abren más páginas; lo ya leído se entrega."""
    extraction_mod = sys.modules["extraction"]
    doc = fitz.open()
    for i in range(2):
        pagina = doc.new_page()
        pagina.insert_text((72, 100), f"Pagina {i + 1} con texto suficiente 12345",
                           fontsize=12, fontname="helv")
    bytes_pdf = doc.tobytes()

    textos, _, total, _, _ = extraction_mod._pdf_a_texto(
        bytes_pdf, None, {}, None)
    assert total == 2 and len(textos) == 2

    textos_cortados, _, total_c, _, _ = extraction_mod._pdf_a_texto(
        bytes_pdf, None, {}, time.time() - 1)
    assert total_c == 2 and textos_cortados == []
