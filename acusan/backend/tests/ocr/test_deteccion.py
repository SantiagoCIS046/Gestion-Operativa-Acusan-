# -*- coding: utf-8 -*-
"""Detección documental — corpus del motor de puntaje (porte de VistaRadicados.vue)."""

import os
import sys

# Asegurar importación de acuusan_ocr desde acusan/backend
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest

from acuusan_ocr.deteccion_documental import detectar_tipo_documental

CASOS = [
    (
        "Sello SIGOB con Remitente/Folios → RADICADO (señales del sticker)",
        "\n".join([
            "REPUBLICA DE COLOMBIA",
            "Radicado No.: 2610000736 Folios: 1",
            "FECHA: 14/08/2026",
            "Remitente: PEREZ GOMEZ JOSE",
            "Asunto: Solicitud de revisión de facturación",
        ]),
        "RADICADO",
    ),
    (
        "Carta particular a Señores ACUASAN → RADICADO",
        "\n".join([
            "San Gil, 12 de agosto de 2026",
            "SEÑORES:",
            "ACUASAN E.S.P.",
            "Solicito la reconexión del servicio de mi residencia.",
            "Atentamente,",
            "LUZ MARINA RUIZ SUAREZ",
        ]),
        "RADICADO",
    ),
    (
        '"En respuesta al radicado No." → RESPUESTA',
        "\n".join([
            "EMPRESA DE ACUEDUCTO Y ASEO DE SAN GIL ACUASAN",
            "En respuesta al radicado No. 2610000736 me permito informar",
            "que la solicitud fue atendida.",
        ]),
        "RESPUESTA",
    ),
    (
        '"Respuesta a Radicado No.:" impreso → RESPUESTA',
        "\n".join([
            "CÓDIGO: 940-CE-236-2026",
            "Respuesta a Radicado No.: 2610000736",
            "Asunto: Respuesta a solicitud de revisión de facturación",
        ]),
        "RESPUESTA",
    ),
    (
        "Membrete Acuasan + Atentamente (oficio de salida) → RESPUESTA",
        "\n".join([
            "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL ACUASAN",
            "Doctor",
            "JOSE PEREZ GOMEZ",
            "Cordial saludo.",
            "Atentamente,",
            "WBEIMAR HERNANDO PEREZ BELTRAN",
            "Gerente General",
        ]),
        "RESPUESTA",
    ),
    (
        "Tutela contra Acuasan → RADICADO",
        "Acción de tutela contra ACUASAN por suspensión del servicio.",
        "RADICADO",
    ),
    (
        "Texto vacío → RADICADO (desempate: 0-0, es lo más común)",
        "",
        "RADICADO",
    ),
    (
        '"Oficio de salida" explícito → RESPUESTA',
        "Comunico mediante oficio de salida la respuesta a su solicitud.",
        "RESPUESTA",
    ),
    (
        "Sello físico: EMPRESA DE ACUEDUCTO…ASEO + Remitente → RADICADO contundente",
        "\n".join([
            "EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL",
            "Radicado No.: 2610000736",
            "Remitente: PEREZ GOMEZ JOSE",
            "Folios: 1",
        ]),
        "RADICADO",
    ),
]


@pytest.mark.parametrize("nombre,texto,esperado", CASOS, ids=[c[0] for c in CASOS])
def test_deteccion(nombre, texto, esperado):
    r = detectar_tipo_documental(texto)
    assert r["tipo"] == esperado, (
        f"{nombre}: esperado {esperado}, obtenido {r['tipo']} "
        f"(RAD={r['puntajeRadicado']} RESP={r['puntajeRespuesta']})")


def test_confianza_es_diferencia_de_puntajes():
    r = detectar_tipo_documental("Remitente: X\nFolios: 2")  # 40+20 radicado, 0 respuesta
    assert r["puntajeRadicado"] == 60
    assert r["puntajeRespuesta"] == 0
    assert r["confianza"] == 60


def test_texto_nulo_es_radicado():
    assert detectar_tipo_documental(None)["tipo"] == "RADICADO"
