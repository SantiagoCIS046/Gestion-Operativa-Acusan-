# -*- coding: utf-8 -*-
r"""
extraction.py — Pipeline de extracción de texto de documentos (PDF / imagen)
─────────────────────────────────────────────────────────────────────────────
Núcleo del motor OCR Python de Acuusan. Diseñado para documentos aleatorios,
nunca repetidos y a menudo borrosos o con letra poco legible.

Estrategia (máxima extracción sin inventar):
  1. PDF digital  → texto embebido por página (PyMuPDF, instantáneo).
  2. PDF escaneado / imagen → rasterizado 300 dpi en gris → DOS variantes de
     preprocesado OpenCV (A: borroso · B: contraste) → multi-pase Tesseract
     (PSM 6/3/11) → gana el pase con mejor confianza media por palabra.
  3. Pase extra del SELLO (40% superior de la página 1) que se CONCATENA al
     texto ganador: los sellos de ventanilla se pierden en el OCR de página
     completa. Nunca se mezclan los pases competidores entre sí.
  4. La decisión digital/escaneado es POR PÁGINA (los híbridos existen).

Presupuesto de cómputo (documentos arbitrarios → límites duros):
  · OCR_MAX_PAGINAS (6) páginas procesadas como máximo.
  · Render directo en gris a OCR_DPI (300) con tope de 3200 px por lado.
  · timeout de Tesseract por pase (OCR_TIMEOUT_TESS, 20 s): un binario
    colgado no cuelga el request.

REGLA DE ORO compartida con los parsers: aquí solo se compite y selecciona
texto; ninguna etapa genera o interpreta contenido. El dato sale del
documento o el campo queda vacío.

Degradación elegante: si falta fitz/cv2/pytesseract o el binario de
Tesseract no existe, las funciones devuelven texto vacío y un método
informativo — jamás lanzan. Un PDF digital sigue siendo legible sin
Tesseract.
"""

import io
import os
import re
import shutil
import unicodedata

# ── Dependencias con degradación (ninguna es obligatoria para importar) ─────
try:
    import pymupdf as fitz  # PyMuPDF (nombre moderno; 'fitz' está deprecado)
except ImportError:  # pragma: no cover
    try:
        import fitz
    except ImportError:
        fitz = None

try:
    import cv2
    import numpy as np
except ImportError:  # pragma: no cover
    cv2 = None
    np = None

try:
    import pytesseract
    from PIL import Image
except ImportError:  # pragma: no cover
    pytesseract = None
    Image = None

# ── Constantes y variables de entorno ────────────────────────────────────────
TESSDATA_DIR_PREDETERMINADO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tessdata")
LENGUAJE = "spa"
LADO_MAX_PX = 3200          # tope del lado mayor tras el rasterizado
UMBRAL_DIGITAL = 30         # chars alfanuméricos mínimos para considerar página digital
MIN_ALTO_STAMP = 120        # px mínimos del recorte del sello para que valga la pena

# ── Compuerta de calidad de la capa de texto digital ────────────────────────
# Un PDF escaneado puede traer una capa de texto OCULTA producida por el OCR del
# propio escáner, y esa capa puede ser BASURA ("SOLlcrruD PERMlsO LAiroRAL"):
# pasa el umbral de 30 alfanuméricos, se etiqueta pdf-digital/99% y nuestro
# Tesseract (mejor) jamás corre. La compuerta puntúa la capa con dos señales
# calibradas contra PDFs reales (basura 0.07–0.16 / limpia 0.24–0.38):
#   · score léxico: proporción de tokens presentes en un léxico español +
#     institucional mínimo (palabras funcionales, rótulos del formulario,
#     membrete, meses).
#   · anomalía de caja: tokens con mayúsculas y minúsculas mezcladas
#     ("GESTtoN"), firma típica del OCR del escáner.
SCORE_DIGITAL_MIN = 0.20    # por debajo → capa desconfiada
ANOMALIA_DIGITAL_MAX = 0.15  # por encima → capa desconfiada
MIN_TOKENS_CALIDAD = 8      # con menos tokens no hay señal: se confía (igual que hoy)

