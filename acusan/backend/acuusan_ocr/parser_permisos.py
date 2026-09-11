# -*- coding: utf-8 -*-
r"""
parser_permisos.py — Motor de extracción de campos para permisos laborales
─────────────────────────────────────────────────────────────────────────────
Porte fiel de acusan/frontend/src/modules/permisos/services/parserPermisosOcr.js
(versión HEAD post-Fase 0, corpus 49/49). Módulo PURO: recibe el texto OCR del
documento y produce los campos del formulario.

REGLA DE ORO (inquebrantable): el dato sale del documento o el campo queda
vacío. Jamás se inventa contenido "lógico" que el PDF no respalde.

Notas del porte JS→Python:
  · \b de Python es Unicode (Á SÍ es word-char): el bug de JS donde "ÁREA:"
    a inicio de línea no generaba frontera aquí no existe; aún así el rótulo
    de área usa lookbehind explícito para equivalencia exacta con el JS.
  · JS .replace(sin /g) reemplaza SOLO la primera aparición → re.sub(count=1).
  · Los grupos de reemplazo usan \g<1>… para evitar la ambigüedad de $10.
"""

import datetime
import re
import unicodedata

# ─── Normalización base del texto OCR ────────────────────────────────────────


def normalizar_texto_ocr(texto):
    """Corrige confusiones típicas de escaneo PRESERVANDO las columnas (doble
    espacio = salto de columna del reconstructor espacial / Tesseract)."""
    if not texto:
        texto = ""
    t = re.sub(r"\r\n?", "\n", texto)
    t = re.sub(r"\t", " ", t)
    t = re.sub(r"[ ]{3,}", "  ", t)
    t = re.sub(r"[ ]+\n", "\n", t)
    t = re.sub(r"\n[ ]+", "\n", t)
    t = re.sub(r"[–—‒]", "-", t)
    t = re.sub(r"(\d)O(\d)", r"\g<1>0\g<2>", t)
    t = re.sub(r"O(\d{1,2}[-/.])(\d)", r"0\g<1>\g<2>", t)
    t = re.sub(r"(\d[-/.])O(\d)", r"\g<1>0\g<2>", t)
    t = re.sub(r"(\d)l(\d)", r"\g<1>1\g<2>", t)
    t = re.sub(r"(\d{1,2})[.\-/]\s+(\d{1,2})", r"\g<1>-\g<2>", t)
    t = re.sub(r"([0-9])(am|pm)\b", r"\g<1> \g<2>", t, flags=re.I)
    t = re.sub(r"(\d)\.(\d{2})\s*(am|pm)", r"\g<1>:\g<2>\g<3>", t, flags=re.I)
    return t


_LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ"
_LETRAS_RE = re.compile(r"[^" + _LETRAS + r"]")


def _desocrizar_token(token):
    letras = _LETRAS_RE.sub("", token)
    if len(letras) < 3 or not re.search(r"[0-9]", token):
        return token
    return (token.replace("0", "O").replace("1", "I").replace("5", "S")
                .replace("8", "B").replace("6", "G"))


def desocrizar_etiquetas(texto):
    """Des-OCRiza ETIQUETAS ("N0MBRE C0MPLET0:" → "NOMBRE COMPLETO:"): corrige
    SOLO tokens con ≥3 letras y ≥1 dígito; fechas, NIT y valores quedan intactos."""
    if not texto:
        texto = ""
    rx_seq = re.compile(
        "[" + _LETRAS + r"0-9]{3,15}(?:\s+[" + _LETRAS + r"0-9]{3,15}){0,2}(?=\s*:)"
    )
    rx_tok = re.compile("[" + _LETRAS + r"0-9]{3,15}")
    return rx_seq.sub(
        lambda seq: rx_tok.sub(lambda m: _desocrizar_token(m.group(0)), seq.group(0)),
        texto,
    )


# ─── Limpiadores de valores ──────────────────────────────────────────────────


def limpiar_nombre_completo(nombre_raw):
    """Nombre propio en mayúsculas limpias; la letra borrosa leída como número
    ("MAR1A", "G0MEZ") se corrige antes de retirar dígitos."""
    if not nombre_raw:
        return ""
    n = re.sub(r"^PERMISO\s+", "", nombre_raw, count=1, flags=re.I)
    n = re.sub(r"202[0-9]{5,}.*$", "", n, count=1, flags=re.I)
    n = re.sub(r"\.pdf$", "", n, count=1, flags=re.I)

    def _corregir_token(m):
        tok = m.group(0)
        letras = _LETRAS_RE.sub("", tok)
        if len(letras) < 3:  # "2026" o "098" no son palabras
            return tok
        return (tok.replace("0", "O").replace("1", "I").replace("5", "S")
                   .replace("8", "B").replace("6", "G"))

    n = re.sub(r"\b[" + _LETRAS + r"]*[0156][" + _LETRAS + r"]*\b", _corregir_token, n)
    n = re.sub(r"[0-9_\-.:;,()]+", " ", n)
    n = re.sub(r"\s{2,}", " ", n).strip()
    n = re.sub(r"\b(?:PERMISO|ACUASAN|ESCANEO|SCAN|SOLICITUD|ESCANEAR|DOC)\b", "", n, flags=re.I)
    n = re.sub(r"\s{2,}", " ", n).strip()
    if len(n) < 5:
        return ""
    return n.upper()


