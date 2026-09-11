# -*- coding: utf-8 -*-
"""Corpus del parser de radicados — porte de acusan/backend/tests/radicadosParser.test.mjs.

Convención del expect (idéntica al corpus JS):
  · cadena → el campo debe ser exactamente esa cadena
  · ''     → el campo DEBE quedar vacío (regla de oro: nada inventado)
  · None   → el campo debe ser None (días sin señal)
Los campos que NO aparecen en expect quedan sin verificar (como en el JS).
"""

import os
import sys

# Asegurar importación de acuusan_ocr desde acusan/backend
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest

from acuusan_ocr.parser_radicados import (
    extraer_campos,
    extraer_campos_respuesta,
    inferir_dias,
)

NOMBRE_INSTITUCIONAL = "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P."

# ─── Radicados de ENTRADA (extraer_campos) ────────────────────────────────────

CASOS_ENTRADA = [
    {
        "nombre": "E1. Sello SIGOB completo (radicado, fecha, hora, dependencia, remitente)",
        "texto": "\n".join([
            "REPUBLICA DE COLOMBIA",
            "Radicado No.: 2610000736 Folios: 1",
            "FECHA: 14/08/2026",
            "Hora: 4:06 PM",
            "Dependencia: EMPRESA DE ACUEDUCTO ALCANTARILLADO Y ASEO DE SAN GIL ACUASAN",
            "Remitente: PEREZ GOMEZ JOSE",
            "Destinataria: 940 - RUIZ SUAREZ LUZ MARINA",
            "Anexos: 0",
            "Asunto: Solicitud de revisión de facturación",
        ]),
        "expect": {
            "numeroRadicadoPdf": "2610000736",
            "fechaDocumento": "14/08/2026 — 4:06 PM",
            "lugarFecha": "",
            "peticionario": "Pérez Gómez José",
            "dependencia": NOMBRE_INSTITUCIONAL,
            "destinatario": "Ruiz Suárez Luz Marina",
            "referencia": "940",
            "asunto": "Solicitud de Revisión de Facturación",
            "diasParaVencer": None,
        },
    },
    {
        "nombre": 'E2. Carta particular con "Yo, identificada con C.C." y bloque Señores',
        "texto": "\n".join([
            "San Gil, 12 de agosto de 2026",
            "",
            "SEÑORES:",
            "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL ACUASAN E.S.P.",
            "GERENTE GENERAL",
            "",
            "Me dirijo a ustedes para solicitar la revisión de mi factura",
            "correspondiente al mes de julio de 2026.",
            "",
            "Yo, ANA MARIA RIOS, identificada con C.C. 42.657.890.",
            "",
            "Atentamente,",
            "",
            "ANA MARIA RIOS",
            "C.C. 42.657.890",
        ]),
        "expect": {
            "numeroRadicadoPdf": "",
            "lugarFecha": "San Gil, 12 de agosto de 2026",
            "fechaDocumento": "12 de agosto de 2026",
            "dependencia": NOMBRE_INSTITUCIONAL,
            "peticionario": "Ana María Ríos",
            "destinatario": "Empresa de Acueducto, Alcantarillado y Aseo de San Gil ACUASAN E.S.P. - Gerente General",
            "asunto": "",
            "contexto": "Me dirijo a ustedes para solicitar la revisión de mi factura correspondiente al mes de julio de 2026. Yo, ANA MARIA RIOS, identificada con C.C. 42.657.890.",
            # "Me dirijo" (verbo de petición en primera persona) → petición general: 15 días
            "diasParaVencer": 15,
        },
    },
    {
        "nombre": "E3. Tutela → término fijo de 3 días (Ley 1755/2015 y Decreto 2591)",
        "texto": "\n".join([
            "ACCION DE TUTELA",
            "San Gil, 10 de agosto de 2026",
            "",
            "SEÑOR",
            "JUEZ PENAL DEL CIRCUITO",
            "",
            "Acción de tutela contra ACUASAN por suspensión del servicio.",
            "El accionante solicita amparo de sus derechos fundamentales.",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 10 de agosto de 2026",
            "fechaDocumento": "10 de agosto de 2026",
            "dependencia": NOMBRE_INSTITUCIONAL,
            "diasParaVencer": 3,
        },
    },
    {
        "nombre": 'E4. Plazo declarado en el documento: "dentro de los quince (15) días"',
        "texto": "\n".join([
            "San Gil, 2 de enero de 2026",
            "",
            "Por medio de la presente solicito se me responda dentro de los quince (15) días hábiles.",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 2 de enero de 2026",
            "peticionario": "",
            "diasParaVencer": 15,
        },
    },
    {
        "nombre": 'E5. Petición general por verbo en primera persona ("Solicito…") → 15 días',
        "texto": "\n".join([
            "San Gil, 3 de marzo de 2026",
            "",
            "Señores",
            "ACUASAN",
            "",
            "Solicito amablemente la conexión del servicio de acueducto.",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 3 de marzo de 2026",
            "peticionario": "",
            "diasParaVencer": 15,
        },
    },
    {
        "nombre": "E6. Peticionario ilegible → campo vacío (regla de oro)",
        "texto": "\n".join([
            "San Gil, 5 de mayo de 2026",
            "",
            "SEÑORES:",
            "EMPRESA DE ACUEDUCTO ALCANTARILLADO Y ASEO DE SAN GIL ACUASAN",
            "",
            "Por medio de la presente solicito la revisión del servicio de acueducto.",
            "Sin otro particular,",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 5 de mayo de 2026",
            "peticionario": "",
            # "Por medio de la presente" → petición general: 15 días
            "diasParaVencer": 15,
        },
    },
    {
        "nombre": "E7. Solicitud de información → 10 días (art. 14, Ley 1755/2015)",
        "texto": "\n".join([
            "San Gil, 8 de abril de 2026",
            "",
            "Señores",
            "ACUASAN",
            "",
            "Solicito amablemente información sobre el estado de mi contrato de acueducto.",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 8 de abril de 2026",
            "fechaDocumento": "8 de abril de 2026",
            "dependencia": NOMBRE_INSTITUCIONAL,
            "peticionario": "",
            "tipoPeticion": "Información / Documentos",
            "diasParaVencer": 10,
        },
    },
    {
        "nombre": "E8. Queja → 15 días (arts. 21-22, Ley 1755/2015)",
        "texto": "\n".join([
            "San Gil, 9 de abril de 2026",
            "",
            "Señores",
            "ACUASAN",
            "",
            "Presento queja por el cobro repetido de la factura de marzo.",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 9 de abril de 2026",
            "fechaDocumento": "9 de abril de 2026",
            "dependencia": NOMBRE_INSTITUCIONAL,
            "peticionario": "",
            "tipoPeticion": "Consulta / Queja / Reclamo",
            "diasParaVencer": 15,
        },
    },
    {
        "nombre": 'E9. Petición general ("pido") sin señal de información ni queja → 15 días',
        "texto": "\n".join([
            "San Gil, 10 de abril de 2026",
            "",
            "Señores",
            "ACUASAN",
            "",
            "Respetuosamente pido la revisión de las obras del acueducto veredal.",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 10 de abril de 2026",
            "fechaDocumento": "10 de abril de 2026",
            "dependencia": NOMBRE_INSTITUCIONAL,
            "peticionario": "",
            "tipoPeticion": "Petición General",
            "diasParaVencer": 15,
        },
    },
    {
        "nombre": 'E10. Fórmula SUSCRITA: con corte por "mayor de edad" → peticionario',
        "texto": "\n".join([
            "San Gil, 12 de agosto de 2026",
            "",
            "SUSCRITA:",
            "MARIA FERNANDA GOMEZ PEREZ, mayor de edad, identificada con C.C. 65.876.543,",
            "presento petición para la revisión del cobro del mes de junio.",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 12 de agosto de 2026",
            "peticionario": "María Fernanda Gómez Pérez",
        },
    },
    {
        "nombre": 'E11. Firma final: el nombre solo aparece tras "Atentamente,"',
        "texto": "\n".join([
            "San Gil, 20 de agosto de 2026",
            "",
            "Señores",
            "ACUASAN E.S.P.",
            "",
            "Solicito la reconexión del servicio de mi residencia.",
            "",
            "Atentamente,",
            "",
            "LUZ MARINA RUIZ SUAREZ",
            "C.C. 43.210.987",
        ]),
        "expect": {
            "lugarFecha": "San Gil, 20 de agosto de 2026",
            "fechaDocumento": "20 de agosto de 2026",
            "peticionario": "Luz Marina Ruiz Suárez",
            "diasParaVencer": 15,
        },
    },
    {
        "nombre": 'E12. Lugar de la Provincia Comunera: "Valle de San José, …"',
        "texto": "\n".join([
            "Valle de San José, 15 de septiembre de 2026",
            "",
            "Señores",
            "ACUASAN",
            "",
            "Solicito información sobre los proyectos de acueducto del municipio.",
        ]),
        "expect": {
            "lugarFecha": "Valle de San José, 15 de septiembre de 2026",
            "fechaDocumento": "15 de septiembre de 2026",
            "dependencia": NOMBRE_INSTITUCIONAL,
            "tipoPeticion": "Información / Documentos",
            "diasParaVencer": 10,
        },
    },
]

# ─── Oficios de RESPUESTA (extraer_campos_respuesta) ──────────────────────────

CASOS_RESPUESTA = [
    {
        "nombre": "R1. Oficio completo: código, radicado padre, lugar/fecha, doctor, asunto y firma",
        "texto": "\n".join([
            "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.",
            "NIT 686.790.009-1",
            "CÓDIGO: 940-CE-236-2026",
            "",
            "San Gil, 16 de junio de 2026",
            "",
            "Respuesta a Radicado No.: 2610000736",
            "",
            "Doctor",
            "JOSE PEREZ GOMEZ",
            "",
            "Asunto: Respuesta a solicitud de revisión de facturación",
            "",
            "En atención a su solicitud, me permito informar que el proceso",
            "de revisión fue aprobado.",
            "",
            "Atentamente,",
            "",
            "WBEIMAR HERNANDO PEREZ BELTRAN",
            "Gerente General",
        ]),
        "expect": {
            "radicadoReferencia": "2610000736",
            "numeroOficio": "940-CE-236-2026",
            "lugarFecha": "San Gil, 16 de junio de 2026",
            "fechaDocumento": "16 de junio de 2026",
            "destinatario": "José Pérez Gómez",
            "asunto": "Respuesta a Solicitud de Revisión de Facturación",
            "firmante": "Wbeimar Hernando Pérez Beltrán - Gerente General",
        },
    },
    {
        "nombre": "R2. Oficio sin código: fallback al radicado del sticker; firma ilegible",
        "texto": "\n".join([
            "EMPRESA DE ACUEDUCTO Y ASEO DE SAN GIL ACUASAN",
            "NIT 686.790.009-1",
            "",
            "16 de septiembre de 2026",
            "",
            "Respuesta a Radicado No.: 2620000123",
            "",
            "Asunto: Constancia de no cobro",
            "",
            "Cordialmente,",
            "",
            "(firma ilegible)",
        ]),
        "expect": {
            "radicadoReferencia": "2620000123",
            "numeroOficio": "2620000123",
            "lugarFecha": "",
            "fechaDocumento": "16 de septiembre de 2026",
            "asunto": "Constancia de No Cobro",
            "firmante": "",   # "(firma ilegible)": regla de oro, no se adivina
        },
    },
    {
        "nombre": "R3. Oficio con serie clásica OF-AAAA-NNN y fecha mes-primero",
        "texto": "\n".join([
            "EMPRESA DE ACUEDUCTO Y ASEO DE SAN GIL ACUASAN",
            "Oficio No. OF-2026-104",
            "",
            "Bogotá, junio 16 de 2026",
            "",
            "En respuesta al radicado No. 2610000736 me permito informar",
            "que la solicitud fue atendida.",
            "",
            "Atentamente,",
            "",
            "WBEIMAR HERNANDO PEREZ BELTRAN",
            "Gerente General",
        ]),
        "expect": {
            "radicadoReferencia": "2610000736",
            "numeroOficio": "OF-2026-104",
            "lugarFecha": "Bogotá, junio 16 de 2026",
            "fechaDocumento": "16 de junio de 2026",
            "firmante": "Wbeimar Hernando Pérez Beltrán - Gerente General",
        },
    },
    {
        "nombre": 'R4. Etiqueta explícita "Firmante:" con nombre y cargo en el valor',
        "texto": "\n".join([
            "EMPRESA DE ACUEDUCTO Y ASEO DE SAN GIL ACUASAN",
            "Oficio No. OF-2026-105",
            "",
            "San Gil, 20 de enero de 2026",
            "",
            "Asunto: Certificación de deuda",
            "",
            "Cordial saludo.",
            "",
            "Se expide la presente certificación a solicitud del interesado.",
            "",
            "Firmante: Wbeimar Perez Beltran - Gerente General",
        ]),
        "expect": {
            "numeroOficio": "OF-2026-105",
            "lugarFecha": "San Gil, 20 de enero de 2026",
            "fechaDocumento": "20 de enero de 2026",
            "asunto": "Certificación de Deuda",
            "firmante": "Wbeimar Pérez Beltrán - Gerente General",
        },
    },
]

# ─── Casos unitarios de inferir_dias ──────────────────────────────────────────

CASOS_DIAS = [
    ("Responder dentro de los quince (15) días", 15),
    ("con un término de diez (10) días", 10),
    ("plazo de 3 días", 3),
    ("ACCIÓN DE TUTELA", 3),
    ("Sin ninguna señal de plazo", None),
    # Clasificación textual (Ley 1755/2015) sin plazo declarado:
    ("Solicito información sobre el estado de mi contrato", 10),
    ("Se expide certificación de copias del expediente", 10),
    ("Presento queja formal por el cobro duplicado", 15),
    ("Respetuosamente pido la revisión del cobro", 15),
]


def _verificar(nombre, obtenido, esperado):
    for campo, valor_esperado in esperado.items():
        valor_obtenido = obtenido.get(campo)
        if valor_esperado == "":
            # La cadena vacía exige campo vacío: la regla de oro del OCR
            assert not valor_obtenido, (
                f"{nombre} · {campo}: DEBÍA estar vacío y salió {valor_obtenido!r}")
        elif valor_esperado is None:
            assert valor_obtenido is None, (
                f"{nombre} · {campo}: DEBÍA ser None y salió {valor_obtenido!r}")
        else:
            assert valor_obtenido == valor_esperado, (
                f"{nombre} · {campo}: esperado {valor_esperado!r}, obtenido {valor_obtenido!r}")


@pytest.mark.parametrize("caso", CASOS_ENTRADA, ids=lambda c: c["nombre"])
def test_entrada(caso):
    _verificar(caso["nombre"], extraer_campos(caso["texto"]), caso["expect"])


@pytest.mark.parametrize("caso", CASOS_RESPUESTA, ids=lambda c: c["nombre"])
def test_respuesta(caso):
    _verificar(caso["nombre"], extraer_campos_respuesta(caso["texto"]), caso["expect"])


@pytest.mark.parametrize("texto,esperado", CASOS_DIAS, ids=[c[0] for c in CASOS_DIAS])
def test_inferir_dias(texto, esperado):
    assert inferir_dias(texto) == esperado
