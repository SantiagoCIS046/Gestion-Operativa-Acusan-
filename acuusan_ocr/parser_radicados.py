# -*- coding: utf-8 -*-
r"""
parser_radicados.py — Parsing de campos institucionales de radicados y oficios
─────────────────────────────────────────────────────────────────────────────
Porte fiel de acusan/backend/src/modules/radicados/radicados.service.js
(esta versión HEAD): `extraerCampos` (entrada) + `extraerCamposRespuesta`
(oficio de salida) + todos los helpers de limpieza/ortografía. Módulo PURO:
recibe el texto OCR del documento y devuelve los campos que logra leer con
certeza. REGLA DE ORO: el dato sale del documento o el campo queda vacío.

Notas del porte JS→Python:
  · JS .replace(sin /g) reemplaza SOLO la primera aparición → re.sub(count=1).
  · Los grupos de reemplazo usan \g<1>… para evitar la ambigüedad de $10.
  · matchAll → finditer; 'gim' → re.I|re.M; el 4º patrón de lugar/fecha va
    SIN re.I a propósito (así está en el JS: la insensibilidad dejaba colar
    prefijos minúsculos de la línea superior).
"""

import datetime
import re
import unicodedata

# ─── Auxiliares de limpieza ──────────────────────────────────────────────────


def limpiar(cadena):
    s = re.sub(r"^[:\s-]+", "", cadena or "")
    s = re.sub(r"[\r\n]+", " ", s)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()


def _limpiar_espacios(cadena):
    return re.sub(r"\s{2,}", " ", cadena)


# El OCR de PDF escaneados confunde O/0, l/I/1 y | dentro de los números
# ("2O2614523O"). La clase de abajo los acepta al capturar y se normalizan
# enseguida: recuperar el dato real del documento, jamás inventarlo.
DIGITO_OCR = "[0-9OolI|]"


def normalizar_digitos(s):
    s = re.sub(r"[Oo|]", "0", s or "")
    return re.sub(r"[lI]", "1", s)


# Limpia códigos numéricos de suscripción y títulos profesionales ("Ing.",
# "Dr.", "Doctor", "Sra.", etc.)
def limpiar_nombre_persona(cadena):
    if not cadena or not isinstance(cadena, str):
        return ""
    s = cadena.strip()
    # Pelar códigos de suscriptor/dependencia delante ("950 - ", "1234: ")
    s = re.sub(r"^\d{2,8}\s*[-–—:]\s*", "", s, count=1)
    # Pelar títulos profesionales ("Doctor", "Doctora", "Dr.", "Dra.", "Ing.",
    # "Lic.", etc.)
    s = re.sub(r"^(?:Doctora?|Inga?|Dra?|Lic|Arq|Abg|Sra?|Prof)\.?\s*[:：]?\s*",
               "", s, count=1, flags=re.I)
    # Pelar paréntesis abiertos al final (ej: "…(coordinador R")
    s = re.sub(r"\s*\([^)]*$", "", s)
    s = re.sub(r"[:.,;\-]+$", "", s)
    return s.strip()


# ─── Diccionario institucional y administrativo con tildes ───────────────────

DIC_TILDE = {
    # Términos jurídicos, administrativos y generales
    "presentacion": "presentación", "peticion": "petición", "atencion": "atención",
    "notificacion": "notificación", "resolucion": "resolución", "liquidacion": "liquidación",
    "facturacion": "facturación", "suspension": "suspensión", "reconexion": "reconexión",
    "conexion": "conexión", "reposicion": "reposición", "apelacion": "apelación",
    "revocacion": "revocación", "revocatoria": "revocatoria", "conciliacion": "conciliación",
    "certificacion": "certificación", "autorizacion": "autorización", "informacion": "información",
    "expedicion": "expedición", "prescripcion": "prescripción", "reclamacion": "reclamación",
    "indemnizacion": "indemnización", "verificacion": "verificación", "inspeccion": "inspección",
    "modificacion": "modificación", "disposicion": "disposición", "declaracion": "declaración",
    "calificacion": "calificación", "ubicacion": "ubicación", "valoracion": "valoración",
    "excepcion": "excepción", "remision": "remisión", "emision": "emisión",
    "comision": "comisión", "radicacion": "radicación", "cancelacion": "cancelación",
    "solicitud": "solicitud", "recurso": "recurso", "interno": "interno",
    "radicado": "radicado", "respuesta": "respuesta", "oficio": "oficio",
    "salida": "salida", "entrada": "entrada", "tramite": "trámite",
    "termino": "término", "terminos": "términos", "matricula": "matrícula",
    "cedula": "cédula", "numero": "número", "linea": "línea",
    "publica": "pública", "publico": "público", "publicos": "públicos",
    "publicas": "públicas", "tecnico": "técnico", "tecnica": "técnica",
    "juridico": "jurídico", "juridica": "jurídica", "economico": "económico",
    "economica": "económica", "alcaldia": "alcaldía", "personeria": "personería",
    "veeduria": "veeduría", "contraloria": "contraloría", "procuraduria": "procuraduría",
    "secretaria": "secretaría", "bogota": "bogotá", "medellin": "medellín",
    "santander": "santander", "valle": "valle", "codigo": "código",
    "pagina": "página", "año": "año", "años": "años", "dia": "día", "dias": "días",
    "vencimiento": "vencimiento", "direccion": "dirección", "alcantarillado": "alcantarillado",
    "acueducto": "acueducto", "desague": "desagüe", "area": "área",
    "areas": "áreas", "canon": "canon", "regimen": "régimen",
    # Nombres y apellidos comunes en Colombia
    "perez": "pérez", "hernandez": "hernández", "rodriguez": "rodríguez",
    "sanchez": "sánchez", "gomez": "gómez", "lopez": "lópez",
    "martinez": "martínez", "gonzalez": "gonzález", "alvarez": "álvarez",
    "diaz": "díaz", "ramirez": "ramírez", "suarez": "suárez",
    "jimenez": "jiménez", "munoz": "muñoz", "gutierrez": "gutiérrez",
    "beltran": "beltrán", "guzman": "guzmán", "leon": "león",
    "marin": "marín", "rondon": "rondón", "avila": "ávila",
    "calderon": "calderón", "rincon": "rincón", "pinzon": "pinzón",
    "ceron": "cerón", "pabon": "pabón", "chacon": "chacón",
    "duran": "durán", "millan": "millán", "roman": "román",
    "rios": "ríos", "pena": "peña", "bano": "baño",
    "maria": "maría", "jose": "josé", "jesus": "jesús",
    "angel": "ángel", "angela": "ángela", "raul": "raúl",
    "ivan": "iván", "sebastian": "sebastián", "julian": "julián",
    "cesar": "césar", "oscar": "óscar", "andres": "andrés",
    "hector": "héctor", "hernan": "hernán", "german": "germán",
    "fabian": "fabián", "ruben": "rubén", "ramon": "ramón",
    "joaquin": "joaquín", "martin": "martín", "alvaro": "álvaro",
    "cristian": "cristián", "adrian": "adrián", "damaris": "dámaris",
}

# ─── Corrección de errores típicos de OCR (documentos administrativos) ───────

_LETRAS_JS = "a-zA-ZáéíóúÁÉÍÓÚñÑ"


def corregir_ortografia_ocr(cadena):
    if not cadena or not isinstance(cadena, str):
        return ""

    s = cadena
    # 16n, 1on, i6n, i0n → ción / sión / xión
    for letra in ("ción", "sión", "xión"):
        inicial_clase = "[" + letra[0] + letra[0].upper() + "]"
        s = re.sub(
            r"\b([" + _LETRAS_JS + r"]+)" + inicial_clase + r"(?:16|1[oó0]|i6|[ií]0)[nN]\b",
            lambda m, letra=letra: m.group(1) + (letra.upper() if m.group(0) == m.group(0).upper() else letra),
            s)
    s = re.sub(r"conser\s*\\raci[oó6]n|conseraci6n", "conservación", s, flags=re.I)
    s = re.sub(r"\\raci[oó6]n", "ración", s, flags=re.I)
    s = re.sub(r"\bnornia8\b|\bnornias\b", "normas", s, flags=re.I)
    s = re.sub(r"\b[dD]eticid[nm]\b|\b[dD]eticion\b", "petición", s, flags=re.I)
    s = re.sub(r"\bsefi?ora\b|\bseflora\b", "señora", s, flags=re.I)
    s = re.sub(r"\bsefi?or\b|\bseflor\b", "señor", s, flags=re.I)
    s = re.sub(r"\bGLADVS\b", "GLADYS", s)
    s = re.sub(r"\bDor\b", "Por", s)
    s = re.sub(r"\bdor\b", "por", s)
    s = re.sub(r"\bsobro\b", "sobre", s, flags=re.I)
    s = re.sub(r"\bsobre\s+ds\s+consecuencias\b", "sobre las consecuencias", s, flags=re.I)
    s = re.sub(r"\bds\s+consecuencias\b", "de las consecuencias", s, flags=re.I)
    s = re.sub(r"\bds\b", "de", s, flags=re.I)
    s = re.sub(r"\bAtendiende\b", "Atendiendo", s, flags=re.I)
    s = re.sub(r"\bfa\b", "la", s)
    s = re.sub(r"\bdct\b", "del", s, flags=re.I)
    s = re.sub(r"\bse\s+solicitan\b", "Se solicita", s, flags=re.I)
    s = re.sub(r"([" + _LETRAS_JS + r"]+)\)", r"\g<1>", s)
    s = re.sub(r"\s{2,}", " ", s)

    # Corregir mayúsculas intercaladas con minúsculas accidentales
    # (ej: RECuRSO -> RECURSO)
    def _fix_mayusculas(w):
        palabra = w.group(0)
        total = len(palabra)
        mayus = len(re.findall(r"[A-ZÁÉÍÓÚÑ]", palabra))
        if mayus >= total - 2 and mayus / total >= 0.7 and mayus < total:
            return palabra.upper()
        return palabra

    s = re.sub(r"\b[" + _LETRAS_JS + r"]{3,}\b", _fix_mayusculas, s)
    return s.strip()