def normalizar_cargo_y_dependencia(texto):
    """Diccionario institucional de cargos y áreas de Acuasan."""
    c = (texto or "").lower()
    if "potabiliz" in c or "lider" in c or "líder" in c or "planta" in c or "tratam" in c:
        return {"cargo": "Líder de Potabilización", "dependencia": "Planta de Tratamiento / Potabilización"}
    if "aux" in c and ("adt" in c or "adm" in c or "ada" in c or "tivo" in c):
        return {"cargo": "Auxiliar Administrativo", "dependencia": "Administrativa"}
    if "fontan" in c:
        return {"cargo": "Fontanero", "dependencia": "Distribución y Redes"}
    if "alcant" in c or "redes" in c:
        return {"cargo": "Operario de Alcantarillado", "dependencia": "Alcantarillado"}
    if "conduct" in c:
        return {"cargo": "Conductor Operativo", "dependencia": "Operativa"}
    if "analist" in c or "fact" in c:
        return {"cargo": "Analista de Facturación y Cartera", "dependencia": "Comercial y Facturación"}
    return {"cargo": "Funcionario Acuasan", "dependencia": "Operativa"}


def _sin_tildes(s):
    nfd = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in nfd if not unicodedata.combining(ch))


def mapear_tipo_permiso(valor):
    """Mapea el valor rotulado "TIPO DE PERMISO: …" al nombre EXACTO del select
    del formulario; '' si no corresponde a ningún tipo conocido (no se adivina)."""
    v = _sin_tildes(str(valor or "").lower())
    v = re.sub(r"\s+", " ", v).strip()
    if not v:
        return ""
    if "compensatori" in v or "votacion" in v or "electoral" in v:
        return "Compensatorio"
    if "medic" in v or "salud" in v or "eps" in v:
        return "Cita Médica"
    if "calamidad" in v:
        return "Calamidad Doméstica"
    if "estudio" in v or "capacitacion" in v or "academ" in v:
        return "Estudio / Capacitación"
    if "personal" in v or "asunto" in v:
        return "Personal"
    return ""


# ─── Fechas ──────────────────────────────────────────────────────────────────

MESES_VARIACIONES = {
    "enero": 1, "ene": 1,
    "febrero": 2, "feb": 2,
    "marzo": 3, "mar": 3,
    "abril": 4, "abr": 4,
    "mayo": 5, "may": 5,
    "junio": 6, "jun": 6,
    "julio": 7, "jul": 7,
    "agosto": 8, "ago": 8, "agos": 8, "agoslo": 8, "agto": 8, "agost": 8, "qgosto": 8,
    "septiembre": 9, "setiembre": 9, "sep": 9, "sept": 9,
    "octubre": 10, "oct": 10,
    "noviembre": 11, "nov": 11,
    "diciembre": 12, "dic": 12,
}

NOMBRES_MES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
               "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


def es_fecha_real(dd, mm, aa):
    """Fecha de calendario real (rechaza 31/02/2026, 00/xx, mes 13…)."""
    try:
        d, m, a = int(dd), int(mm), int(aa)
    except (TypeError, ValueError):
        return False
    if not d or not m or not a or d < 1 or m < 1 or m > 12:
        return False
    try:
        fecha = datetime.date(a, m, d)
    except ValueError:
        return False
    return fecha.day == d and fecha.month == m and fecha.year == a


def _numero_de_mes(palabra):
    p = re.sub(r"[^a-záéíóúñ]", "", str(palabra or "").lower())
    if not p:
        return None
    for clave, valor in MESES_VARIACIONES.items():
        if p.startswith(clave) or clave.startswith(p):
            return valor
    return None


def _recolectar_fechas(texto, es_pagina1):
    """Todas las fechas del texto validadas como calendario real, con posición
    y contexto; se prefiere la rotulada FECHA/PERMISO, luego página 1, luego
    la primera del documento."""
    fechas = []
    rx_texto = re.compile(
        r"\b([0-3]?\d)\s+de\s+([a-záéíóúñ]{3,12})(?:\s+de|\s+del\s+a[nñ]o|\s+de\s+)?\s*(\d{4})\b",
        re.I,
    )
    rx_num = re.compile(r"\b([0-3]?\d)\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})\b")

    def anclar(m, mm, aa, tipo):
        anio = "20" + aa if len(aa) == 2 else aa
        if tipo == "texto":
            mes = _numero_de_mes(mm)
        else:
            mes = int(mm)
        if not mes:
            return
        if not es_fecha_real(m.group(1), str(mes).zfill(2), anio):
            return
        contexto_previo = texto[max(0, m.start() - 22):m.start()]
        rotulada = re.search(r"fecha|permiso|solicitud|del?\s*permiso", contexto_previo, re.I)
        fechas.append({
            "dd": str(int(m.group(1))).zfill(2),
            "mm": str(mes).zfill(2),
            "aa": anio,
            "idx": m.start(),
            "rotulada": bool(rotulada),
            "p1": es_pagina1,
            "tipo": tipo,
        })

    for m in rx_texto.finditer(texto):
        anclar(m, m.group(2), m.group(3), "texto")
    for m in rx_num.finditer(texto):
        anclar(m, m.group(2), m.group(3), "numero")
    return fechas


def _elegir_fecha(fechas):
    if not fechas:
        return None
    con_puntaje = [dict(f, puntaje=(3 if f["rotulada"] else 0) + (2 if f["p1"] else 0)
                        + (1 if f["tipo"] == "texto" else 0)) for f in fechas]
    con_puntaje.sort(key=lambda f: (-f["puntaje"], f["idx"]))
    return con_puntaje[0]