_LEXICO_DIGITAL = frozenset("""del los las una uno con para por que este esta estos estas sus nuestro
fecha hora horas nombre nombres completo cedula cargo area dependencia departamento
motivo tipo permiso solicitud laboral auxiliar observacion observaciones firma
solicitante jefe inmediato directora director administrativa administrativo gerencia
general empresa acueducto alcantarillado aseo gestion energetica alumbrado publico
publica san gil santander colombia republica acuasan agua vida compensatorio medico
medica calamidad domestica estudio capacitacion personal caso cita adjunte soporte
jornada completa entrada salida dia dias mes ano registraduria electoral votacion
jurado certificado orden remision especialista paciente usuario eps fundacion
contratista ciudad municipio senor senora radicado remitente asunto folios respuesta
peticion queja reclamo referencia anexo direccion telefono correo
vo bo autoriza aprobo codigo version""".split())

_MESES_DIGITAL = frozenset(
    "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre "
    "diciembre ene feb mar abr may jun jul ago sep sept oct nov dic".split())


def _sin_acentos(s):
    nfd = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in nfd if not unicodedata.combining(ch))


def _puntaje_capa_digital(texto):
    """(score_léxico, tasa_anomalía) de una capa de texto digital, o None si hay
    demasiados pocos tokens para juzgar (páginas numéricas/taquillas)."""
    tokens = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}", texto or "")
    if len(tokens) < MIN_TOKENS_CALIDAD:
        return None
    limpios = [_sin_acentos(t).lower() for t in tokens]
    hits = sum(1 for t in limpios if t in _LEXICO_DIGITAL or t in _MESES_DIGITAL)
    anomalias = 0
    for token, limpio in zip(tokens, limpios):
        if limpio in _LEXICO_DIGITAL or limpio in _MESES_DIGITAL:
            continue
        mayusculas = sum(1 for ch in token if ch.isupper())
        if mayusculas >= 2 and any(ch.islower() for ch in token):
            anomalias += 1
    n = len(tokens)
    return hits / n, anomalias / n


def _capa_digital_confiable(texto):
    """True si la capa digital de la página merece confianza (o no hay señal
    suficiente para juzgar). False si huele a OCR-basura del escáner."""
    puntaje = _puntaje_capa_digital(texto)
    if puntaje is None:
        return True
    score, anomalia = puntaje
    return score >= SCORE_DIGITAL_MIN and anomalia <= ANOMALIA_DIGITAL_MAX

_RUTAS_TESSERACT_WINDOWS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def _env_int(nombre, predeterminado):
    try:
        return int(os.environ.get(nombre, "") or predeterminado)
    except (TypeError, ValueError):
        return predeterminado


def _env_float(nombre, predeterminado):
    try:
        return float(os.environ.get(nombre, "") or predeterminado)
    except (TypeError, ValueError):
        return predeterminado


def _localizar_tesseract():
    """Resuelve el binario de Tesseract: env OCR_TESSERACT_CMD → PATH → rutas
    comunes de Windows. Devuelve ruta o None."""
    cmd = os.environ.get("OCR_TESSERACT_CMD", "").strip()
    if cmd and os.path.isfile(cmd):
        return cmd
    en_path = shutil.which("tesseract")
    if en_path:
        return en_path
    for ruta in _RUTAS_TESSERACT_WINDOWS:
        if os.path.isfile(ruta):
            return ruta
    return None


def _tessdata_dir():
    return os.environ.get("OCR_TESSDATA_DIR", "").strip() or TESSDATA_DIR_PREDETERMINADO


def _configurar_pytesseract():

    """Apunta pytesseract al binario localizado y fija TESSDATA_PREFIX al
    directorio del repo. Devuelve True si está usable.

    TESSDATA_PREFIX (y no --tessdata-dir en el config): el quoting de ese
    flag se rompe en Windows con rutas que contienen espacios — el error
    típico es que Tesseract intenta abrir `"C:\\...\\tessdata"/spa.traineddata`
    con las comillas pegadas al valor."""
    if pytesseract is None:
        return False
    ruta = _localizar_tesseract()
    if not ruta:
        return False
    pytesseract.pytesseract.tesseract_cmd = ruta
    os.environ["TESSDATA_PREFIX"] = _tessdata_dir()
    return True