# ─── Formato formal ("modales") con tildes exactas ───────────────────────────

_CONECTORES = {"de", "del", "al", "el", "la", "las", "los", "a", "en", "por",
               "para", "con", "y", "e", "o", "u", "sobre"}
_SIGLAS = {"ACUASAN", "CAS", "ESP", "EICE", "NIT", "CC", "PQRS", "UI",
           "E.I.C.E", "E.S.P", "E.I.C.E.", "E.S.P."}


def _sin_diacriticos(s):
    nfd = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in nfd if not unicodedata.combining(ch))


def aplicar_tildes_y_modales(cadena, es_titulo=True):
    if not cadena or not isinstance(cadena, str):
        return ""

    palabras = re.split(r"\s+", cadena)
    resultado = []
    rx_palabra = re.compile(
        r"^([^" + _LETRAS_JS + r"]*)([" + _LETRAS_JS + r"]+)([^" + _LETRAS_JS + r"]*)$")
    for idx, palabra in enumerate(palabras):
        # Preservar números, códigos de radicado o siglas
        if re.search(r"\d", palabra) or palabra.upper().replace(".", "").replace(",", "") in _SIGLAS:
            resultado.append(palabra)
            continue
        m = rx_palabra.match(palabra)
        if not m:
            resultado.append(palabra)
            continue
        prefijo, nucleo, sufijo = m.group(1), m.group(2), m.group(3)
        limpia = _sin_diacriticos(nucleo.lower())
        normalizada = DIC_TILDE.get(limpia, nucleo.lower())
        if es_titulo:
            if idx > 0 and limpia in _CONECTORES:
                res = normalizada.lower()
            else:
                res = normalizada[0].upper() + normalizada[1:]
        else:
            res = normalizada
        resultado.append(prefijo + res + sufijo)
    return " ".join(resultado)


def formatear_asunto(cadena):
    if not cadena:
        return ""
    return aplicar_tildes_y_modales(corregir_ortografia_ocr(cadena), True)


def formatear_nombre_persona(cadena):
    if not cadena:
        return ""
    return aplicar_tildes_y_modales(corregir_ortografia_ocr(limpiar_nombre_persona(cadena)), True)


def formatear_texto_parrafo(cadena):
    if not cadena:
        return ""
    limpio = corregir_ortografia_ocr(cadena)
    if not limpio:
        return ""
    # Capitalizar la primera letra del párrafo
    return limpio[0].upper() + limpio[1:]


# Saneamiento del texto OCR antes de parsearlo
def normalizar_texto_ocr(texto):
    t = str(texto)
    t = re.sub(r"[ \t]{3,}", "  ", t)
    t = re.sub(r"(?:[ \t]*\r?\n){3,}", "\n", t)
    return t


# ─── probarRadicado ──────────────────────────────────────────────────────────
# Extrae y normaliza el número de radicado de un fragmento de texto OCR.
# Convierte errores OCR de dígitos (i→1, o→0) y descarta texto posterior
# ("2610000736 Folios: 1" → "2610000736").
def probar_radicado(crudo):
    if not crudo:
        return ""
    solo_numero = re.split(r"\s+(?:Folios?|Anexos?|Fecha|Hora)\b", str(crudo), maxsplit=1, flags=re.I)[0]
    limpio = normalizar_digitos(re.sub(r"[\- ]", "", solo_numero)).strip()
    solo_digitos = re.sub(r"[iIl|]", "1", limpio)
    solo_digitos = re.sub(r"[oO]", "0", solo_digitos)
    if re.fullmatch(r"\d{7,12}", solo_digitos):
        return solo_digitos
    if re.search(r"[A-Za-z]", limpio):
        ma = re.fullmatch(r"([0-9A-Za-z]{6,12})", limpio)
        return ma.group(1) if ma and len(re.findall(r"\d", ma.group(1))) >= 4 else ""
    m = re.search(r"(\d{7,12})", limpio)
    return m.group(1) if m else ""


# Frases de cuerpo de carta: NO son nombres de personas ni asuntos (el OCR
# las confunde con etiquetas "Remitente:" seguidas de prosa). Ojo con
# "solicitud" (sustantivo legítimo en una referencia): solo se filtran las
# formas verbales.
def es_frase_de_cuerpo(cadena):
    if not cadena:
        return False
    return bool(re.match(
        r"^(?:En atenci[oó]n|Una vez|Por medio|De acuerdo|En este sentido|deber[aá]|"
        r"solicit(?:o|amos|e|en|ar[aá]?)\b|mediante|que la|se evidencia|con el fin|"
        r"respetuosamente|me permito|me dirijo|estimad[oa]s?|agradezc|Yo[,\s]|para la|"
        r"jurisdicci[oó]n)", cadena.strip(), re.I))


# Cargos que acompañan al peticionario bajo el saludo "SEÑOR(A):".
CARGO_RE = re.compile(
    r"PRESIDENT[AE]|REPRESENTANTE(?: LEGAL)?|ALCALDES?A?|GERENTE|DIRECTOR[AE]?|"
    r"SECRETARI[OA]|RECTOR[AE]?|PERSONER[OA]|GOBERNADOR[AE]?|TESORER[OA]|COORDINADOR|"
    r"CONCEJAL|DIPUTAD|JAC|JUNTA|COMUNAL|VEREDAL", re.I)


# ¿Es la línea de saludo "SEÑOR(A):"? El OCR tuerce la Ñ y los separadores
# ("SE ORA:", "SENORA", "SR."), así que se normaliza (sin acentos, sin
# espacios, mayúsculas) antes de comparar. Solo cuenta si es etiqueta corta
# con puntuación final, o la palabra pelada: el nombre va en las líneas de abajo.
def es_linea_saludo(linea):
    nfd = unicodedata.normalize("NFD", linea)
    n = "".join(ch for ch in nfd if not unicodedata.combining(ch))
    n = re.sub(r"\s+", "", n).upper()
    if len(n) > 20:
        return False
    if not re.match(r"^(?:SENORA|SEORA|SENOR|SEOR|SRA|SR|SENORES|SEORES)", n):
        return False
    return bool(re.search(r"[.:(]$", n)) or len(n) <= 7


MUNICIPIOS_ZONA = (r"San Gil|Pinchote|Socorro|Bucaramanga|Bogot[aá]|Charal[aá]|"
                   r"Curit[ií]|Oiba|Barichara|Villanueva|Piedecuesta|Floridablanca|"
                   r"Gir[oó]n|Barbosa|Onzaga|Encino|P[aá]ramo|Valle de San Jos[eé]|"
                   r"Contrataci[oó]n")

_RX_MUNICIPIO_INICIO = re.compile(r"^(?:" + MUNICIPIOS_ZONA + r")\b", re.I)


def es_nombre_valido(s):
    if not s or not isinstance(s, str):
        return False
    cadena = s.strip()
    if len(cadena) < 3:
        return False
    letras = len(re.findall(r"[a-zA-ZáéíóúÁÉÍÓÚñÑ]", cadena))
    if letras < 3:
        return False
    if re.fullmatch(r"[\d\s.,+:;|_\-/\\()]+", cadena):
        return False
    if re.match(r"^[+\-.,;:|_]+", cadena):
        return False
    return True