# ─── Horarios ────────────────────────────────────────────────────────────────


def _a24h(h, meridiano):
    """Hora + meridiano a 24h ("12 a.m." → 0, "12 m./12 p.m." → 12)."""
    m = re.sub(r"[\s.]", "", str(meridiano or "").lower())
    hh = h
    if m.startswith("a"):
        if hh == 12:
            hh = 0
    elif m.startswith("p"):
        if hh != 12:
            hh += 12
    elif m == "m" and hh == 12:
        hh = 12  # "12 m." = mediodía
    return hh


def _hora_valida(h, minuto):
    return 0 <= h <= 23 and 0 <= minuto <= 59


def _hhmm(h, minuto):
    return f"{h:02d}:{minuto:02d}"


def extraer_rango_horario(texto):
    """Rango horario explícito ("7:30 a 9:30 a.m.", "07:30-18:00", "de 8 a 12",
    "ENTRADA: 8:00 SALIDA: 12:00", "desde las 2:00 p.m. hasta las 4:00 p.m.",
    "de 8:00 a 12:00 horas"). Devuelve {horaInicio, horaFin, detalle} en 24h o
    None. Guardas: no cola de número mayor, no fechas "del 8 al 10 de agosto",
    horaFin estrictamente mayor que horaInicio."""
    if not texto:
        return None
    # Meridianos literales colombianos: se traducen ANTES del matching.
    t = re.sub(r"(\d)\s+de\s+la\s+ma[nñ]ana\b", r"\g<1> a.m.", texto, flags=re.I)
    t = re.sub(r"(\d)\s+de\s+la\s+tarde\b", r"\g<1> p.m.", t, flags=re.I)
    t = re.sub(r"(\d)\s+de\s+la\s+noche\b", r"\g<1> p.m.", t, flags=re.I)

    # Grupos: 1=prefijo 2=h1 3=min1 4=mer1 5=h2 6=min2 7=mer2. Guardas finales:
    # no cola de número mayor, no decimal, no continuación de fecha.
    rx_rango = re.compile(
        r"(^|[^\w.,:/-])\s*"
        r"(?:desde\s+(?:la[s]?\s+)?|de\s+(?:la[s]?\s+)?)?"
        r"(\d{1,2})(?:[:.h](\d{2}))?\s*"
        r"([ap]\.?\s*m\.?|m\.?)?\s*"
        r"(?:a\b|hasta(?:\s+la[s]?)?|al\b|-|–)\s*"
        r"(?:la[s]?\s+)?"
        r"(\d{1,2})(?:[:.h](\d{2}))?\s*"
        r"([ap]\.?\s*m\.?|m\.?)?"
        r"(?!\d)(?![.,]\d)(?!\s*[-/.]\s*\d)",
        re.I,
    )

    meses_rx = r"(?:ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)"

    candidatos = []
    for m in rx_rango.finditer(t):
        ini_idx = m.start() + len(m.group(1) or "")

        # "del 8 al 10 de agosto": días de fecha, no horas
        posterior = t[m.end():m.end() + 34]
        if re.search(r"^\s*(?:de\s+)?" + meses_rx + r"\b", posterior, re.I):
            continue
        previo = t[max(0, ini_idx - 14):ini_idx]
        if re.search(r"\b(?:del|d[ií]as?|d[ií]a)\s*$", previo, re.I):
            continue

        h1 = int(m.group(2))
        min1 = int(m.group(3)) if m.group(3) is not None else 0
        h2 = int(m.group(5))
        min2 = int(m.group(6)) if m.group(6) is not None else 0
        if not _hora_valida(h1, min1) or not _hora_valida(h2, min2):
            continue

        tiene_minutos = m.group(3) is not None or m.group(6) is not None
        tiene_meridiano = bool(m.group(4) or m.group(7))
        rotulado_previo = re.search(
            r"hora|horario|entrada|salida|permiso",
            t[max(0, ini_idx - 18):ini_idx], re.I,
        )
        # Rango pelado ("1 a 2", "2 a 4") sin minutos, sin a.m./p.m. y sin
        # rótulo: casi siempre numeración de página/capítulo. Campo vacío.
        if (not tiene_minutos and not tiene_meridiano and not rotulado_previo
                and (h1 < 6 or h2 < 6)):
            continue

        # Meridianos: explícitos primero; si solo hay uno se propaga y como
        # alternativa se prueba el cruce am→pm ("11 a.m. a 1"), quedándose con
        # la primera combinación coherente (fin > ini).
        mer1g, mer2g = m.group(4), m.group(7)
        if mer1g and mer2g:
            combos = [(mer1g, mer2g)]
        elif mer1g:
            combos = [(mer1g, mer1g), (mer1g, "p.m."), (mer1g, None)]
        elif mer2g:
            combos = [(mer2g, mer2g), ("a.m.", mer2g), (None, mer2g)]
        else:
            combos = [(None, None)]

        for mer1, mer2 in combos:
            ini = _a24h(h1, mer1) * 60 + min1
            fin = _a24h(h2, mer2) * 60 + min2
            if fin <= ini:
                continue
            detalle = re.sub(r"^[^0-9]+", "", m.group(0).strip(), count=1).strip()
            candidatos.append({
                "horaInicio": _hhmm(_a24h(h1, mer1), min1),
                "horaFin": _hhmm(_a24h(h2, mer2), min2),
                "detalle": detalle,
                "rotulado": bool(rotulado_previo),
                "idx": ini_idx,
            })
            break

    if candidatos:
        ordenados = sorted(candidatos, key=lambda c: (0 if c["rotulado"] else -2, c["idx"]))
        mejor = ordenados[0]
        return {"horaInicio": mejor["horaInicio"], "horaFin": mejor["horaFin"],
                "detalle": mejor["detalle"]}

    # Plan B: ENTRADA/INICIO y SALIDA/FIN separadas. Con meridiano explícito se
    # convierte con la misma regla; sin meridiano queda tal cual (24h).
    m_ent = re.search(
        r"\b(?:entr(?:ada|e)|inicio)\s*[:\-]?\s*(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?",
        t, re.I)
    m_sal = re.search(
        r"\b(?:salida|fin|finalizaci[oó]n)\s*[:\-]?\s*(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?",
        t, re.I)
    if m_ent and m_sal:
        h1 = _a24h(int(m_ent.group(1)), m_ent.group(3)) if m_ent.group(3) else int(m_ent.group(1))
        min1 = int(m_ent.group(2)) if m_ent.group(2) is not None else 0
        h2 = _a24h(int(m_sal.group(1)), m_sal.group(3)) if m_sal.group(3) else int(m_sal.group(1))
        min2 = int(m_sal.group(2)) if m_sal.group(2) is not None else 0
        if (_hora_valida(h1, min1) and _hora_valida(h2, min2)
                and h2 * 60 + min2 > h1 * 60 + min1):
            return {"horaInicio": _hhmm(h1, min1), "horaFin": _hhmm(h2, min2),
                    "detalle": f"{_hhmm(h1, min1)} a {_hhmm(h2, min2)}"}
    return None