# Caché simple del estado de motores (se evalúa una vez por proceso)
_estado_cache = None


def estado_motores(forzar=False):
    """Flags de disponibilidad para /health: fitz, tesseract y español."""
    global _estado_cache
    if _estado_cache is not None and not forzar:
        return _estado_cache
    tesseract_ok = _configurar_pytesseract()
    spa_ok = False
    if tesseract_ok:
        try:
            lenguajes = pytesseract.get_languages(config="")
            spa_ok = LENGUAJE in lenguajes
        except Exception:
            spa_ok = False
    _estado_cache = {
        "fitz_disponible": fitz is not None,
        "cv2_disponible": cv2 is not None,
        "tesseract_disponible": tesseract_ok,
        "spa_disponible": spa_ok,
    }
    return _estado_cache


# ── Preprocesado OpenCV: dos variantes complementarias ──────────────────────

def _asegurar_np(img_gris):
    return np.asarray(img_gris, dtype=np.uint8)


def _preprocesar_variante_a(img_gris):
    """Variante A (borroso): upscale ×2 si la resolución es baja → denoise →
    sharpen → umbral adaptativo. Recupera tinta difusa."""
    gris = _asegurar_np(img_gris)
    if max(gris.shape) < 1600:
        gris = cv2.resize(gris, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    gris = cv2.fastNlMeansDenoising(gris, None, h=10)
    kernel_nitido = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    gris = cv2.filter2D(gris, -1, kernel_nitido)
    return cv2.adaptiveThreshold(
        gris, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)


def _preprocesar_variante_b(img_gris):
    """Variante B (contraste): Otsu global + apertura morfológica. Para
    documentos con fondo sucio o sombreado suave."""
    gris = _asegurar_np(img_gris)
    if max(gris.shape) < 1600:
        gris = cv2.resize(gris, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    _, binarizado = cv2.threshold(gris, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return cv2.morphologyEx(binarizado, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))


def _variantes_preprocesadas(img_gris):
    """Devuelve [(nombre, imagen)] según cv2 disponible; sin cv2 degrada a la
    imagen en gris simple (OCR más débil pero funcional)."""
    if cv2 is None or np is None:
        return [("gris", _asegurar_np(img_gris))]
    return [
        ("A-borroso", _preprocesar_variante_a(img_gris)),
        ("B-contraste", _preprocesar_variante_b(img_gris)),
    ]


def _variantes_ab(img_gris, cache=None, clave=None):
    """Devuelve (variante_a, variante_b) para los pases de una página.

    La variante A (fastNlMeansDenoising) es ~98% del costo de preproceso y
    entre la ronda 1 y el refuerzo se recalculaba IDÉNTICA sobre los mismos
    píxeles. Con un cache (dict por página, creado por request) la A se
    calcula una vez por página; la B (~0.02s) se recalcula siempre para no
    retener dos arrays por página en RAM. Mismas imágenes → mismos
    resultados: el caché no altera ninguna salida.

    Tope de 3 páginas cacheadas (~8.4MB c/u): el worker free de 512MB ya
    muestra presión de memoria; los campos de un permiso viven casi todos
    en la página 1, así que páginas 4+ recalculan como hoy."""
    if cv2 is None or np is None:
        gris = _asegurar_np(img_gris)
        return gris, gris
    if cache is not None and clave in cache:
        return cache[clave], _preprocesar_variante_b(img_gris)
    a = _preprocesar_variante_a(img_gris)
    b = _preprocesar_variante_b(img_gris)
    if cache is not None and len(cache) < 3:
        cache[clave] = a
    return a, b


# ── Multi-pase Tesseract con selección por confianza ─────────────────────────

def _config_psm(psm):
    return (
        f'--oem 1 --psm {psm} '
        f'-c preserve_interword_spaces=1 -c user_defined_dpi=300'
    )


def _ocr_un_pase(imagen_np, psm):
    """Un pase de Tesseract sobre una imagen ya preprocesada. Devuelve
    (texto, conf_media, n_palabras); en timeout/error devuelve ('', -1, 0)."""
    # El tessdata del repo se resuelve por TESSDATA_PREFIX (fijado en
    # _configurar_pytesseract); reasegurar aquí cubre flujos que lleguen sin
    # pasar por estado_motores.
    os.environ["TESSDATA_PREFIX"] = _tessdata_dir()
    # 90s (no 20): en el worker free de Render (0.1 CPU) un pase LSTM sobre una
    # página 300dpi tarda 25-40s — con el tope de 20s TODOS los pases morían al
    # vencerse y el documento salía 'ilegible' con texto vacío (medido en
    # producción: 6 pases × 20s + preproceso ≈ los 183s de las corridas). Local
    # (CPU de escritorio) un pase toma 1-2s y el tope nunca se toca.
    timeout = _env_int("OCR_TIMEOUT_TESS", 90)
    try:
        datos = pytesseract.image_to_data(
            imagen_np, lang=LENGUAJE, config=_config_psm(psm),
            output_type=pytesseract.Output.DICT, timeout=timeout)
    except Exception:
        return "", -1.0, 0

    lineas = {}
    confs = []
    n_palabras = 0
    for i, palabra in enumerate(datos.get("text", [])):
        palabra = (palabra or "").strip()
        try:
            conf = float(datos["conf"][i])
        except (TypeError, ValueError, IndexError):
            conf = -1.0
        if not palabra or conf < 0:
            continue
        clave = (datos["block_num"][i], datos["par_num"][i], datos["line_num"][i])
        lineas.setdefault(clave, []).append(palabra)
        n_palabras += 1
        if len(palabra) >= 2:
            confs.append(conf)
    texto = "\n".join(" ".join(palabras) for palabras in lineas.values())
    conf_media = (sum(confs) / len(confs)) if confs else -1.0
    return texto, conf_media, n_palabras


def _mejor_ocr(imagenes_por_pase, conf_suficiente=None):
    """Corre los pases indicados sobre imágenes preprocesadas y devuelve el
    TEXTO del pase ganador (mayor confianza media; desempate por nº de
    palabras). Los pases nunca se mezclan entre sí.

    conf_suficiente: si un pase alcanza esa confianza media, los pases
    siguientes no se corren — en páginas limpias el primero (A/PSM6) ya era
    el ganador y los restantes solo competían para perder. El pase del
    sello y los pases del refuerzo no usan el corte (cobertura primero)."""
    mejor = ("", -1.0, 0)
    for imagen_np, psm in imagenes_por_pase:
        texto, conf, n = _ocr_un_pase(imagen_np, psm)
        if texto and (conf, n) > (mejor[1], mejor[2]):
            mejor = (texto, conf, n)
        if conf_suficiente and texto and conf >= conf_suficiente:
            break
    return mejor


def _ocr_con_sello(img_gris, es_pagina1, cache=None, clave=None):
    """Multi-pase completo de una página. En la página 1 añade el pase del
    sello (40% superior, PSM 6, variante B) que se CONCATENA al ganador: el
    sello físico de ventanilla casi nunca sobrevive al OCR de página completa.
    Devuelve (texto, conf_media)."""
    a, b = _variantes_ab(img_gris, cache=cache, clave=clave)

    if es_pagina1:
        pases = [(a, 6), (b, 3), (a, 11)]
    else:
        pases = [(a, 6), (b, 3)]

    # Pase adaptativo: umbral de confianza a partir del cual no se corren
    # los pases restantes de la página (OCR_SALTO_CONF=0 lo desactiva).
    conf_suficiente = _env_float("OCR_SALTO_CONF", 80.0) or None
    texto, conf, _ = _mejor_ocr(pases, conf_suficiente=conf_suficiente)

    if es_pagina1:
        alto = b.shape[0]
        alto_sello = int(alto * 0.40)
        if alto_sello >= MIN_ALTO_STAMP:
            texto_sello, _, _ = _ocr_un_pase(b[:alto_sello, :], 6)
            if texto_sello.strip():
                texto = texto_sello.strip() + "\n" + texto
    return texto, conf


# ── Refuerzo: segunda recolección forzada para campos faltantes ──────────────

# Pases EXTRA del refuerzo: 4 = columna única (un formulario es una columna de
# rótulos) y 12 = texto disperso con OSD (palabras manuscritas sueltas que el
# pase de bloque se salta). Un rótulo ilegible en el pase ganador de la
# primera pasada puede ser legible en uno de estos.
PSM_REFUERZO = (4, 12)


def _ocr_variantes_pagina(img_gris, es_pagina1, cache=None, clave=None):
    """Pases adicionales del refuerzo sobre una página ya rasterizada.
    Devuelve [(texto, conf)] de los pases que produjeron texto; en la página 1
    el sello (40% superior) se antepone igual que en la primera pasada."""
    a, b = _variantes_ab(img_gris, cache=cache, clave=clave)

    sello = ""
    if es_pagina1:
        alto_sello = int(b.shape[0] * 0.40)
        if alto_sello >= MIN_ALTO_STAMP:
            texto_sello, _, _ = _ocr_un_pase(b[:alto_sello, :], 6)
            sello = texto_sello.strip()

    textos = []
    for imagen_np, psm in zip((a, b), PSM_REFUERZO):
        texto, conf, _ = _ocr_un_pase(imagen_np, psm)
        if texto.strip():
            textos.append(((sello + "\n" + texto) if sello else texto, conf))
    return textos


def refuerzo_texto_documento(bytes_archivo, nombre_archivo="", mime_type="",
                             on_etapa=None, cache_variantes=None):
    """Segunda recolección FORZADA del documento, dirigida a los campos que la
    primera pasada dejó vacíos. Devuelve {'texto', 'texto_pagina1'} con los
    pases EXTRA concatenados — un texto DISTINTO al de la primera pasada, no
    una re-lectura idéntica. Una única ronda, sin gate por página: la decisión
    de correr ya la tomó el servidor (había campos vacíos y el documento era
    escaneado). Degradación elegante: sin motor o con entrada rara → vacío.

    cache_variantes: el dict de variantes A de la ronda 1 (ver
    _variantes_ab) — el refuerzo reutiliza el preproceso caro de las mismas
    páginas en vez de recalcular fastNlMeansDenoising sobre píxeles idénticos."""
    vacio = {"texto": "", "texto_pagina1": ""}
    if not bytes_archivo:
        return vacio
    if pytesseract is None or Image is None or not estado_motores()["tesseract_disponible"]:
        return vacio
    tipo = _clasificar(bytes_archivo, nombre_archivo, mime_type)
    try:
        if tipo == "imagen":
            if on_etapa:
                on_etapa("Refuerzo: OCR de imagen (campos faltantes)", 0.1)
            img = Image.open(io.BytesIO(bytes_archivo)).convert("L")
            variantes = _ocr_variantes_pagina(img, es_pagina1=True,
                                              cache=cache_variantes, clave=0)
            texto = "\n".join(t for t, _ in variantes)
            return {"texto": texto, "texto_pagina1": texto}
        if tipo != "pdf" or fitz is None:
            return vacio

        dpi = _env_int("OCR_DPI", 300)
        max_paginas = _env_int("OCR_MAX_PAGINAS", 6)
        matriz = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        paginas = []
        with fitz.open(stream=bytes_archivo, filetype="pdf") as doc:
            if doc.needs_pass:
                try:
                    doc.authenticate("")
                except Exception:
                    pass
            total = doc.page_count
            for indice in range(min(total, max_paginas)):
                if on_etapa:
                    on_etapa(f"Refuerzo página {indice + 1} (campos faltantes)",
                             indice / max(total, 1))
                pix = doc[indice].get_pixmap(matrix=matriz, colorspace=fitz.csGRAY)
                img_gris = _pixmap_a_imagen_gris(pix)
                textos_pagina = _ocr_variantes_pagina(
                    img_gris, es_pagina1=(indice == 0),
                    cache=cache_variantes, clave=indice)
                if textos_pagina:
                    paginas.append("\n".join(t for t, _ in textos_pagina))
        return {"texto": "\n\n".join(paginas),
                "texto_pagina1": paginas[0] if paginas else ""}
    except Exception:
        return vacio


# ── Rasterizado y lectura de páginas ─────────────────────────────────────────

def _cuenta_alfanumericos(texto):
    return len(re.findall(r"[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]", texto or ""))


def _pixmap_a_imagen_gris(pix):
    """Pixmap gris de PyMuPDF → PIL Image L, con tope de lado LADO_MAX_PX."""
    img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
    lado = max(img.size)
    if lado > LADO_MAX_PX:
        escala = LADO_MAX_PX / lado
        nuevo = (max(1, round(img.width * escala)), max(1, round(img.height * escala)))
        img = img.resize(nuevo, Image.BICUBIC)
    return img


def _pdf_a_texto(bytes_pdf, on_etapa=None, cache_variantes=None):
    """Recorre el PDF página a página: texto embebido si es sustancial, si no
    rasterizado + OCR. Devuelve (textos_por_pagina, confianzas_ocr,
    n_paginas_doc, hubo_digital, hubo_ocr)."""
    dpi = _env_int("OCR_DPI", 300)
    max_paginas = _env_int("OCR_MAX_PAGINAS", 6)
    zoom = dpi / 72.0
    matriz = fitz.Matrix(zoom, zoom)

    texto_paginas = []
    confianzas = []
    hubo_digital = False
    hubo_ocr = False

    with fitz.open(stream=bytes_pdf, filetype="pdf") as doc:
        if doc.needs_pass:
            try:
                doc.authenticate("")
            except Exception:
                pass
        total = doc.page_count
        for indice in range(min(total, max_paginas)):
            if on_etapa:
                on_etapa(f"Página {indice + 1} de {min(total, max_paginas)}", indice / max(total, 1))
            pagina = doc[indice]
            texto_digital = pagina.get_text("text") or ""
            if (_cuenta_alfanumericos(texto_digital) >= UMBRAL_DIGITAL
                    and _capa_digital_confiable(texto_digital)):
                texto_paginas.append(texto_digital)
                confianzas.append(None)  # la capa de texto es autoridad
                hubo_digital = True
                continue
            # Capa digital ausente, corta… o BASURA del OCR del escáner: se
            # rasteriza y se queda el MEJOR texto. El propio Tesseract sobre el
            # escaneo a 300dpi supera con holgura a la capa rota ("SOLlcrruD
            # PERMlsO" → "SOLICITUD PERMISO"); si el OCR no produce nada (sin
            # motor, página irrecuperable) la capa original es mejor que nada.
            pix = pagina.get_pixmap(matrix=matriz, colorspace=fitz.csGRAY)
            img_gris = _pixmap_a_imagen_gris(pix)
            if on_etapa:
                on_etapa(f"OCR página {indice + 1} (documento escaneado)", indice / max(total, 1))
            texto_ocr, conf = _ocr_con_sello(img_gris, es_pagina1=(indice == 0),
                                              cache=cache_variantes, clave=indice)
            puntaje_digital = _puntaje_capa_digital(texto_digital)
            puntaje_ocr = _puntaje_capa_digital(texto_ocr)
            usa_ocr = bool(texto_ocr.strip()) and (
                not texto_digital.strip()
                # Capa corta imposible de juzgar ("Recibido conforme", foliatura,
                # marca de agua): sin señal no puede ganar por defecto — el OCR
                # que produjo texto lee la página completa y la reemplaza.
                or puntaje_digital is None
                or (puntaje_ocr is not None and puntaje_ocr[0] > puntaje_digital[0])
            )
            if usa_ocr:
                texto_paginas.append(texto_ocr)
                confianzas.append(conf if texto_ocr else None)
                hubo_ocr = True
            else:
                texto_paginas.append(texto_digital)
                confianzas.append(None)
                hubo_digital = bool(texto_digital.strip())
    return texto_paginas, confianzas, total, hubo_digital, hubo_ocr


# ── API pública ──────────────────────────────────────────────────────────────

def _clasificar(bytes_archivo, nombre_archivo, mime_type):
    """Clasifica por magic bytes > mime > extensión. Devuelve 'pdf' | 'imagen'
    | 'texto' | None."""
    if bytes_archivo.startswith(b"%PDF"):
        return "pdf"
    if bytes_archivo[:8] == b"\x89PNG\r\n\x1a\n" or bytes_archivo[:3] == b"\xff\xd8\xff" \
            or bytes_archivo[:6] in (b"GIF87a", b"GIF89a") or bytes_archivo[:2] == b"BM":
        return "imagen"
    mime = (mime_type or "").lower()
    nombre = (nombre_archivo or "").lower()
    if "pdf" in mime or nombre.endswith(".pdf"):
        return "pdf"
    if mime.startswith("image/") or nombre.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")):
        return "imagen"
    if "text" in mime or nombre.endswith((".txt", ".csv", ".md")):
        return "texto"
    return None


def extraer_texto_documento(bytes_archivo, nombre_archivo="", mime_type="",
                            on_etapa=None, cache_variantes=None):
    """Punto de entrada del pipeline. Devuelve
    {texto, texto_pagina1, metodo, paginas, confianza} — sin lanzar jamás.
    metodo ∈ 'pdf-digital' | 'ocr-tesseract' | 'hibrido' | 'imagen-ocr' |
    'texto-plano' | 'sin-motor' | 'ilegible'.

    cache_variantes: dict opcional (uno por request) donde se memoiza la
    variante A de cada página OCR-eada, para que el refuerzo posterior no
    recalcule fastNlMeansDenoising sobre píxeles idénticos."""
    vacio = {"texto": "", "texto_pagina1": "", "metodo": "ilegible",
             "paginas": 0, "confianza": 0.0}
    if not bytes_archivo:
        return vacio

    tipo = _clasificar(bytes_archivo, nombre_archivo, mime_type)

    # Archivo de texto plano: lectura directa
    if tipo == "texto":
        texto = bytes_archivo.decode("utf-8", errors="ignore")
        return {"texto": texto, "texto_pagina1": texto, "metodo": "texto-plano",
                "paginas": 1, "confianza": 100.0}

    # Imagen suelta: mismo pipeline de página 1 (con pase de sello)
    if tipo == "imagen":
        if pytesseract is None or Image is None or not estado_motores()["tesseract_disponible"]:
            return {**vacio, "metodo": "sin-motor"}
        try:
            if on_etapa:
                on_etapa("OCR de imagen", 0.1)
            img = Image.open(io.BytesIO(bytes_archivo))
            img_gris = img.convert("L")
            texto, conf = _ocr_con_sello(img_gris, es_pagina1=True,
                                         cache=cache_variantes, clave=0)
            return {"texto": texto, "texto_pagina1": texto,
                    "metodo": "imagen-ocr" if texto else "ilegible",
                    "paginas": 1, "confianza": round(max(conf, 0.0), 1)}
        except Exception:
            return vacio

    # PDF: digital por página + OCR donde haga falta
    if tipo == "pdf":
        if fitz is None:
            return {**vacio, "metodo": "sin-motor"}
        try:
            if on_etapa:
                on_etapa("Abriendo documento", 0.0)
            texto_paginas, confianzas, total, hubo_digital, hubo_ocr = \
                _pdf_a_texto(bytes_archivo, on_etapa, cache_variantes)
        except Exception:
            return vacio
        if not any(t.strip() for t in texto_paginas):
            return {**vacio, "paginas": total}
        texto = "\n\n".join(texto_paginas)
        if hubo_digital and hubo_ocr:
            metodo = "hibrido"
        elif hubo_digital:
            metodo = "pdf-digital"
        else:
            metodo = "ocr-tesseract"
        confs_ocr = [c for c in confianzas if c is not None]
        if confs_ocr:
            # confianza media de las páginas OCR; las digitales son autoridad
            confianza = round(sum(confs_ocr) / len(confs_ocr), 1)
        else:
            confianza = 99.0  # todo el texto vino de la capa digital
        return {"texto": texto, "texto_pagina1": texto_paginas[0] if texto_paginas else "",
                "metodo": metodo, "paginas": total, "confianza": confianza}

    return vacio
