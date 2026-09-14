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