def duracion_horas(hora_inicio, hora_fin):
    """Minutos entre dos horas HH:mm (duración real, nunca inventada)."""
    a = re.match(r"^(\d{1,2}):(\d{2})$", str(hora_inicio or ""))
    b = re.match(r"^(\d{1,2}):(\d{2})$", str(hora_fin or ""))
    if not a or not b:
        return None
    ini = int(a.group(1)) * 60 + int(a.group(2))
    fin = int(b.group(1)) * 60 + int(b.group(2))
    if fin <= ini:
        return None
    horas = (fin - ini) / 60
    if horas == int(horas):
        return str(int(horas))
    return f"{horas:.1f}".replace(".", ",")


# ─── Etiquetas de referencia para cortar valores ─────────────────────────────

ETIQUETAS_CORTE = (r"(?:CEDULA|C[eÉ]DULA|C\.?\s?C\.?|DOCUMENTO|IDENTIFICACI[oÓ]N|NOMBRES?|"
                   r"APELLIDOS|CARGO|PUESTO|OFICIO|DEPENDENCIA|DEPARTAMENTO|[ÁA]REA|FECHA|"
                   r"HORA|ENTRADA|SALIDA|FIRMA|MOTIVO|JEFE|OBSERVACION|SOLICITANTE|"
                   r"Vo\.?\s?Bo\.?|PERMISO|TIPO)")

_VALOR = r"([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.\-/ ]{2,50}?)"
_CORTE = r"(?=\s{2,}|\s*\b" + ETIQUETAS_CORTE + r"\b\s*[:.\-]|[.\n]|$)"


def _rx_valor_labeled(etiquetas):
    return re.compile(r"\b(?:" + etiquetas + r")\s*[:.\-]?\s*" + _VALOR + _CORTE, re.I)


# ─── Parser principal ────────────────────────────────────────────────────────


