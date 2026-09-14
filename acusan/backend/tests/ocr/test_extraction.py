# -*- coding: utf-8 -*-
"""Pipeline de extracción (extraction.py) — pruebas con documentos sintéticos.

Genera PDFs/imagenes de prueba en memoria: digital (siempre corre), escaneado
borroso e hibrido (requieren Tesseract + spa → skipif), entrada corrupta y
tope de paginas. El objetivo es de humo: el pipeline nunca lanza, clasifica
bien el metodo y devuelve texto real del documento.
"""

import io
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest

fitz = pytest.importorskip("fitz")
from acuusan_ocr.extraction import estado_motores, extraer_texto_documento

MOTORES = estado_motores()
OCR_LISTO = MOTORES["tesseract_disponible"] and MOTORES["spa_disponible"]
requiere_ocr = pytest.mark.skipif(not OCR_LISTO, reason="sin Tesseract+spa no hay OCR de escaneados")

# Fuente TrueType para pintar texto legible por Tesseract (skip si no hay)
_RUTAS_FUENTE = [
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
FUENTE = next((p for p in _RUTAS_FUENTE if os.path.isfile(p)), None)


def _fuente(tamano):
    if FUENTE is None:
        pytest.skip("sin fuente TrueType disponible para el test")
    from PIL import ImageFont
    return ImageFont.truetype(FUENTE, tamano)


LINEAS_RADICADO = [
    "REPUBLICA DE COLOMBIA",
    "Radicado No.: 2610000736 Folios: 1",
    "FECHA: 14/08/2026 Hora: 4:06 PM",
    "Remitente: PEREZ GOMEZ JOSE",
    "Asunto: Solicitud de revision de facturacion",
]


def _pdf_digital():
    """PDF con capa de texto real (nunca pasa por OCR)."""
    doc = fitz.open()
    for i, linea in enumerate(LINEAS_RADICADO):
        pagina = doc.new_page() if i == 0 else pagina
        pagina.insert_text((72, 100 + 30 * i), linea, fontsize=12, fontname="helv")
    return doc.tobytes()


def _imagen_texto(borroso=False):
    """Imagen A4-ish con texto grande; opcionalmente difuminada (blur)."""
    from PIL import Image, ImageDraw, ImageFilter
    img = Image.new("RGB", (1654, 2339), "white")
    dibujo = ImageDraw.Draw(img)
    fuente = _fuente(44)
    for i, linea in enumerate(LINEAS_RADICADO):
        dibujo.text((120, 200 + 90 * i), linea, fill="black", font=fuente)
    if borroso:
        img = img.filter(ImageFilter.GaussianBlur(radius=1.2))
    return img


def _pdf_escaneado(borroso=False):
    """PDF de una pagina cuya unica 'tinta' es la imagen (sin capa de texto)."""
    img = _imagen_texto(borroso)
    buffer = io.BytesIO()
    img.save(buffer, format="PDF", resolution=150.0)
    return buffer.getvalue()


# ── Digital: siempre corre ────────────────────────────────────────────────────

def test_pdf_digital_extrae_texto_y_metodo():
    resultado = extraer_texto_documento(_pdf_digital(), "documento.pdf", "application/pdf")
    assert resultado["metodo"] == "pdf-digital"
    assert "2610000736" in resultado["texto"]
    assert "PEREZ GOMEZ JOSE" in resultado["texto"]
    assert resultado["paginas"] == 1
    assert resultado["confianza"] >= 99


def test_tope_de_paginas_digital():
    doc = fitz.open()
    for n in range(10):
        pagina = doc.new_page()
        # Línea con más de 30 alfanuméricos: la página cuenta como digital
        # (umbral UMBRAL_DIGITAL) y no pasa por OCR.
        pagina.insert_text(
            (72, 100),
            f"PAGINA {n} Radicado No.: 261000073{n} Solicitud de revision de facturacion",
            fontsize=12, fontname="helv")
    resultado = extraer_texto_documento(doc.tobytes(), "grande.pdf", "application/pdf")
    assert resultado["paginas"] == 10  # reporta el total real del documento
    # ...pero solo proceso (y devuelve texto de) las primeras OCR_MAX_PAGINAS
    procesadas = [l for l in resultado["texto"].splitlines() if l.strip().startswith("PAGINA")]
    assert len(procesadas) <= 6


def test_entrada_corrupta_nunca_lanza():
    resultado = extraer_texto_documento(b"esto no es un pdf ni una imagen", "roto.pdf", "application/pdf")
    assert resultado["texto"] == ""
    assert resultado["metodo"] in ("ilegible", "sin-motor")


def test_entrada_vacia():
    resultado = extraer_texto_documento(b"", "vacio.pdf", "application/pdf")
    assert resultado["texto"] == ""


# ── OCR real: requieren Tesseract + spa ──────────────────────────────────────

@requiere_ocr
def test_pdf_escaneado_borroso_recupera_texto():
    resultado = extraer_texto_documento(_pdf_escaneado(borroso=True), "escaneado.pdf", "application/pdf")
    assert resultado["metodo"] == "ocr-tesseract"
    texto = resultado["texto"]
    assert len(texto.strip()) > 30, f"OCR devolvio muy poco: {texto!r}"
    # El dato sale del documento: aqui debe haber digitos del radicado pintado
    assert any(caracter.isdigit() for caracter in texto)


@requiere_ocr
def test_imagen_directa():
    buffer = io.BytesIO()
    _imagen_texto(borroso=False).save(buffer, format="PNG")
    resultado = extraer_texto_documento(buffer.getvalue(), "foto.png", "image/png")
    assert resultado["metodo"] == "imagen-ocr"
    assert "2610000736" in resultado["texto"].replace(" ", "")


@requiere_ocr
def test_pdf_hibrido_digital_mas_escaneado():
    """Pagina 1 con capa de texto + pagina 2 solo imagen → metodo hibrido."""
    img = _imagen_texto(borroso=False)
    buffer = io.BytesIO()
    img.save(buffer, format="PDF", resolution=150.0)
    doc = fitz.open("pdf", buffer.getvalue())
    pagina1 = doc.new_page(0)  # inserta la digital al comienzo
    for i, linea in enumerate(LINEAS_RADICADO):
        pagina1.insert_text((72, 100 + 30 * i), linea, fontsize=12, fontname="helv")
    resultado = extraer_texto_documento(doc.tobytes(), "hibrido.pdf", "application/pdf")
    assert resultado["metodo"] == "hibrido"
    assert "2610000736" in resultado["texto"]
