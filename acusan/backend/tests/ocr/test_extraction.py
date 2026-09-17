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


# ── Compuerta de calidad de la capa digital (OCR-basura del escáner) ─────────

# Muestra VERBATIM de la capa que produce el OCR del propio escáner en el
# permiso real "PERMISO RAMON DONATO CARDENAS RODRIGUEZ20260803.pdf": pasa
# UMBRAL_DIGITAL pero es ilegible ("SOLICITUD" → "SOLlcrruD"). Calibrada:
# score léxico 0.176 / anomalía de caja 0.32 (la capa limpia da ≥0.24 / 0.0).
# El símbolo '€' se sustituye por '£' (Latin-1 puro para la fuente helv):
# ninguno de los dos forma tokens, la puntuación no cambia.
CAPA_BASURA = """REpllBDEprm"ENPRES^D£ACUEDUCTOLICA D
AI.COu^RILLADO, ASEO Y GESTtoN
ENER     Tic^DE^LLwaACUA6MFtAOO POBLJEJ.C.i-E.co ce aAN GiL.P9000-1
Mrr 8oo.1 ae.173-7 NulR iee¢7
SOLlcrruD PERMlsO LAiroRAL
NOMBRE: fam6r, j2 cddrr |2LCARGO:  Au.  AdL'uo
FECHAPEF"lso:o3 agr.  zo2S          H°RA: 2?r`00Fat, £.`cofzfty
MOTIVO:     Compensatorio
"6dlco*
Personal"""

CAPA_LIMPIA = "\n".join([
    "SOLICITUD DE PERMISO LABORAL",
    "NOMBRE COMPLETO: MARIA FERNANDA GOMEZ",
    "CARGO: Auxiliar Administrativo AREA: Administrativa",
    "FECHA: 18-08-2026 HORA: 7:30 a 9:30 a.m.",
    "MOTIVO: Cita medica general EPS",
])

TEXTO_OCR_BUENO = "\n".join([
    "SOLICITUD DE PERMISO LABORAL",
    "NOMBRE: MARIA FERNANDA GOMEZ CEDULA: 1.098.765.432",
    "CARGO: Auxiliar Administrativo",
])


def _pdf_capa(texto_capa):
    doc = fitz.open()
    pagina = doc.new_page()
    for i, linea in enumerate(texto_capa.split("\n")):
        pagina.insert_text((72, 100 + 20 * i), linea, fontsize=12, fontname="helv")
    return doc.tobytes()


def test_puntaje_capa_digital_separa_basura_de_limpia():
    from acuusan_ocr import extraction
    # La basura del escáner: léxico bajo Y anomalías de caja mezclada
    puntaje_basura = extraction._puntaje_capa_digital(CAPA_BASURA)
    assert puntaje_basura is not None
    assert puntaje_basura[0] < extraction.SCORE_DIGITAL_MIN
    assert not extraction._capa_digital_confiable(CAPA_BASURA)
    # La capa limpia: muchas palabras del léxico, cero anomalías
    puntaje_limpio = extraction._puntaje_capa_digital(CAPA_LIMPIA)
    assert puntaje_limpio is not None
    assert puntaje_limpio[0] >= extraction.SCORE_DIGITAL_MIN
    assert puntaje_limpio[1] == 0.0
    assert extraction._capa_digital_confiable(CAPA_LIMPIA)
    # Poca señal (página numérica/taquilla): se confía, igual que hoy
    assert extraction._puntaje_capa_digital("Radicado 2610000736 Folios 1") is None
    assert extraction._capa_digital_confiable("Radicado 2610000736 Folios 1")
    assert extraction._capa_digital_confiable("")


def test_capa_basura_se_reemplaza_por_ocr_mejor(monkeypatch):
    """La capa basura del escáner dispara el OCR y este la REEMPLAZA (nuestro
    Tesseract sobre el escaneo lee mejor que el OCR roto del escáner)."""
    from acuusan_ocr import extraction
    llamadas = []

    def _ocr_falso(img_gris, es_pagina1, cache=None, clave=None):
        llamadas.append(es_pagina1)
        return TEXTO_OCR_BUENO, 81.5

    monkeypatch.setattr(extraction, "_ocr_con_sello", _ocr_falso)
    resultado = extraction.extraer_texto_documento(
        _pdf_capa(CAPA_BASURA), "permiso.pdf", "application/pdf")
    assert llamadas == [True]  # la página fue rasterizada y OCR-eada
    assert resultado["metodo"] == "ocr-tesseract"  # el texto USADO vino del OCR
    assert "MARIA FERNANDA GOMEZ" in resultado["texto"]
    assert "SOLlcrruD" not in resultado["texto"]
    assert resultado["confianza"] == 81.5