def parsear_texto_permiso(texto_completo, nombre_archivo="", texto_pagina1=""):
    """Parsea el texto OCR (completo y página 1) y produce los campos del permiso."""
    texto = desocrizar_etiquetas(normalizar_texto_ocr(texto_completo))
    p1 = desocrizar_etiquetas(normalizar_texto_ocr(texto_pagina1 or texto_completo))
    campos = {}

    # ═══ 1. NOMBRE COMPLETO DEL TRABAJADOR ═══
    nombre_encontrado = ""

    # A. Etiquetas del formulario (prima sobre el anexo EPS: el "Paciente" de
    #    la orden médica es el solicitante solo si el formulario no rotuló).
    rx_nombre = re.compile(
        r"\b(?:NOMBRES?\s*(?:Y\s*APELLIDOS|COMPLETO|DEL\s*(?:TRABAJADOR|FUNCIONARIO|SOLICITANTE))?"
        r"|TRABAJADOR|SOLICITANTE|FUNCIONARIO)\s*:?\s*"
        r"([" + _LETRAS + r"0-9' ]{5,70}?)" + _CORTE,
        re.I,
    )
    m_nombre = rx_nombre.search(p1 + "\n" + texto)
    if m_nombre:
        # Los dígitos entran a la captura a propósito: con letra borrosa el OCR
        # lee "MAR1A" y limpiar_nombre_completo corrige 1→I después.
        n_limpio = limpiar_nombre_completo(m_nombre.group(1))
        if len(n_limpio) >= 5 and len([p for p in n_limpio.split(" ") if p]) >= 2:
            nombre_encontrado = n_limpio

    # B. Anexo EPS / orden médica sin formulario: el paciente es el solicitante
    if not nombre_encontrado:
        m_paciente = re.search(
            r"(?:Paciente|PACIENTE|Usuario|USUARIO|Afiliado|Ciudadano)[:\s]+"
            r"([A-ZÁÉÍÓÚÑa-z\s]{6,55})(?=\s*ID|\s*CC|\s*Contrato|\s*Edad|\s*Plan|\n|$)",
            texto, re.I)
        if m_paciente:
            p_nombre = limpiar_nombre_completo(m_paciente.group(1))
            if len([p for p in p_nombre.split(" ") if p]) >= 2:
                nombre_encontrado = p_nombre

    # C. Último recurso: nombre del archivo (metadato de quien escaneó)
    if not nombre_encontrado and nombre_archivo:
        p_arch = limpiar_nombre_completo(nombre_archivo)
        if len([p for p in p_arch.split(" ") if p]) >= 2:
            nombre_encontrado = p_arch

    # Guardia de coherencia: un nombre no lleva dígitos ni restos de etiquetas
    if nombre_encontrado and re.search(r"\d", nombre_encontrado):
        nombre_encontrado = ""
    if nombre_encontrado:
        campos["nombreFuncionario"] = nombre_encontrado

    # ═══ 2. CÉDULA / DOCUMENTO ═══
    # SOLO con evidencia explícita: el membrete trae el NIT impreso y antes se
    # reportaba como cédula.
    numeros_a_excluir = ["890120175", "8901201757", "68679000", "1686790001", "2640000", "2610000"]
    cedula_detectada = ""

    def _es_cedula_plausible(digitos):
        if not re.fullmatch(r"[0-9]{6,11}", digitos):
            return False
        if digitos in numeros_a_excluir:
            return False
        if re.fullmatch(r"20(1[5-9]|2[0-9])", digitos):
            return False        # año suelto
        if re.fullmatch(r"20(1[5-9]|2[0-9])[0-9]{4}", digitos):
            return False  # aaaamm
        if re.fullmatch(r"(30|31|32)[0-9]{8}", digitos):
            return False        # celular
        return True

    def _contexto_es_empresarial(texto_previo):
        return bool(re.search(
            r"(nit|n\.?\s*i\.?\s*t|registro|empresa|acueducto|alcantarillado|acuasan|e\.?\s?s\.?\s*p|tel[eé]fono|pbx)",
            texto_previo or "", re.I))

    # Flag re.M: en OCR el número suele terminar al final de la línea y '$'
    # debe casar al final de CADA línea.
    patrones_cedula = [
        r"\b(?:CEDULA|C[eÉ]DULA)\s*(?:DE\s*CIUDADANIA)?\s*[:\-]?\s*N?o?\.?\s*([0-9][0-9.,\s]{4,16}?)(?=[^\d.,\s]|$)",
        r"\bC\.?\s?C\.?\s*(?:No\.?|#)?\s*[:\-]?\s*([0-9][0-9.,\s]{4,16}?)(?=[^\d.,\s]|$)",
        r"\bdocumento\s*(?:No\.?|n[uú]mero|#)?\s*[:\-]?\s*([0-9][0-9.,\s]{4,16}?)(?=[^\d.,\s]|$)",
        r"\bidentificad[oa]\s*(?:con)?\s*(?:el)?\s*(?:documento|c[eé]dula)?\s*(?:No\.?|#)?\s*([0-9][0-9.,\s]{4,16}?)(?=[^\d.,\s]|$)",
        r"\b(?:TRABAJADOR|SOLICITANTE|FUNCIONARIO)\s*(?:IDENTIFICADO\s*(?:CON)?)?\s*(?:CON)?\s*(?:C\.?\s?C\.?|CEDULA)?\s*N?o?\.?\s*[:\-]?\s*([0-9][0-9.,\s]{4,16}?)(?=[^\d.,\s]|$)",
    ]
    for patron in patrones_cedula:
        for m in re.finditer(patron, texto, re.I | re.M):
            digitos = re.sub(r"[^\d]", "", (m.group(1) or "").strip())
            # Para un número ETIQUETADO la etiqueta es la evidencia: NO se
            # aplica el guard de contexto empresarial.
            if _es_cedula_plausible(digitos):
                cedula_detectada = digitos
                break
        if cedula_detectada:
            break

    # Último recurso: número suelto FUERA de contexto empresarial
    if not cedula_detectada:
        for m in re.finditer(r"\b[0-9][0-9.,]{5,14}\b", texto):
            digitos = re.sub(r"[^\d]", "", m.group(0) or "")
            previo = texto[max(0, m.start() - 45):m.start()]
            if _es_cedula_plausible(digitos) and not _contexto_es_empresarial(previo):
                cedula_detectada = digitos
                break

    if cedula_detectada:
        campos["cedula"] = cedula_detectada

    # ═══ 3. CARGO y ═══ 4. ÁREA / DEPENDENCIA ═══
    m_cargo = texto and _rx_valor_labeled("CARGO|PUESTO|OFICIO|EMPLEO|OCUPACI[oÓ]N").search(texto)
    if m_cargo:
        cargo_literal = re.sub(r"\s{2,}", " ", m_cargo.group(1))
        cargo_literal = re.sub(r"[\s\-.,:;]+$", "", cargo_literal).strip()
        info = normalizar_cargo_y_dependencia(cargo_literal)
        if info["cargo"] != "Funcionario Acuasan":
            campos["cargo"] = info["cargo"]
            if not campos.get("dependencia") and info["dependencia"] != "Operativa":
                campos["dependencia"] = info["dependencia"]
        elif re.match(r"^[A-ZÁÉÍÓÚÜÑ0-9]", cargo_literal) and len(cargo_literal) >= 3:
            # Literal solo si arranca en mayúscula: "cargo de conductor" en
            # prosa no es un valor rotulado del formulario.
            campos["cargo"] = cargo_literal

    # Rótulos extendidos del área: los PDF reales no siguen una plantilla única.
    # (a) Etiquetas clásicas con complemento ("ÁREA A LA QUE PERTENECE:") donde
    #     el complemento se come ANTES de los dos puntos.
    # (b) Plan B: etiquetas de oficina (OFICINA, SECCIÓN…) que EXIGEN dos
    #     puntos — sin ellos, el membrete "GERENCIA GENERAL" sembraría "GENERAL".
    releno_area = r"(?:\s+(?:[ÁA]\s+LA\s+QUE\s+PERTENECE|DE\s+TRABAJO|SOLICITANTE|DONDE\s+LABORA|DE\s+LA\s+EMPRESA))*"
    # El rótulo no puede venir pegado a otra palabra (en Python \b ya es
    # Unicode-safe para "ÁREA"; el lookbehind replica el fix del lado JS).
    m_dependencia = texto and re.search(
        r"(?<![A-Za-z0-9_" + "ÁÉÍÓÚÜÑáéíóúüñ" + r"])(?:DEPENDENCIA|DEPARTAMENTO|[ÁA]REA)"
        + releno_area + r"\s*[:.\-]?\s*" + _VALOR + _CORTE,
        texto, re.I)
    dep_literal = ""
    if m_dependencia:
        dep_literal = re.sub(r"\s{2,}", " ", m_dependencia.group(1))
        dep_literal = re.sub(r"[\s\-.,:;]+$", "", dep_literal).strip()
    # Cola de rótulo que coló cuando el OCR perdió los dos puntos ("ÁREA A LA
    # QUE PERTENECE Comercial"): se retira, el valor empieza después.
    dep_literal = re.sub(
        r"^(?:[aá]\s+la\s+que\s+pertenece|de\s+trabajo|solicitante|donde\s+labora|de\s+la\s+empresa)\s+",
        "", dep_literal, count=1, flags=re.I)
    if not dep_literal:
        m_oficina = texto and re.search(
            r"\b(?:OFICINA|SECCI[oÓ]N|DIRECCI[oÓ]N|UNIDAD|GERENCIA|SUBGERENCIA|DIVISI[oÓ]N|PROCESO)"
            r"\s*:\s*" + _VALOR + _CORTE,
            texto, re.I)
        if m_oficina:
            dep_literal = re.sub(r"\s{2,}", " ", m_oficina.group(1))
            dep_literal = re.sub(r"[\s\-.,:;]+$", "", dep_literal).strip()
    # Un área institucional empieza con mayúscula: "de Santander" (prosa suelta
    # tras la palabra "departamento") no es un valor rotulado del formulario.
    if dep_literal and re.match(r"^[A-ZÁÉÍÓÚÜÑ0-9]", dep_literal):
        # El área rotulada la aporta el documento: se respeta el LITERAL.
        if len(dep_literal) >= 3:
            campos["dependencia"] = dep_literal

    # Fallback: cargo reconocible en el texto (la palabra sí está en el documento)
    if not campos.get("cargo"):
        if re.search(r"potabiliz|planta\s+de\s+tratam", texto, re.I):
            campos["cargo"] = "Líder de Potabilización"
            campos["dependencia"] = campos.get("dependencia") or "Planta de Tratamiento / Potabilización"
        elif re.search(r"fontan", texto, re.I):
            campos["cargo"] = "Fontanero"
            campos["dependencia"] = campos.get("dependencia") or "Distribución y Redes"
        elif re.search(r"alcant", texto, re.I):
            campos["cargo"] = "Operario de Alcantarillado"
            campos["dependencia"] = campos.get("dependencia") or "Redes de Alcantarillado"
        elif re.search(r"conduct", texto, re.I):
            campos["cargo"] = "Conductor Operativo"
            campos["dependencia"] = campos.get("dependencia") or "Transporte y Maquinaria"
        elif re.search(r"analist", texto, re.I):
            campos["cargo"] = "Analista de Facturación y Cartera"
            campos["dependencia"] = campos.get("dependencia") or "Comercial y Facturación"
        elif re.search(r"auxiliar", texto, re.I):
            campos["cargo"] = "Auxiliar Administrativo"
            campos["dependencia"] = campos.get("dependencia") or "Administrativa"

    # ═══ 5. FECHA DEL PERMISO (DD/MM/AAAA) ═══
    elegida = _elegir_fecha(_recolectar_fechas(p1, True) + _recolectar_fechas(texto, False))
    if elegida:
        campos["fechaInicio"] = f"{elegida['dd']}/{elegida['mm']}/{elegida['aa']}"
        campos["fechaFin"] = campos["fechaInicio"]
        campos["fechaPermisoTexto"] = f"{int(elegida['dd'])} de {NOMBRES_MES[int(elegida['mm'])]} de {elegida['aa']}"

    # ═══ 6. HORA INICIO y HORA FIN (24h) ═══
    rango = extraer_rango_horario(p1) or extraer_rango_horario(texto)
    rx_check_jornada = re.compile(
        r"jornada[^.\n]{0,30}[\[\(]?\s*[xX✓☑]\s*[\]\)]?|[\[\(]?\s*[xX✓☑]\s*[\]\)]?[^.\n]{0,30}jornada",
        re.I)
    hay_marcas_jornada = re.search(r"\b07[:.]?30\b", texto) and re.search(r"\b(?:17[:.]?30|18[:.]?00)\b", texto)
    evidencia_jornada = rx_check_jornada.search(texto) or hay_marcas_jornada

    if rango:
        campos["horaInicio"] = rango["horaInicio"]
        campos["horaFin"] = rango["horaFin"]
        horas = duracion_horas(rango["horaInicio"], rango["horaFin"])
        sufi = f" ({horas} horas)" if horas else ""
        campos["horaDetalle"] = f"{rango['horaInicio']} a {rango['horaFin']}{sufi}"
        campos["horasCalculadas"] = campos["horaDetalle"]
        # El rango puede SER la jornada completa (07:30–18:00): se marca igual
        campos["jornadaCompleta"] = (rango["horaInicio"] == "07:30"
                                     and rango["horaFin"] in ("18:00", "17:30"))
    elif evidencia_jornada:
        # Sin rango horario pero con casilla/rotulado de jornada completa
        campos["horaInicio"] = "07:30"
        campos["horaFin"] = "18:00"
        campos["horaDetalle"] = "07:30 a 18:00 (Jornada Laboral Completa)"
        campos["jornadaCompleta"] = True
    elif re.search(r"jornada\s+(?:laboral\s+)?completa|todo\s+el\s+d[ií]a", texto, re.I):
        # Mención literal SIN casilla y SIN horas explícitas: jornada completa
        # solo porque el documento lo dice con esas palabras.
        campos["horaInicio"] = "07:30"
        campos["horaFin"] = "18:00"
        campos["horaDetalle"] = "07:30 a 18:00 (Jornada Laboral Completa)"
        campos["jornadaCompleta"] = True
    else:
        campos["horaDetalle"] = ""
        campos["horasCalculadas"] = ""

    # ═══ 7. TIPO DE PERMISO (casillas [X] primero, luego palabras clave) ═══
    tipo_detectado = ""

    rx_comp_marcado = re.compile(
        r"[Cc]ompensatori[ao]\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]ompensatori[ao]")
    hay_evidencia_electoral = re.search(
        r"registradur|jurament|jurado|electoral|votaci[oó]n|E-18|E\.?18", texto, re.I)
    if rx_comp_marcado.search(p1) and hay_evidencia_electoral:
        tipo_detectado = "Compensatorio"

    rx_medico_marcado = re.compile(
        r"M[eé]dic[ao]\*?\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*M[eé]dic[ao]\*?")
    if not tipo_detectado and rx_medico_marcado.search(p1):
        tipo_detectado = "Cita Médica"
    if not tipo_detectado and rx_comp_marcado.search(p1):
        tipo_detectado = "Compensatorio"
    if not tipo_detectado:
        rx_personal_marcado = re.compile(
            r"[Pp]ersonal\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Pp]ersonal")
        if rx_personal_marcado.search(p1):
            tipo_detectado = "Personal"
    if not tipo_detectado:
        rx_cala_marcado = re.compile(
            r"[Cc]alamidad\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]alamidad")
        if rx_cala_marcado.search(p1):
            tipo_detectado = "Calamidad Doméstica"
    if not tipo_detectado:
        # Valor rotulado genérico: "TIPO DE PERMISO: Cita Médica". El valor se
        # mapea al nombre EXACTO del select; algo desconocido queda vacío.
        m_tipo = re.search(r"\btipo\s+de\s+permiso\s*[:\-]\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ/\s]{3,40})",
                           texto, re.I)
        if m_tipo:
            tipo_detectado = mapear_tipo_permiso(m_tipo.group(1))
        # "PERMISO PERSONAL" / "asunto propio" como frase natural del documento.
        # La palabra "personal" suelta no cuenta ("personal administrativo").
        if not tipo_detectado and re.search(r"permiso\s+personal|asunto\s+propio", texto, re.I):
            tipo_detectado = "Personal"
    if not tipo_detectado:
        rx_estudio_marcado = re.compile(r"[Ee]studio|[Cc]apacitaci[oó]n\s*[\[\(]?[xX✓✗☑]")
        if rx_estudio_marcado.search(p1):
            tipo_detectado = "Estudio / Capacitación"
    if not tipo_detectado:
        hay_medico = re.search(
            r"m[eé]dic[ao]|cita\s*m[eé]dic|eps|cardiolog|urolog|ortoped|remisi[oó]n|especialista|orden\s*m[eé]dic|diagn[oó]stico",
            texto, re.I)
        hay_jurado = re.search(
            r"jurado|consulta\s*popular|votaci[oó]n|electoral|certificado\s*electoral|registradur|jurament",
            texto, re.I)
        hay_calamidad = re.search(r"calamidad|fallecimiento|inundaci[oó]n|accidente\s*familiar", texto, re.I)
        hay_estudio = re.search(r"universidad|capacitaci[oó]n|seminario|congreso|examen\s*acad[eé]mico",
                                texto, re.I)
        if hay_jurado:
            tipo_detectado = "Compensatorio"
        elif hay_medico:
            tipo_detectado = "Cita Médica"
        elif hay_calamidad:
            tipo_detectado = "Calamidad Doméstica"
        elif hay_estudio:
            tipo_detectado = "Estudio / Capacitación"
    campos["tipoPermiso"] = tipo_detectado

    # ═══ 8. MOTIVO Y JUSTIFICACIÓN EXTRAÍDA ═══
    motivo_extraido = ""

    # Etiquetas alternas según el formato: DESCRIPCIÓN (DEL MOTIVO), JUSTIFICACIÓN.
    rx_motivo_linea = re.compile(
        r"(?:MOTIVO|DESCRIPC[IÍ]ON(?:\s+DEL\s+MOTIVO)?|JUSTIFICACI[oÓ]N)[\s:\*]*"
        r"(?:Compensatorio|M[eé]dic[oa]\*?|Personal|Calamidad)?"
        r"[\s\[\](){}xX✓✗☑☒☐*]*"
        r"([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9/\s,.\-()]{6,140}?)"
        r"(?=\s{2,}|\s*\b" + ETIQUETAS_CORTE + r"\b\s*[:.\-]?|[.\n]|$)",
        re.I)
    m_motivo = p1 and rx_motivo_linea.search(p1)
    if m_motivo:
        trabajo = m_motivo.group(1)
        for patron in (r"en caso de cita.*", r"\*en caso.*", r"firma.*", r"solicitante.*",
                       r"jefe.*", r"observacion.*", r"dependencia.*", r"vo\.?\s?bo\.?.*"):
            trabajo = re.sub(patron, "", trabajo, count=1, flags=re.I)
        trabajo = re.sub(r"[_|~]{2,}", " ", trabajo)
        trabajo = re.sub(r"[\[\](){}]", " ", trabajo)
        # Marcas de casilla sueltas, solo como palabra completa: sin \b, la x
        # de "examen" se comería y el texto quedaría mutilado ("e amen").
        trabajo = re.sub(r"\b[xX✓✗☑☒☐]\b", " ", trabajo)
        # Ruido inicial: símbolos, palabras de 1-2 letras y —si el valor
        # arranca con la etiqueta de un tipo ("Médico", "Compensatorio…")— esa
        # palabra. Solo al inicio: en "Cita médica general EPS" la palabra
        # "médica" pertenece al motivo.
        rx_ruido_inicial = re.compile(
            r"^(?:[^\wáéíóúñ]+|\b[a-záéíóúñ]{1,2}\b|\b\d{1,2}\b|"
            r"\b(?:compensatorio|m[eé]dic[oa]\*?|calamidad|personal|estudio|capacitaci[oó]n)\b)\s*",
            re.I)
        while True:
            recorte = re.sub(rx_ruido_inicial, "", trabajo, count=1)
            if recorte == trabajo:
                break
            trabajo = recorte
        trabajo = re.sub(r"\s{2,}", " ", trabajo).strip()
        if len(trabajo) >= 5 and re.search(r"[a-záéíóúñ]{3,}", trabajo, re.I):
            motivo_extraido = trabajo

    if not motivo_extraido:
        # Manuscrito: "c/ta médica del 25 de agosto" — incluye dígitos porque
        # la fecha escrita a mano suele venir en la misma línea del motivo.
        m_cita = re.search(r"c[/.]?ta\s+m[eé]dic[oa][a-z0-9\s/,.\"]{0,60}", texto, re.I)
        if m_cita:
            motivo_extraido = re.sub(r"\s+", " ", m_cita.group(0)).strip()

    if not motivo_extraido:
        # Síntesis SOLO a partir de palabras que están en el documento
        if re.search(r"registradur|jurament|jurado\s+de\s+votaci|electoral|votaci[oó]n|E-18", texto, re.I):
            motivo_extraido = "Compensatorio por función electoral (certificado E-18 / Registraduría adjunto)"
        elif re.search(r"cardiolog", texto, re.I):
            motivo_extraido = "Cita médica - Consulta especialista Cardiología"
            if re.search(r"reclamar|medicam", texto, re.I):
                motivo_extraido += " / Reclamar medicamentos"
        elif re.search(r"urolog", texto, re.I):
            motivo_extraido = "Cita médica - Consulta especialista Urología"
        elif re.search(r"reclamar|medicam", texto, re.I):
            motivo_extraido = "Cita médica - Reclamar medicamentos (EPS)"

    # Guardia de coherencia: el motivo no puede ser una etiqueta desnuda
    if motivo_extraido:
        base = re.sub(r"\b(?:cita|m[eé]dica?|permiso)\b", "", motivo_extraido, flags=re.I)
        if not re.search(r"[a-záéíóúñ]{3,}", base, re.I):
            motivo_extraido = ""
    campos["motivo"] = motivo_extraido or ""
    campos["motivoManuscrito"] = motivo_extraido or ""

    return campos


# ─── Evaluación de cobertura de las 9 áreas ──────────────────────────────────

# Las 9 áreas del formulario, en el orden en que se muestran.
CAMPOS_OCR = [
    ("nombreFuncionario", "Nombre Completo del Trabajador"),
    ("cedula", "Cédula / Documento"),
    ("cargo", "Cargo"),
    ("dependencia", "Área / Dependencia"),
    ("fechaInicio", "Fecha"),
    ("horaInicio", "Hora Inicio"),
    ("horaFin", "Hora Fin"),
    ("tipoPermiso", "Tipo de Permiso"),
    ("motivo", "Motivo y Justificación"),
]


def evaluar_campos_extraidos(valores=None):
    """Evalúa cuántas de las 9 áreas quedaron llenas con respaldo del documento.
    Devuelve {'faltantes': [...], 'confianza': % de áreas llenas}."""
    valores = valores or {}
    faltantes = [etiqueta for clave, etiqueta in CAMPOS_OCR
                 if not str(valores.get(clave) or "").strip()]
    confianza = round((len(CAMPOS_OCR) - len(faltantes)) / len(CAMPOS_OCR) * 100)
    return {"faltantes": faltantes, "confianza": confianza}
