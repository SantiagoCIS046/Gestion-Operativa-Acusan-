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


# ── Refuerzo: verificación campo a campo + recolección forzada de vacíos ─────

def test_refuerzo_llena_solo_campos_vacios(cliente, monkeypatch):
    """Documento escaneado con campos vacíos → el refuerzo corre y fusiona
    SOLO los vacíos; un valor distinto del refuerzo para un campo ya lleno
    (NOMBRE: OTRA PERSONA) se ignora."""
    texto_1a = "SOLICITUD DE PERMISO\nNOMBRE: MARIA GOMEZ\nFECHA: 18-08-2026"

    def _primera(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None):
        return {"texto": texto_1a, "texto_pagina1": texto_1a,
                "metodo": "ocr-tesseract", "paginas": 1, "confianza": 80.0}

    def _refuerzo(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None):
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

    def _primera(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None):
        return {"texto": texto_completo, "texto_pagina1": texto_completo,
                "metodo": "ocr-tesseract", "paginas": 1, "confianza": 85.0}

    def _refuerzo_prohibido(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None):
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

    def _primera(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None):
        return {"texto": texto, "texto_pagina1": texto,
                "metodo": "pdf-digital", "paginas": 1, "confianza": 99.0}

    def _refuerzo_prohibido(bytes_archivo, nombre_archivo="", mime_type="", on_etapa=None, cache_variantes=None):
        raise AssertionError("un pdf-digital limpio no debe pasar por refuerzo")

    monkeypatch.setattr(server, "extraer_texto_documento", _primera)
    monkeypatch.setattr(server, "refuerzo_texto_documento", _refuerzo_prohibido)
    respuesta = cliente.post("/api/ocr/escanear", json={
        "archivoBase64": _data_url(b"%PDF-falso"),
        "dominio": "permisos",
    })
    assert respuesta.status_code == 200
    assert respuesta.get_json()["refuerzo"] == []