# Extrae el funcionario que firma un oficio (nombre + cargo) de las líneas del
# documento. El bloque de firma colombiano típico: despedida ("Atentamente,")
# → nombre → cargo. Estrategias, de mayor a menor certeza:
#   a) Etiqueta explícita: Firmante: / Firma: / Suscribe: / Suscrito por:
#   b) Bloque tras la despedida (Atentamente/Cordialmente/Respetuosamente):
#      primera línea de nombre en las 5 siguientes; si la línea posterior casa
#      con CARGO_RE, se concatena " - cargo".
#   c) Encabezado: nombre propio y cargo en la MISMA línea.
# Regla de oro: sin respaldo claro devuelve '' (una firma ilegible no se adivina).
def _extraer_nombre_de_firma(lineas):
    if not lineas:
        return ""

    # Línea que parece un nombre de persona: 2-6 palabras alfabéticas (vale el
    # punto de las iniciales), arranca en mayúscula, sin dígitos/correos/años,
    # sin municipios de la zona, sin cargo y sin ser frase de cuerpo.
    def es_linea_nombre(l):
        palabras = [p for p in l.split() if p]
        if len(palabras) < 2 or len(palabras) > 6:
            return False
        if not re.match(r"^[A-ZÁÉÍÓÚÜÑ]", l):
            return False
        if re.search(r"\d|@|www\.|http", l, re.I):
            return False
        if _RX_MUNICIPIO_INICIO.match(l):
            return False
        if CARGO_RE.search(l):
            return False
        if es_frase_de_cuerpo(l):
            return False
        return all(re.fullmatch(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+", p) for p in palabras)

    def limpiar_cargo(l):
        return _limpiar_espacios(re.sub(r"[.,;:]+$", "", l)).strip()

    # a) Etiqueta explícita (la evidencia más fuerte)
    for l in lineas:
        m = re.match(r"^(?:Firmante|Firma|Suscribe|Suscrito por|Remitente)\s*[:：]\s*(.+)$", l, re.I)
        if m:
            v = m.group(1).strip()
            if es_linea_nombre(v):
                return v
            # El valor puede traer nombre y cargo: "Wbeimar Pérez - Gerente General"
            mnc = re.match(r"^(.{4,60}?)\s*[-–—,]\s*(.{3,50})$", v)
            if mnc and es_linea_nombre(mnc.group(1).strip()) and CARGO_RE.search(mnc.group(2)):
                return f"{mnc.group(1).strip()} - {limpiar_cargo(mnc.group(2))}"

    # b) Bloque de firma tras la despedida
    despedida = re.compile(r"^(?:Atentamente|Cordialmente|Respetuosamente|Sinceramente)[,.]?$", re.I)
    for i in range(len(lineas)):
        if not despedida.match(lineas[i]):
            continue
        for j in range(i + 1, min(i + 6, len(lineas))):
            l = lineas[j]
            if re.search(r"\bASUNTO\b|\bREFERENCIA\b", l, re.I):
                break
            if re.match(r"^\(?\s*firma", l, re.I):
                continue  # "(firma ilegible)"
            if CARGO_RE.search(l):
                break  # llegó el cargo sin nombre: firma sin nombre legible
            if es_linea_nombre(l):
                sig = lineas[j + 1] if j + 1 < len(lineas) else None
                if sig and CARGO_RE.search(sig) and not es_linea_nombre(sig):
                    return f"{l} - {limpiar_cargo(sig)}"
                return l

    # c) Encabezado: nombre y cargo comparten línea ("WBEIMAR PEREZ BELTRAN - Gerente General")
    for l in lineas:
        if not CARGO_RE.search(l):
            continue
        mnc = re.match(r"^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ.\s]{6,60}?)\s*[-–—,]\s*(.{3,50})$", l)
        if mnc and es_linea_nombre(mnc.group(1).strip()) and CARGO_RE.search(mnc.group(2)):
            return f"{mnc.group(1).strip()} - {limpiar_cargo(mnc.group(2))}"
    return ""


# Clasificación textual de la petición (Ley 1755/2015) para sugerir el término
# de respuesta cuando el documento no declara plazo propio. Solo señales
# textuales claras — el sustantivo "Solicitud" de un asunto NO cuenta, hace
# falta el verbo en primera persona — y sin señal → días None: el término
# queda a decisión del operador, no se adivina.
def inferir_tipo_peticion(texto):
    t = str(texto or "")
    # Información, documentos y copias: 10 días (art. 14)
    if re.search(r"\b(?:informaci[oó]n|documentos?|certificaci[oó]n|copias?|expediente)\b", t, re.I):
        return {"tipo": "Información / Documentos", "dias": 10}
    # Consulta, queja y reclamo: 15 días (arts. 21-22)
    if re.search(r"\b(?:consulta|queja|reclamo|reclamaci[oó]n|denuncia)\b", t, re.I):
        return {"tipo": "Consulta / Queja / Reclamo", "dias": 15}
    # Petición general: verbo de petición en primera persona (art. 13)
    if (re.search(r"\b(?:solicito|solicitamos|me dirijo|me permito|pido|pedimos)\b", t, re.I)
            or re.search(r"por medio de la presente", t, re.I)):
        return {"tipo": "Petición General", "dias": 15}
    return {"tipo": "", "dias": None}


# ─── Constantes compartidas de fechas ────────────────────────────────────────

DIA_LE = r"(?:[0-9OolI]|[12][0-9OolI]|3[01])(?:ro|º|°)?"
MES_LE = (r"(?:ene\.?|feb\.?|mar\.?|abr\.?|may\.?|jun\.?|jul\.?|ag[o0]\.?|se[pt]\.?|set\.?|"
          r"oct\.?|nov\.?|dic\.?|enero|febrero|marzo|abril|mayo|junio|julio|ag[o0]st[o0]|"
          r"se[pt]tiembre|setiembre|octubre|noviembre|diciembre)")
ANIO_LE = r"[0-9OolI]{4}"
# Conector mes→año: "de", "del" o "del año" — un "de" literal aparte se
# comería la "l" de "del" y rompería "septiembre 3 del año 2026".
ENTRE = r"(?:del?(?:[ \t]+a[nñ]o)?|de)?[ \t]*"
PATRON_FECHA = DIGITO_OCR + r"{1,2}[/\-]" + DIGITO_OCR + r"{1,2}[/\-]" + DIGITO_OCR + r"{4}"
PATRON_HORA = DIGITO_OCR + r"{1,2}:" + DIGITO_OCR + r"{2}"
FECHA_LARGA = (DIA_LE + r"[ \t]+de[ \t]+" + MES_LE + r"[ \t]*" + ENTRE + ANIO_LE + "|" +
               MES_LE + r"[ \t]+" + DIA_LE + r"[ \t]*" + ENTRE + ANIO_LE + "|" +
               DIA_LE + r"[ \t]+" + MES_LE + r"[ \t]+" + ANIO_LE)
FECHA_CORTA = r"[0-9OolI]{1,2}[\/\-][0-9OolI]{1,2}[\/\-][0-9OolI]{4}"

MESES_OCR = {
    "ene": "01", "enero": "01", "feb": "02", "febrero": "02", "mar": "03", "marzo": "03",
    "abr": "04", "abril": "04", "may": "05", "mayo": "05", "jun": "06", "junio": "06",
    "jul": "07", "julio": "07", "ago": "08", "agosto": "08", "age": "08", "ag0": "08", "a9o": "08",
    "sep": "09", "sept": "09", "septiembre": "09", "setiembre": "09",
    "oct": "10", "octubre": "10", "0ct": "10",
    "nov": "11", "noviembre": "11", "n0v": "11",
    "dic": "12", "diciembre": "12", "d1c": "12",
}


def _es_fecha_posible(f):
    partes = re.split(r"[/\-]", f)
    try:
        d, mes = int(partes[0]), int(partes[1])
    except (ValueError, IndexError):
        return False
    return 1 <= d <= 31 and 1 <= mes <= 12


# ═════════════════════════════════════════════════════════════════════════════
# PARSING DE CAMPOS INSTITUCIONALES — RADICADOS DE ENTRADA
# ═════════════════════════════════════════════════════════════════════════════

def extraer_campos(texto):
    """Recibe el texto EXTRAÍDO DEL DOCUMENTO (OCR) y devuelve los campos que
    logra leer con certeza. Sin dato → campo vacío: jamás se rellena con supuestos."""
    resultado = {
        "numeroRadicadoPdf": "",
        "fechaDocumento": "",
        "lugarFecha": "",
        "peticionario": "",
        "dependencia": "",
        "destinatario": "",
        "asunto": "",
        "referencia": "",
        "contexto": "",
        "diasParaVencer": None,
    }

    if not texto or not texto.strip():
        return resultado

    texto = normalizar_texto_ocr(texto)
    lineas = [l.strip() for l in re.split(r"\r?\n", texto) if l.strip()]

    # 1. N° RADICADO DEL SELLO
    # Soporta formatos SIGOB/ORFEO/Ventanilla virtual y sellos físicos:
    #   "Radicado: 20260012345"  "RADICADO No. 2026-0012"  "No. 20260012345"
    #   "Radicado No.: 2610000736 Folios: 1"
    m_rad = (
        # SIGOB: "RADICADO:" / "Sticker:" / "Rad. No." / "Radicado No.:"
        re.search(r"\b(?:Rad(?:[i1l]c[a4]d[o0])?|Sticker|Folio|Consecutivo)\b"
                  r"(?:\s+No\.?\s*|\s*N[°º.]\s*)?\s*[:.-]?\s*"
                  r"((?:" + DIGITO_OCR + r"[\- ]?){6,11}" + DIGITO_OCR + r")", texto, re.I)
        # Sticker con serie ALFANUMÉRICA ("Radicado No.: 2H210000736"):
        # token pegado, sin espacios — la etiqueta da la certeza
        or re.search(r"\b(?:Rad(?:[i1l]c[a4]d[o0])?|Sticker|Consecutivo)\b"
                     r"(?:\s+No\.?\s*|\s*N[°º.]\s*)?\s*[:.-]?\s*([0-9A-Za-zOolI|]{6,12})", texto, re.I)
        # "No." / "N°" seguido de número con año (20xxxxxx / 26xxxxxx)
        or re.search(r"\b(?:No\.?|N[°º])\s*[:.]?\s*((?:[2][0-9OolI|][\- ]?){5,9}" + DIGITO_OCR + r")\b", texto, re.I)
        # RAD-AAAA-NNNNN
        or re.search(r"\bRAD[-.]?(\d{4})[-.]?(\d{4,6})\b", texto, re.I)
        # Número suelto con forma de año al inicio (20xxxxxx / 26xxxxxx)
        or re.search(r"\b(2" + DIGITO_OCR + r"{7,10})\b", texto, re.I)
    )
    if m_rad:
        crudo = f"{m_rad.group(1)}{m_rad.group(2)}" if m_rad.lastindex and m_rad.lastindex >= 2 and m_rad.group(2) else m_rad.group(1).strip()
        resultado["numeroRadicadoPdf"] = probar_radicado(crudo)

    # 2. FECHA DEL SELLO — etiqueta FECHA (con huecos de OCR) o primera fecha
    # válida del documento. La captura tolera O/0 y l/1 y se normaliza; una
    # candidata sin etiqueta se valida (día ≤ 31, mes ≤ 12) antes de aceptarse.
    m_fecha_sello = re.search(r"F\s*E\s*C\s*H\s*A(?:\s*[:.\-]\s*|\s*)(" + PATRON_FECHA + r")", texto, re.I)
    # "27/may/2026": mapa de meses cortos o con ruido OCR a formato numérico/estándar
    m_fecha_texto = re.search(r"(" + DIGITO_OCR + r"{1,2})/([a-zA-Z0-9áéíóúÁÉÍÓÚ]{3,9})/(" + DIGITO_OCR + r"{4})", texto, re.I)
    f_sello = normalizar_digitos(m_fecha_sello.group(1)) if m_fecha_sello else ""
    mes_mapeado = (MESES_OCR.get(m_fecha_texto.group(2).lower(), m_fecha_texto.group(2)) if m_fecha_texto else "")
    f_texto = (f"{normalizar_digitos(m_fecha_texto.group(1))}-{mes_mapeado}-{normalizar_digitos(m_fecha_texto.group(3))}"
               if m_fecha_texto else "")
    dia_texto = int(normalizar_digitos(m_fecha_texto.group(1)) or 0) if m_fecha_texto else 0
    # El sello manda, pero una fecha imposible ("99/99/2026") jamás viaja:
    # cae a la primera fecha válida del documento.
    if f_sello and _es_fecha_posible(f_sello):
        resultado["fechaDocumento"] = f_sello
    elif 1 <= dia_texto <= 31:
        resultado["fechaDocumento"] = f_texto
    if not resultado["fechaDocumento"]:
        for m in re.finditer(PATRON_FECHA, texto):
            f = normalizar_digitos(m.group(0))
            if _es_fecha_posible(f):
                resultado["fechaDocumento"] = f
                break
    # Último recurso: la fecha solo está en letras ("12 de agosto de 2026",
    # "agosto 12 de 2026"). Día y año toleran ruido OCR (O/0, l/1) y se
    # normalizan; el mes viaja tal cual. El día se valida (1-31) y el mes es
    # de calendario: "45 de febrero" o "Acuerdo 15 de 2019" no son fecha.
    if not resultado["fechaDocumento"]:
        m_letras = (re.search(r"(?<![0-9OolI])(" + DIA_LE + r")[ \t]+de[ \t]+(" + MES_LE + r")[ \t]*" + ENTRE + r"(" + ANIO_LE + r")(?![0-9OolI])", texto, re.I)
                    or re.search(r"(?<![0-9OolI])(" + MES_LE + r")[ \t]+(" + DIA_LE + r")[ \t]*" + ENTRE + r"(" + ANIO_LE + r")(?![0-9OolI])", texto, re.I))
        if m_letras:
            mes_primero = bool(re.fullmatch(MES_LE, m_letras.group(1), re.I))
            dia = re.sub(r"(?:ro|º|°)$", "", normalizar_digitos(m_letras.group(2 if mes_primero else 1)))
            mes = m_letras.group(1) if mes_primero else m_letras.group(2)
            resultado["fechaDocumento"] = f"{dia} de {mes} de {normalizar_digitos(m_letras.group(3))}"
    # Sticker: "14 ago. 2020" — día, mes abreviado (con o sin punto) y año
    # SEPARADOS POR ESPACIO, sin la palabra "de". Viaja tal cual aparece.
    if not resultado["fechaDocumento"]:
        m_sticker = re.search(r"(?<![0-9OolI])(" + DIA_LE + r")[ \t]+(" + MES_LE + r")[ \t]+(" + ANIO_LE + r")(?![0-9OolI])", texto, re.I)
        if m_sticker:
            d = re.sub(r"(?:ro|º|°)$", "", normalizar_digitos(m_sticker.group(1)))
            resultado["fechaDocumento"] = f"{d} {m_sticker.group(2)} {normalizar_digitos(m_sticker.group(3))}"

    # 2b. HORA DEL SELLO — etiqueta HORA ("Hora: 4:06 PM") u hora que viaja
    # junto a la fecha corta del sello ("14/08/2026 4:06 PM"). Los dígitos
    # toleran el ruido O/0 y l/1 del OCR y se normalizan; una hora imposible
    # (minuto > 59, 13 con AM/PM, 25 en formato 24h) jamás viaja. Si hay fecha
    # y hora ambas se combinan en el mismo campo ("14/08/2026 — 4:06 PM");
    # una hora sin fecha no alcanza para rellenar nada (regla: dato o vacío).
    def validar_y_formatear_hora(cruda, ampm):
        h_str, _, m_str = normalizar_digitos(cruda).partition(":")
        try:
            h, m = int(h_str), int(m_str)
        except ValueError:
            return ""
        if m > 59:
            return ""
        es_12h = bool(re.search(r"[AP]", ampm or "", re.I))
        if (h < 1 or h > 12) if es_12h else h > 23:
            return ""
        marca = (" " + re.sub(r"[.\s]", "", ampm.upper())) if ampm else ""
        return f"{h}:{str(m).zfill(2)}{marca}"

    m_hora = (
        # Etiqueta del sello: "Hora: 4:06 PM" / "HORA 10:30" (con ruido OCR)
        re.search(r"\bH[O0]R[OA4]\b(?:\s*[:.\-]\s*|\s+)(" + PATRON_HORA + r")(?:\s*([AP]\.?\s?M\.?))?", texto, re.I)
        # Hora inmediatamente después de una fecha corta del documento
        or re.search(r"(?:^|[\s,])" + PATRON_FECHA + r"\s+(" + PATRON_HORA + r")(?:\s*([AP]\.?\s?M\.?))?", texto, re.I | re.M)
        # Hora pegada al sticker SIGOB: "2610000736 14 ago. 2026 10:30"
        or re.search(r"(?<![0-9OolI])" + DIA_LE + r"[ \t]+" + MES_LE + r"[ \t]+" + ANIO_LE + r"[ \t]+(" + PATRON_HORA + r")(?![0-9OolI])", texto, re.I)
    )
    hora_sello = validar_y_formatear_hora(m_hora.group(1), m_hora.group(2)) if m_hora else ""
    if resultado["fechaDocumento"] and hora_sello:
        resultado["fechaDocumento"] = f"{resultado['fechaDocumento']} — {hora_sello}"

    # 3. LUGAR Y FECHA DE LA CARTA — "San Gil, 12 de agosto de 2026" y las
    # variantes colombianas. Las alternativas con lugar van ANCLADAS a inicio
    # de línea — una fecha en mitad del cuerpo no es el lugar de la carta — y
    # la genérica exige palabras con inicial mayúscula SIN flag /i: la
    # insensibilidad dejaba colar prefijos minúsculos de la línea superior.
    m_lugar_f = (
        re.search(r"^[ \t]*((?:" + MUNICIPIOS_ZONA + r")[ \t]*,?[ \t]*(?:" + FECHA_LARGA + r"|" + FECHA_CORTA + r"))", texto, re.I | re.M)
        or re.search(r"^[ \t]*((?:" + MUNICIPIOS_ZONA + r"),[^,\n\r]{2,32},[ \t]*(?:" + FECHA_LARGA + r"))", texto, re.I | re.M)
        or re.search(r"^[ \t]*((?:" + MUNICIPIOS_ZONA + r")[ \t]+a[ \t]+(?:" + FECHA_LARGA + r"))", texto, re.I | re.M)
        or re.search(r"^[ \t]*([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ.]*(?:[ \t]+[A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ.]*){0,2}[ \t]*,[ \t]*(?:" + FECHA_LARGA + r"))", texto, re.M)
        or re.search(r"^[ \t]*(" + FECHA_LARGA + r")[ \t]*$", texto, re.I | re.M)
    )
    if m_lugar_f:
        resultado["lugarFecha"] = _limpiar_espacios(m_lugar_f.group(1)).strip()

    # Bloque bajo "Señores:" (plural): la entidad o cargo A QUIÉN va dirigida
    # la carta, en la MISMA línea ("Señores: ALCALDÍA…", "Señores ACUASAN…")
    # o en las siguientes. "Señores" también llega manglado del OCR ("Seores",
    # "SE ORES"). Una línea de cuerpo jamás entra: se exige apariencia de
    # encabezado (sin verbos de carta, sin años, sin NIT ni contactos) y la
    # segunda línea solo aporta si es un cargo.
    def es_linea_encabezado(l):
        if not l or len(l) <= 3 or len(l) > 90:
            return False
        if es_frase_de_cuerpo(l):
            return False
        if re.search(r"\b(?:solicito|solicitamos|solicitar|manifiesto|informo|dirijo|presente|"
                     r"atenta|favor|seg[uú]n|respuesta|lleva|existe|reclam|escribo|peticion|"
                     r"comunicaci[oó]n|usted|fin)\b", l, re.I):
            return False
        if len(l.split()) > 15:
            return False
        return True

    def es_linea_contacto(l):
        return bool(re.search(r"N\.?\s?I\.?\s?T\.?|Celular|C[eé]dula|C\.C\.|NIT", l, re.I))

    def bloque_seniores():
        for i in range(len(lineas)):
            m_linea = re.match(r"^Se\s*[nñ]?\s*o?res\b[ \t]*[:：]?[ \t]*(.*)$", lineas[i], re.I)
            if not m_linea:
                continue
            partes = []
            resto = re.sub(r"[,;:]\s*$", "", m_linea.group(1)).strip()
            if resto and es_linea_encabezado(resto):
                partes.append(resto)
            for j in range(i + 1, min(i + 3, len(lineas))):
                l = lineas[j]
                if re.search(r"REFERENCIA|ASUNTO|FECHA|RADICADO", l, re.I):
                    break
                # Anclado: la línea de lugar EMPIEZA por el municipio ("San Gil,
                # 12 de…") — la razón social contiene el pueblo y también es válida
                if _RX_MUNICIPIO_INICIO.match(l):
                    break
                if es_linea_saludo(l):
                    break
                if es_linea_contacto(l) or "@" in l or re.search(r"\d{4}", l):
                    continue
                if not es_linea_encabezado(l):
                    break
                if not partes and not re.match(r"^[A-ZÁÉÍÓÚÑ]", l):
                    break
                partes.append(l)
                if len(partes) == 2:
                    break
            if partes:
                return partes
        return []

    seniores = bloque_seniores()

    # 4. DEPENDENCIA / EMPRESA DESTINATARIA
    # Prioridad: ACUASAN detectado → nombre completo institucional.
    # SIGOB/ORFEO tienen "DEPENDENCIA:" en el sello digital: se lee primero.
    m_dep_sello = re.search(r"\bDEPENDENCIA\s*[:：]\s*([^\n\r]{4,120})", texto, re.I)
    if m_dep_sello and re.search(r"ACUASAN|ACUEDUCTO", m_dep_sello.group(1), re.I):
        resultado["dependencia"] = "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P."
    elif re.search(r"ACUASAN|ACUEDUCTO", texto, re.I):
        resultado["dependencia"] = "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P."
    elif m_dep_sello:
        resultado["dependencia"] = limpiar(m_dep_sello.group(1))
    elif seniores:
        resultado["dependencia"] = seniores[0]
    else:
        m_emp = re.search(r"Se\s*[nñ]?\s*o?res\s*:\s*([^\n\r]+)", texto, re.I)
        if m_emp and es_linea_encabezado(m_emp.group(1)):
            resultado["dependencia"] = m_emp.group(1).strip()

    # 5. PETICIONARIO — etiqueta explícita o saludo "SEÑOR(A):" + nombre/cargo.
    # Valor de etiqueta: detiene la captura si en la misma línea aparece otra
    # etiqueta de sello (Remitente, Destinataria, Radicado, Folios, Anexos…)
    def valor_etiqueta(etiqueta):
        def pelar(v):
            return re.sub(r"^[ \t]*[:：;.,·\-]+[ \t]*", "", v or "").strip()

        mismo = re.search(r"\b(?:" + etiqueta + r")\b[ \t]*[:：]?[ \t]*([^\n\r]+)", texto, re.I)
        if mismo and pelar(mismo.group(1)):
            val = pelar(mismo.group(1))
            prox = re.search(r"\b(?:Remitente|Peticionario|Solicitante|Destinatari[oa]s?|Radicad[oa]|Folios?|Anexos?|Fecha|Hora|Asunto|Referencia)\b", val, re.I)
            if prox and prox.start() > 0:
                val = val[:prox.start()].strip()
            return val

        siguiente = re.search(r"\b(?:" + etiqueta + r")\b[ \t]*[:：][ \t]*\r?\n[ \t]*([^\n\r]+)", texto, re.I)
        if siguiente:
            v = pelar(siguiente.group(1))
            if v and not re.match(r"^(?:Remitente|Peticionario|Solicitante|Destinatari[oa]|Asunto|REFERENCIA|FECHA|Rad|RADICADO|Se[nñ]ores|Señor|C\.C|NIT)", v, re.I):
                return v
        return ""

    remitente_crudo = valor_etiqueta("(?:Remitente|Peticionario|Solicitante)")
    destinatario_crudo = valor_etiqueta("Destinatari[oa]s?")

    peticionario_de_sticker = False
    if remitente_crudo and not es_frase_de_cuerpo(remitente_crudo):
        limpio = limpiar_nombre_persona(re.sub(r"-\s*r\.?\s*/?\s*l\.?\s.*$", "", remitente_crudo, count=1, flags=re.I))
        if es_nombre_valido(limpio):
            resultado["peticionario"] = limpio
            peticionario_de_sticker = True
    if destinatario_crudo and not es_frase_de_cuerpo(destinatario_crudo):
        val_dest = destinatario_crudo.strip()
        m_cod_dest = re.match(r"^(\d{2,8})\s*[-–—]\s*(.{4,80})$", val_dest)
        if m_cod_dest and not re.fullmatch(r"\d+", m_cod_dest.group(2)):
            val_dest = m_cod_dest.group(2).strip()
            if not resultado["referencia"]:
                resultado["referencia"] = m_cod_dest.group(1)
        limpio_dest = limpiar_nombre_persona(val_dest)
        if es_nombre_valido(limpio_dest):
            resultado["destinatario"] = limpio_dest

    if not peticionario_de_sticker:
        def peticionario_invalido():
            p = resultado["peticionario"]
            return (not p or not es_nombre_valido(p) or es_frase_de_cuerpo(p))

        # La autoidentificación explícita ("Yo, X, identificad@ / mayor de
        # edad") es la evidencia más fuerte: corre ANTES que el saludo para
        # que un bloque SEÑORES con la empresa debajo nunca la pise.
        if peticionario_invalido():
            m_yo = re.search(r"Yo[,\s]+([A-ZÁÉÍÓÚÑa-zñáéíóú\s.]{5,50})[,\s]+(?:identificad|mayor de edad|en mi calidad|actuando)", texto, re.I)
            if m_yo and not es_frase_de_cuerpo(m_yo.group(1)) and es_nombre_valido(m_yo.group(1)):
                resultado["peticionario"] = limpiar_nombre_persona(m_yo.group(1))

        if peticionario_invalido():
            for i in range(len(lineas)):
                if not es_linea_saludo(lineas[i]):
                    continue
                nombre = ""
                cargo = ""
                for j in range(i + 1, min(i + 4, len(lineas))):
                    l = lineas[j]
                    if re.search(r"REFERENCIA|ASUNTO|FECHA|RADICADO", l, re.I):
                        break
                    if _RX_MUNICIPIO_INICIO.match(l):
                        break
                    # La empresa destinataria no es peticionaria ("SEÑORES:" + ACUASAN…)
                    if re.search(r"ACUASAN|ACUEDUCTO|E\.I\.CE|E\.S\.P", l, re.I):
                        break
                    if len(l) <= 3 or re.fullmatch(r"\d+", l) or "@" in l:
                        continue
                    if re.search(r"Celular|C[eé]dula|C\.C\.|NIT", l, re.I):
                        continue
                    # Nombre: 2-6 palabras capitalizadas (con conectores
                    # "de/la/y"…), empieza en mayúscula, no es cargo, sin años
                    # ni correo. Tolerar hasta 2 dígitos sueltos: el OCR
                    # escribe "M0RALES".
                    if (not nombre and re.match(r"^[A-ZÁÉÍÓÚÑ]", l) and not CARGO_RE.search(l)
                            and not re.search(r"19\d\d|20\d\d", l) and len(re.findall(r"\d", l)) <= 2
                            and 4 < len(l) <= 60):
                        palabras = l.split()
                        es_conector = lambda w: bool(re.fullmatch(r"(?:de|del|la|las|los|y|e|van|von|mac)", w, re.I))
                        capitalizadas = sum(1 for w in palabras if es_conector(w) or re.match(r"^[A-ZÁÉÍÓÚÑ]", w))
                        if 2 <= len(palabras) <= 6 and capitalizadas == len(palabras) and not es_frase_de_cuerpo(l):
                            nombre = l
                    elif nombre and CARGO_RE.search(l):
                        cargo = l
                if nombre and not es_frase_de_cuerpo(nombre):
                    resultado["peticionario"] = f"{nombre} - {cargo}" if cargo else nombre
                    break

        # Saludo abreviado y nombre en la MISMA línea — como encabezado
        # ("SRA. ANA MARIA RIOS") o como firma con dos puntos al final
        # ("SRA. ANA MARIA RIOS:" tras el "Atentamente,")
        if not resultado["peticionario"] or es_frase_de_cuerpo(resultado["peticionario"]):
            m_inline = re.search(
                r"^[ \t]*(?:SEÑOR\(A\)|SEÑORA|SEÑOR|SENORA|SENOR|SE ORA|SE OR|SRA|SR)\.?[ \t]*[:.]?[ \t]*"
                r"([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-zñáéíóú']{2,}(?:[ \t]+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-zñáéíóú']{1,}){1,})"
                r"(?:[ \t]*[:.])?[ \t]*$", texto, re.I | re.M)
            if m_inline and not es_frase_de_cuerpo(m_inline.group(1)):
                resultado["peticionario"] = m_inline.group(1).strip()

        # Formularios de solicitud / permisos / constancias oficiales:
        # "NOMBRE: Angelica Sandrit Morales Rojas" o "HACE CONSTAR QUE…"
        if peticionario_invalido():
            m_form_nombre = re.search(
                r"\b(?:NOMBRE|FUNCIONARIO|SOLICITANTE|PETICIONARIO|EMPLEADO)\s*[:.-]?\s*"
                r"([A-ZÁÉÍÓÚÑa-zñáéíóú\s.]{5,60})(?=\s*CARGO|\s*CEDULA|\s*FECHA|\s*HORA|\n|$)", texto, re.I)
            if m_form_nombre and es_nombre_valido(m_form_nombre.group(1)):
                resultado["peticionario"] = m_form_nombre.group(1).strip()
        if peticionario_invalido():
            m_constancia = re.search(
                r"(?:HACE[N]?\s*CONSTAR\s*[:\s]*QUE|QUE\s+EL\s+SEÑOR|QUE\s+LA\s+SEÑORA|QUE)\s+"
                r"([A-ZÁÉÍÓÚÑa-zñáéíóú\s.]{6,60})(?=\s+identificad|\s+con\s+documento|\s+prest[oó]|\s+en\s+calidad)", texto, re.I)
            if m_constancia and es_nombre_valido(m_constancia.group(1)):
                resultado["peticionario"] = m_constancia.group(1).strip()

        # SUSCRITO/A: fórmula jurídica de tutelas y peticiones ("SUSCRITA:
        # MARÍA RÍOS, mayor de edad"). El nombre exige un corte con evidencia —
        # coma, "identificad…", "mayor de edad" o la cédula — para no tragarse
        # la prosa que sigue.
        if peticionario_invalido():
            m_suscrito = re.search(
                r"\bSUSCRIT[OA]S?\s*\(?\s*[AO]?\s*\)?\s*[:：.,\s]\s*"
                r"([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-zñáéíóú\s.']{5,60}?)"
                r"(?=[,;]|\s+identificad|\s+mayor\s+de\s+edad|\s+con\s+c\.?\s*c\.?)", texto, re.I)
            if m_suscrito and not es_frase_de_cuerpo(m_suscrito.group(1)) and es_nombre_valido(m_suscrito.group(1)):
                resultado["peticionario"] = limpiar_nombre_persona(m_suscrito.group(1))

        # Firma final: cartas donde el nombre solo aparece en la firma, tras
        # la despedida ("Atentamente," → nombre). Reutiliza el helper del
        # firmante de oficios de respuesta — el bloque de firma es el mismo.
        if peticionario_invalido():
            de_firma = _extraer_nombre_de_firma(lineas)
            if de_firma and es_nombre_valido(de_firma):
                resultado["peticionario"] = limpiar_nombre_persona(de_firma)

    # 5b. DESTINATARIO sin etiqueta — a quién va dirigida la carta, en orden
    # de certeza: "A:"/"Att:" al inicio de línea, el bloque bajo "Señores:",
    # el saludo SEÑOR(A) cuando el peticionario ya quedó establecido por otra
    # vía (carta respuesta: el saludo señala al receptor), y de último la
    # línea propia de la entidad (membrete).
    if not resultado["destinatario"]:
        m_att = re.search(r"^[ \t]*(?:A|ATT|Atenci[oó]n)\.?[ \t]*[:：][ \t]*([^\n\r]{4,90})[ \t]*$", texto, re.I | re.M)
        if m_att and es_linea_encabezado(m_att.group(1)):
            resultado["destinatario"] = m_att.group(1).strip()
    if not resultado["destinatario"] and seniores:
        resultado["destinatario"] = " - ".join(seniores[:2])
    if not resultado["destinatario"] and resultado["peticionario"] and not es_frase_de_cuerpo(resultado["peticionario"]):
        for i in range(len(lineas)):
            if not es_linea_saludo(lineas[i]) or re.match(r"^Se\s*[nñ]?\s*o?res\b", lineas[i], re.I):
                continue
            nombre = ""
            cargo = ""
            for j in range(i + 1, min(i + 4, len(lineas))):
                l = lineas[j]
                if re.search(r"REFERENCIA|ASUNTO|FECHA|RADICADO", l, re.I):
                    break
                if _RX_MUNICIPIO_INICIO.match(l):
                    break
                if es_frase_de_cuerpo(l) or not es_linea_encabezado(l):
                    break
                if es_linea_contacto(l) or re.fullmatch(r"\d+", l) or "@" in l:
                    continue
                if len(l) <= 3:
                    continue
                if (not nombre and re.match(r"^[A-ZÁÉÍÓÚÑ]", l) and not CARGO_RE.search(l)
                        and not re.search(r"19\d\d|20\d\d", l) and len(re.findall(r"\d", l)) <= 2
                        and 4 < len(l) <= 60):
                    n_palabras = len(l.split())
                    if 2 <= n_palabras <= 6:
                        nombre = l
                elif nombre and CARGO_RE.search(l):
                    cargo = l
            def igual(a, b):
                return re.sub(r"\s+", " ", str(a)).strip().upper() == re.sub(r"\s+", " ", str(b)).strip().upper()
            if nombre and not igual(nombre, str(resultado["peticionario"]).split(" - ")[0]):
                resultado["destinatario"] = f"{nombre} - {cargo}" if cargo else nombre
                break
    if not resultado["destinatario"]:
        l_entidad = next((l for l in lineas
                          if re.match(r"^(?:EMPRESA|ACUASAN|ACUEDUCTO|GERENTE|GERENCIA|PRESIDENT|REPRESENTANTE|DIRECTOR|SECRETARI)", l, re.I)
                          and re.search(r"ACUASAN|ACUEDUCTO|E\.?\s?I\.?\s?C\.?\s?E|E\.?\s?S\.?\s?P", l, re.I)
                          and len(l) <= 90 and es_linea_encabezado(l)), None)
        if l_entidad:
            resultado["destinatario"] = l_entidad.strip()

    # 6. REFERENCIA
    # SIGOB / ORFEO incluyen etiqueta "CODIGO:", "Ref:", "REFERENCIA:" o
    # "CÓDIGO DE DEPENDENCIA:" en el sello. FIEL AL JS: mRef se calcula pero
    # nunca se asigna (código muerto del original) — la referencia real solo
    # nace del código pelado del Destinatario (paso 5) o del C.C. de aquí.
    ref_cruda = (valor_etiqueta("REFERENCIA|REF")
                 or valor_etiqueta("CODIGO")
                 or valor_etiqueta("C[OÓ]DIGO DE DEPENDENCIA"))
    m_ref = ref_cruda or re.search(r"(C[oó]digo de suscriptor[^\n\r]*)", texto, re.I)
    if not resultado["referencia"]:
        m_doc = re.search(r"\b(?:documento|c[eé]dula|C\.?C\.?)\s*(?:No\.?|#)?\s*[:.-]?\s*([0-9]{6,12})\b", texto, re.I)
        if m_doc:
            resultado["referencia"] = f"C.C. {m_doc.group(1)}"

    # 7. ASUNTO — etiqueta (Asunto, Descripción, Motivo, Objeto), o la
    # referencia, o solicitud / tutela
    asunto_crudo = valor_etiqueta("Asunto|Descr(?:ipci[oó]n)?|Motivo|Objeto")
    if asunto_crudo and not es_frase_de_cuerpo(asunto_crudo):
        resultado["asunto"] = asunto_crudo.strip()
    elif resultado["referencia"] and not re.fullmatch(r"\d{1,6}", resultado["referencia"]) and not re.match(r"^C\.C\.", resultado["referencia"], re.I):
        # Un código pelado ("950" del Destinatario) no describe un asunto
        resultado["asunto"] = resultado["referencia"]
    else:
        m_solicitud = re.search(r"(Solicitud[^\n\r]+)", texto, re.I) or re.search(r"(Acci[oó]n de Tutela[^\n\r]{5,100})", texto, re.I)
        if m_solicitud and not es_frase_de_cuerpo(m_solicitud.group(1)):
            resultado["asunto"] = m_solicitud.group(1).strip()
        elif re.search(r"SOLICITUD\s+DE\s+PERMISO|PERMISO\s+LABORAL", texto, re.I):
            resultado["asunto"] = "Solicitud de Permiso Laboral"
            if re.search(r"Compensatorio", texto, re.I):
                resultado["asunto"] += " - Compensatorio"
            elif re.search(r"M[eé]dico", texto, re.I):
                resultado["asunto"] += " - Cita Médica"
            elif re.search(r"Personal", texto, re.I):
                resultado["asunto"] += " - Personal"
        elif re.search(r"FORMULARIO\s+E-?18|JURADO\s+DE\s+VOTACI[OÓ]N|REGISTRADUR", texto, re.I):
            resultado["asunto"] = "Certificado de Función Electoral - Formulario E-18"

    # SIGOB: "USUARIO:" / "FUNCIONARIO:" = destinatario del trámite interno
    # (a quién se asignó en el sistema). Se lee SOLO si destinatario no se
    # resolvió por los bloques de saludo (mayor certeza).
    if not resultado["destinatario"]:
        m_usuario_sigob = re.search(r"\b(?:USUARIO|FUNCIONARIO|ASIGNADO A)\s*[:：]\s*([^\n\r]{4,90})", texto, re.I)
        if m_usuario_sigob:
            # Formato "940 - Ruiz Suarez Luz Marina": pelar código delante
            val = m_usuario_sigob.group(1).strip()
            m_cod = re.match(r"^(\d{2,8})\s*[-–—]\s*(.{4,80})$", val)
            if m_cod and not re.fullmatch(r"\d+", m_cod.group(2)):
                val = m_cod.group(2).strip()
            if es_linea_encabezado(val):
                resultado["destinatario"] = val

    # 8. CONTEXTO — el párrafo sustantivo de la carta (recortado a 450 cars)
    resultado["contexto"] = _extraer_contexto(texto, lineas)

    # 9. DÍAS DE TÉRMINO LEGAL según lo que pide la carta. tipoPeticion es
    # informativo (resumen de lectura); el término final respeta la prioridad
    # plazo explícito > tutela > clasificación de la petición.
    resultado["diasParaVencer"] = inferir_dias(texto)
    resultado["tipoPeticion"] = inferir_tipo_peticion(texto)["tipo"]

    # 10. CORRECCIÓN ORTOGRÁFICA DE RUIDO OCR Y FORMATEO ELEGANTE ("MODALES")
    if resultado["peticionario"]:
        resultado["peticionario"] = formatear_nombre_persona(resultado["peticionario"])
    if resultado["destinatario"]:
        resultado["destinatario"] = formatear_nombre_persona(resultado["destinatario"])
    if resultado["asunto"]:
        resultado["asunto"] = formatear_asunto(resultado["asunto"])
    if resultado["contexto"]:
        resultado["contexto"] = formatear_texto_parrafo(resultado["contexto"])

    return resultado


def _extraer_contexto(texto, lineas):
    # Dos niveles: las aperturas de cuerpo de carta (En atención, Por medio…)
    # describen el asunto real; "Solicit…" también aparece en etiquetas como
    # REFERENCIA/Asunto, así que solo se usa si no hay apertura de cuerpo.
    m_clave = re.search(
        r"(?:En atenci[oó]n|Por medio|Me permito|Me dirijo|Yo,|Con el fin|Una vez|"
        r"Respetados?[oa]?\b|Respetuosamente|Mediante|A trav[eé]s|Se solicita)[^\n\r]*[\s\S]{30,600}", texto, re.I)
    if not m_clave:
        # "Solicitante:" es etiqueta de sello, no apertura de carta: con el
        # lookahead negativo no arrastra las líneas del sticker al contexto.
        m_clave = re.search(r"Solicit(?!ante\b)[^\n\r]*[\s\S]{30,600}", texto, re.I)
    if m_clave:
        contexto = m_clave.group(0)
    else:
        def sirve(l):
            if re.match(r"^(?:REPUBLICA|DEPARTAMENTO|EMPRESA DE ACUEDUCTO|NIT|NUIR|SEÑOR|SEÑORA|"
                        r"REFERENCIA:|Rad\.|Radicad[oa]|Sticker|Remitente|Peticionario|Solicitante|"
                        r"Destinatari|Folios?|Anexos?|No\.|FECHA|Hora|USUARIO|FUNCIONARIO)", l, re.I):
                return False
            if re.match(r"^(?:San Gil|Pinchote),", l, re.I):
                return False
            # Líneas propias de un sello: fecha corta o con mes, y hora "4:06 PM"
            if re.fullmatch(r"[0-9OolI]{1,2}[\/\-][0-9OolA-Za-z]{1,4}[\/\-][0-9OolI]{4}\s*(?:[0-9]{1,2}:[0-9]{2}\s*(?:[AP]\.?M\.?)?)?\s*", l, re.I):
                return False
            if re.fullmatch(r"[0-9]{1,2}:[0-9]{2}\s*(?:[AP]\.?M\.?)?", l):
                return False
            if re.fullmatch(r"[0-9OolI]{1,2}[ \t]+de[ \t]+[a-záéíóú]+[ \t]+de[ \t]+[0-9OolI]{4}\s*", l, re.I):
                return False
            if re.fullmatch(r"[\s_.\-=*|I:]+", l):
                return False
            # Un sello de una palabra ("RADICADO", "PETICION") no es párrafo
            if len(l.split()) < 2:
                return False
            if len(l) < 15 and not re.search(r"[a-záéíóú]", l, re.I):
                return False
            return True

        cuerpo = [l for l in lineas if sirve(l)]
        contexto = " ".join(cuerpo[:4])

    contexto = (contexto.replace("\r", " ").replace("\n", " "))
    # Colapsar líneas de puntos/guiones del OCR (mínimo 2 símbolos) sin comerse
    # el punto de una oración seguido de espacio ("2026.  Yo" → "2026. Yo").
    contexto = re.sub(r"(?:[\s._\-]*[._\-][\s._\-]*){2,}", " ", contexto)
    contexto = re.sub(r"\s{2,}", " ", contexto)
    # Las líneas de contacto/firma que cierran la carta no aportan al
    # resumen — pero un "C.C." dentro de una frase de identificación se
    # queda (es parte del texto sustantivo).
    contexto = re.sub(r"\s+(?:C[eé]dula|Celular|Tel[eé]fono|Atentamente)[\s\S]*$", "", contexto, flags=re.I).strip()

    if len(contexto) > 450:
        sub = contexto[:450]
        ultimo_punto = sub.rfind(".")
        if ultimo_punto > 200:
            sub = sub[:ultimo_punto + 1]
        else:
            ultimo_espacio = sub.rfind(" ")
            if ultimo_espacio > 200:
                sub = f"{sub[:ultimo_espacio]}..."
        contexto = sub
    return contexto


def inferir_dias(texto):
    """Término legal en días, por prioridad:
      1. El plazo que el documento declara expresamente ("dentro de los 15 días…")
      2. Tutela: término fijo de 3 días (ley 1755/2015 y decreto 2591)
      3. Clasificación textual de la petición (Ley 1755/2015).
    Sin ninguna señal devuelve None: el operador conserva el término que
    eligió — no se adivina del contenido."""
    # Acepta el número con palabra y paréntesis ("quince (15) días"), el
    # singular ("un (1) día") y dígitos torcidos por el OCR; el ancla final
    # \bd[ií]as?\b evita falsos positivos tipo "acuerdo 014".
    m_plazo = re.search(
        r"(?:plazo|t[eé]rmino|tiempo|vence|vencimiento|dentro de)\s*(?:un\s+t[eé]rmino\s+de\s*)?"
        r"(?:de\s+)?(?:el\s+|los\s+|las\s+|un\s+|una\s+)?(?:[a-záéíúó]+\s+)?\(?(" + DIGITO_OCR + r"{1,2})\)?\s*d[ií]as?\b",
        texto, re.I)
    if m_plazo:
        num = int(normalizar_digitos(m_plazo.group(1)))
        if num in (3, 5, 10, 15, 30):
            return num
        if num <= 4:
            return 3
        if num <= 7:
            return 5
        if num <= 12:
            return 10
        if num <= 20:
            return 15
        return 30
    if re.search(r"\btutela\b", texto, re.I):
        return 3
    # Sin plazo propio: la clasificación de la petición sugiere el término
    por_tipo = inferir_tipo_peticion(texto)
    if por_tipo["dias"] is not None:
        return por_tipo["dias"]
    return None


# ═════════════════════════════════════════════════════════════════════════════
# PARSING DE OFICIOS DE RESPUESTA (documento de SALIDA de Acuasan)
# ═════════════════════════════════════════════════════════════════════════════

def extraer_campos_respuesta(texto):
    """Mismo contrato que extraer_campos pero para oficios: el texto llega del
    OCR y solo se devuelven los campos que se leen con certeza."""
    resultado = {
        "numeroOficio": "",
        "fechaDocumento": "",
        "lugarFecha": "",
        "destinatario": "",
        "asunto": "",
        "firmante": "",            # Funcionario que suscribe el oficio
        "radicadoReferencia": "",  # N° del radicado padre detectado en el texto
    }
    if not texto or not texto.strip():
        return resultado

    texto = normalizar_texto_ocr(texto)
    lineas = [l.strip() for l in re.split(r"\r?\n", texto) if l.strip()]

    # 0. RADICADO AL QUE RESPONDE — el sello impreso en el oficio de salida
    #    incluye la etiqueta "Respuesta a Radicado No.:" seguida del número.
    #    También se busca "En respuesta al Radicado No." en el cuerpo.
    m_rad_ref = (
        re.search(r"Respuesta\s+a\s+Radicado\s+No\.?\s*[:.]?\s*((?:" + DIGITO_OCR + r"[\- ]?){6,11}" + DIGITO_OCR + r")", texto, re.I)
        or re.search(r"(?:en\s+respuesta|dando\s+respuesta)\s+.*?[Rr]adicado\s+(?:No\.?|N[°º])\.?\s*((?:" + DIGITO_OCR + r"[\- ]?){6,11}" + DIGITO_OCR + r")", texto, re.I)
        or re.search(r"[Rr]adicado\s+(?:No\.?|N[°º])?\.?\s*((?:" + DIGITO_OCR + r"[\- ]?){6,11}" + DIGITO_OCR + r")", texto, re.I)
    )
    if m_rad_ref:
        resultado["radicadoReferencia"] = probar_radicado(m_rad_ref.group(1))

    # 1. N° DE OFICIO — Prioridad:
    #    a) Etiqueta "CÓDIGO:" (tabla de encabezado institucional)
    #    b) "Oficio No./N°" en cualquier forma
    #    c) "No. de Oficio:" al revés
    #    d) Patrón alfanumérico de código de dependencia (XXX-YY-NNN-AAAA)
    m_codigo = (
        # CÓDIGO: 940-CE-236-2026  (tabla de encabezado)
        re.search(r"\bC[OÓ]DIGO\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9\-/.]{2,24})", texto, re.I)
        # "Oficio No." / "OFICIO N°" en cualquier forma
        or re.search(r"\b(?:Ofici[o0]s?)\b(?:\s*(?:No\.?|N[°º]|de)\s*)?(?:[ \t]*[:.\-][ \t]*|\s*)([A-Za-z0-9][A-Za-z0-9OolI|\-/.]{1,24})", texto, re.I)
        or re.search(r"\b(?:No\.?|N[°º])\s*(?:de\s+)?(?:Ofici[o0])(?:[ \t]*[:.\-][ \t]*|\s*)([A-Za-z0-9][A-Za-z0-9OolI|\-/.]{1,24})", texto, re.I)
        # Código de serie institucional Acuasan: "940-CE-236-2026"
        or re.search(r"\b(\d{2,4}-[A-Za-z]{1,4}-\d{1,5}-\d{4})\b", texto)
        # Código de serie clásico: "OF-2026-104" o "AC-2026-045"
        or re.search(r"\b([A-Za-z]{2,5}-\d{4}-\d{1,5})\b", texto)
    )
    if m_codigo:
        token = re.sub(r"[.:,;]+$", "", m_codigo.group(1)).strip()
        # Debe tener al menos 2 dígitos o ser un código alfanumérico corto
        if len(re.findall(r"\d", token)) >= 2 or re.match(r"^[A-Za-z]{1,6}[-]?\d+", token, re.I):
            resultado["numeroOficio"] = token

    # 2. LUGAR Y FECHA — "San Gil, 16 de junio de 2026" al inicio de línea.
    #    La fecha de emisión del documento está en el encabezado (lugarFecha)
    #    y tiene prioridad sobre fechas de radicados anteriores citados en el cuerpo.
    m_lugar = (
        re.search(r"^[ \t]*((?:" + MUNICIPIOS_ZONA + r")[ \t]*,?[ \t]*(?:" + FECHA_LARGA + r"|" + PATRON_FECHA + r"))", texto, re.I | re.M)
        or re.search(r"^[ \t]*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,20}(?:[ \t]+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,15})?)[ \t]*,[ \t]*(" + FECHA_LARGA + r"|" + PATRON_FECHA + r")[ \t]*$", texto, re.I | re.M)
    )
    if m_lugar:
        # La primera alternativa envuelve lugar+fecha en un solo grupo; la segunda los captura por separado.
        resultado["lugarFecha"] = _limpiar_espacios(
            f"{m_lugar.group(1)}, {m_lugar.group(2)}" if (m_lugar.lastindex or 0) >= 2 else m_lugar.group(1)).strip()
        m_fecha_letras_lugar = re.search(r"(" + DIA_LE + r")[ \t]+de[ \t]+(" + MES_LE + r")[ \t]*" + ENTRE + r"(" + ANIO_LE + r")", resultado["lugarFecha"], re.I)
        if m_fecha_letras_lugar:
            d = re.sub(r"(?:ro|º|°)$", "", normalizar_digitos(m_fecha_letras_lugar.group(1)))
            resultado["fechaDocumento"] = f"{d} de {m_fecha_letras_lugar.group(2)} de {normalizar_digitos(m_fecha_letras_lugar.group(3))}"
        else:
            m_fecha_corta_lugar = re.search(r"(" + PATRON_FECHA + r")", resultado["lugarFecha"])
            if m_fecha_corta_lugar and _es_fecha_posible(normalizar_digitos(m_fecha_corta_lugar.group(1))):
                resultado["fechaDocumento"] = normalizar_digitos(m_fecha_corta_lugar.group(1))

    # Si no hubo lugar y fecha con fecha, buscar etiqueta FECHA o fecha en letras
    if not resultado["fechaDocumento"]:
        m_fecha_etiqueta = re.search(r"F\s*E\s*C\s*H\s*A(?:\s*[:.\-]\s*|\s*)(" + PATRON_FECHA + r")", texto, re.I)
        if m_fecha_etiqueta and _es_fecha_posible(normalizar_digitos(m_fecha_etiqueta.group(1))):
            resultado["fechaDocumento"] = normalizar_digitos(m_fecha_etiqueta.group(1))
    if not resultado["fechaDocumento"]:
        for m in re.finditer(PATRON_FECHA, texto):
            f = normalizar_digitos(m.group(0))
            if _es_fecha_posible(f):
                resultado["fechaDocumento"] = f
                break
    if not resultado["fechaDocumento"]:
        m_letras = (re.search(r"(?<![0-9OolI])(" + DIA_LE + r")[ \t]+de[ \t]+(" + MES_LE + r")[ \t]*" + ENTRE + r"(" + ANIO_LE + r")(?![0-9OolI])", texto, re.I)
                    or re.search(r"(?<![0-9OolI])(" + MES_LE + r")[ \t]+(" + DIA_LE + r")[ \t]*" + ENTRE + r"(" + ANIO_LE + r")(?![0-9OolI])", texto, re.I))
        if m_letras:
            mes_primero = bool(re.fullmatch(MES_LE, m_letras.group(1), re.I))
            dia = re.sub(r"(?:ro|º|°)$", "", normalizar_digitos(m_letras.group(2 if mes_primero else 1)))
            mes = m_letras.group(1) if mes_primero else m_letras.group(2)
            anio = normalizar_digitos(m_letras.group(3))
            resultado["fechaDocumento"] = f"{dia} de {mes} de {anio}"

    if not resultado["numeroOficio"]:
        # Fallback 1: N° de radicado impreso en el sticker del oficio
        m_rad_salida = re.search(r"\b(?:Radicado|Consecutivo)\s+(?:No\.?|N[°º])?\s*[:.]?\s*([0-9]{7,12})\b", texto, re.I)
        if m_rad_salida:
            resultado["numeroOficio"] = m_rad_salida.group(1)
    if not resultado["numeroOficio"]:
        # Fallback 2: Token alfanumérico destacado en el encabezado
        m_token = re.search(r"\b([A-Z0-9]{2,6}[-–—][A-Z0-9]{2,6}[-–—]\d{2,6})\b", texto)
        if m_token:
            resultado["numeroOficio"] = m_token.group(1)

    # Si aún no hay fecha del oficio, usar la fecha de hoy formateada formalmente
    if not resultado["fechaDocumento"]:
        hoy = datetime.date.today()
        meses_formal = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        resultado["fechaDocumento"] = f"{hoy.day} de {meses_formal[hoy.month - 1]} de {hoy.year}"

    # 4. DESTINATARIO — a quién va dirigida la respuesta.
    #    Orden de certeza (de mayor a menor):
    #    a) Etiqueta "Destinatario:" o "Para:"
    #    b) DOCTOR / DR. / DRA. / ING. / LIC. + nombre (misma línea o siguiente)
    #    c) Saludo "SEÑOR(A):" + nombre en líneas de abajo
    #    d) "Estimado(a) Nombre:" en línea
    def valor_etq(etiqueta):
        m = re.search(r"\b(?:" + etiqueta + r")\b[ \t]*[:：][ \t]*([^\n\r]+)", texto, re.I)
        if not m:
            return ""
        v = re.sub(r"^[ \t]*[:：;.,·\-]+[ \t]*", "", m.group(1)).strip()
        if not v or es_frase_de_cuerpo(v) or not es_nombre_valido(v):
            return ""
        return v

    resultado["destinatario"] = valor_etq("Destinatari[oa]s?") or valor_etq("Para")

    # DOCTOR / DR. / DRA. / ING. / LIC. / PROF. (saludo en una línea o nombre en la siguiente)
    if not resultado["destinatario"]:
        # Mismo renglón: "DOCTOR: WBEIMAR HERNANDO PEREZ BELTRAN"
        m_doc_inline = re.search(
            r"^[ \t]*(?:DOCTOR[A]?|DR[A]?|ING(?:ENIERD?[OA]?)?|LIC(?:ENCIADO?[OA]?)?|PROF(?:ESOR)?|ARQ(?:UITECTO)?)"
            r"\s*\.?\s*[:：]?\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{2,}(?:[ \t]+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{1,}){1,5})[ \t]*$",
            texto, re.I | re.M)
        if m_doc_inline and not es_frase_de_cuerpo(m_doc_inline.group(1)) and es_nombre_valido(m_doc_inline.group(1)):
            resultado["destinatario"] = m_doc_inline.group(1).strip()
    if not resultado["destinatario"]:
        # Siguiente línea: "DOCTOR" sólo → nombre en la línea de abajo
        for i in range(len(lineas)):
            if not re.fullmatch(r"(?:DOCTOR[A]?|DR[A]?\.?|ING\.?|LIC\.?|PROF\.?|ARQ\.?)\s*", lineas[i], re.I):
                continue
            for j in range(i + 1, min(i + 3, len(lineas))):
                l = lineas[j]
                if re.search(r"ASUNTO|REFERENCIA|FECHA|CIUDAD", l, re.I):
                    break
                if re.match(r"^[A-ZÁÉÍÓÚÑ]", l) and not CARGO_RE.search(l) and 4 < len(l) <= 70:
                    pal = l.split()
                    if 2 <= len(pal) <= 7 and not es_frase_de_cuerpo(l) and es_nombre_valido(l):
                        resultado["destinatario"] = l
                        break
            if resultado["destinatario"]:
                break
    if not resultado["destinatario"]:
        # "Estimado(a) Nombre:" en línea
        m_inline = re.search(
            r"^[ \t]*(?:Estimad[oa]s?)\s*\(?[aá]?\)?(?:\s*[.:，]{0,2}[ \t]*|\s*)"
            r"([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{2,}(?:[ \t]+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ']{1,}){1,5})[ \t]*:?[ \t]*$",
            texto, re.I | re.M)
        if m_inline and not es_frase_de_cuerpo(m_inline.group(1)) and es_nombre_valido(m_inline.group(1)):
            resultado["destinatario"] = m_inline.group(1).strip()
    if not resultado["destinatario"]:
        # Bloque bajo saludo "SEÑOR(A):"
        for i in range(len(lineas)):
            if not es_linea_saludo(lineas[i]) or re.match(r"^Se\s*[nñ]?\s*o?res\b", lineas[i], re.I):
                continue
            for j in range(i + 1, min(i + 4, len(lineas))):
                l = lineas[j]
                if re.search(r"ASUNTO|REFERENCIA|FECHA|REF\b", l, re.I):
                    break
                if re.search(r"Celular|C[eé]dula|C\.C\.|NIT|@", l, re.I):
                    continue
                if (re.match(r"^[A-ZÁÉÍÓÚÑ]", l) and not CARGO_RE.search(l)
                        and not re.search(r"19\d\d|20\d\d", l)
                        and len(re.findall(r"\d", l)) <= 2 and 4 < len(l) <= 60):
                    palabras = l.split()
                    if 2 <= len(palabras) <= 6 and not es_frase_de_cuerpo(l) and es_nombre_valido(l):
                        resultado["destinatario"] = l
                        break
                if CARGO_RE.search(l):
                    break
            if resultado["destinatario"]:
                break

    # 5. ASUNTO — etiqueta "Asunto:" / "Referencia:" / "Ref." en la misma
    #    o siguiente línea. Solo texto con apariencia de título, no prosa.
    m_asunto_misma = re.search(r"\b(?:Asunto|Referencia)\b\s*[:：]\s*([^\n\r]{3,120})", texto, re.I)
    if m_asunto_misma and not es_frase_de_cuerpo(m_asunto_misma.group(1)):
        resultado["asunto"] = limpiar(m_asunto_misma.group(1))
    else:
        m_asunto_sig = re.search(r"\b(?:Asunto|Referencia)\b\s*[:：][ \t]*\r?\n[ \t]*([^\n\r]{3,120})", texto, re.I)
        if m_asunto_sig and not es_frase_de_cuerpo(m_asunto_sig.group(1)):
            resultado["asunto"] = limpiar(m_asunto_sig.group(1))
        else:
            m_ref = re.search(r"\bRef\.?\s*[:：]\s*([^\n\r]{3,120})", texto, re.I)
            if m_ref and not es_frase_de_cuerpo(m_ref.group(1)):
                resultado["asunto"] = limpiar(m_ref.group(1))

    # 6. FIRMANTE — funcionario que suscribe el oficio. Del bloque de firma
    #    ("Atentamente," → nombre → cargo), de una etiqueta explícita o del
    #    encabezado con nombre y cargo en la misma línea. Firma ilegible = ''.
    resultado["firmante"] = _extraer_nombre_de_firma(lineas)

    # CORRECCIÓN OCR Y FORMATEO ELEGANTE EN CAMPOS DEL OFICIO DE RESPUESTA
    if resultado["destinatario"]:
        resultado["destinatario"] = formatear_nombre_persona(resultado["destinatario"])
    if resultado["asunto"]:
        resultado["asunto"] = formatear_asunto(resultado["asunto"])
    if resultado["firmante"]:
        resultado["firmante"] = formatear_nombre_persona(resultado["firmante"])

    return resultado