def test_capa_limpia_jamas_pasa_por_ocr(monkeypatch):
    from acuusan_ocr import extraction

    def _ocr_prohibido(img_gris, es_pagina1, cache=None, clave=None):
        raise AssertionError("una capa digital limpia no debe rasterizarse")

    monkeypatch.setattr(extraction, "_ocr_con_sello", _ocr_prohibido)
    resultado = extraction.extraer_texto_documento(
        _pdf_capa(CAPA_LIMPIA), "permiso.pdf", "application/pdf")
    assert resultado["metodo"] == "pdf-digital"
    assert "MARIA FERNANDA GOMEZ" in resultado["texto"]
    assert resultado["confianza"] >= 99


def test_capa_basura_con_ocr_vacio_conserva_la_capa(monkeypatch):
    """Sin motor (o página irrecuperable): la capa basura es mejor que nada y
    el pipeline degrada igual que hoy, sin lanzar."""
    from acuusan_ocr import extraction
    # El pipeline llama _ocr_con_sello(img_gris, es_pagina1=...): el parámetro
    # debe llamarse igual o el TypeError cae en el except y sale 'ilegible'.
    monkeypatch.setattr(extraction, "_ocr_con_sello",
                        lambda img_gris, es_pagina1, cache=None, clave=None: ("", -1.0))
    resultado = extraction.extraer_texto_documento(
        _pdf_capa(CAPA_BASURA), "permiso.pdf", "application/pdf")
    assert resultado["metodo"] == "pdf-digital"
    assert "SOLlcrruD" in resultado["texto"]  # la capa original se conserva


def test_capa_corta_anotacion_se_reemplaza_por_ocr(monkeypatch):
    """Página escaneada con una ANOTACIÓN digital corta ("Recibido conforme",
    <30 alfanum): la capa es imposible de puntuar (None) y no puede ganar por
    defecto — el OCR que leyó el cuerpo completo la reemplaza (regresión del
    baseline detectada por verificación adversarial)."""
    from acuusan_ocr import extraction

    def _ocr_bueno(img_gris, es_pagina1, cache=None, clave=None):
        return TEXTO_OCR_BUENO, 79.3

    monkeypatch.setattr(extraction, "_ocr_con_sello", _ocr_bueno)
    resultado = extraction.extraer_texto_documento(
        _pdf_capa("Recibido conforme"), "permiso.pdf", "application/pdf")
    assert resultado["metodo"] == "ocr-tesseract"
    assert "MARIA FERNANDA GOMEZ" in resultado["texto"]
    assert "Recibido conforme" not in resultado["texto"]


def test_ocr_peor_que_la_capa_no_la_reemplaza(monkeypatch):
    """'Consérvese el mejor texto': si nuestro OCR puntúa IGUAL o PEOR que la
    capa (p. ej. manuscrito ilegible), la capa se queda."""
    from acuusan_ocr import extraction

    def _ocr_igual_de_malo(img_gris, es_pagina1, cache=None, clave=None):
        # Mismo nivel de basura léxica que la capa: no hay mejora
        return "SOLlcrrzD PERMlsz LABzRAL NOMBRE famgr jz", 12.0

    monkeypatch.setattr(extraction, "_ocr_con_sello", _ocr_igual_de_malo)
    resultado = extraction.extraer_texto_documento(
        _pdf_capa(CAPA_BASURA), "permiso.pdf", "application/pdf")
    assert "SOLlcrruD" in resultado["texto"]  # la capa ganó


@requiere_ocr
def test_capa_invisible_basura_con_imagen_limpia():
    """Escenario real del escáner: capa de texto OCULTA rota + imagen limpia.
    Se construye con texto en modo invisible (render_mode=3) tapado por la
    imagen del documento legible."""
    from PIL import Image
    img = _imagen_texto(borroso=False)
    buffer_img = io.BytesIO()
    img.save(buffer_img, format="PNG")
    doc = fitz.open()
    pagina = doc.new_page()
    for i, linea in enumerate(CAPA_BASURA.split("\n")):
        pagina.insert_text((10, 20 + 15 * i), linea, fontsize=8,
                           fontname="helv", render_mode=3)  # invisible
    pagina.insert_image(fitz.Rect(0, 0, 612, 792), stream=buffer_img.getvalue())
    resultado = extraer_texto_documento(doc.tobytes(), "escaner_roto.pdf", "application/pdf")
    # La capa basura no puede sobrevivir: el OCR de la imagen lee el documento.
    # No se exige el dígito exacto del radicado: el pase del sello se concatena
    # con el pase completo y a 300dpi Tesseract a veces transpone un dígito —
    # lo que la compuerta garantiza es que la capa "SOLlcrruD" fue reemplazada
    # por texto legible real (REPUBLICA… es la primera línea pintada).
    assert resultado["metodo"] != "pdf-digital"
    assert "REPUBLICA" in resultado["texto"].upper()
    assert "SOLlcrruD" not in resultado["texto"]
