# -*- coding: utf-8 -*-
r"""
deteccion_documental.py — Motor de detección de tipo documental
─────────────────────────────────────────────────────────────────────────────
Porte fiel del motor de puntaje de VistaRadicados.vue (l.1284-1343): analiza
señales ponderadas para decidir si un documento es un Radicado de ENTRADA o
un Oficio de RESPUESTA emitido por Acuasan. No una sola regex: múltiples
indicadores se suman como puntaje — el tipo con mayor puntaje gana.
Desempate: si los dos quedan en 0, es RADICADO (es lo más común).
"""

import re


def detectar_tipo_documental(texto):
    """Devuelve {'tipo': 'RADICADO' | 'RESPUESTA', 'confianza': |R−P|,
    'puntajeRadicado': int, 'puntajeRespuesta': int}."""
    texto = texto or ""
    texto_upper = texto.upper()
    puntaje_respuesta = 0
    puntaje_radicado = 0

    # ── Señales FUERTES de Oficio de Respuesta (salida de Acuasan) ─────────
    # Frases que solo aparecen en documentos emitidos como respuesta oficial
    if re.search(r"\ben\s+respuesta\s+a(?:l|la|los)?\b", texto, re.I):
        puntaje_respuesta += 40
    if re.search(r"\brespuesta\s+al\s+radicado\b", texto, re.I):
        puntaje_respuesta += 40
    # Etiqueta impresa del formato de oficio de respuesta; pesa más que las
    # señales de ventanilla que el mismo formato arrastra ("Radicado No.:").
    if re.search(r"\bRespuesta\s+a\s+Radicado\s+No\.?\s*:", texto, re.I):
        puntaje_respuesta += 60
    if re.search(r"\boficio\s+de\s+respuesta\b", texto, re.I):
        puntaje_respuesta += 40
    if re.search(r"\boficio\s+de\s+salida\b", texto, re.I):
        puntaje_respuesta += 35
    if re.search(r"\bdando\s+respuesta\b", texto, re.I):
        puntaje_respuesta += 35
    if re.search(r"\bdando\s+cumplimiento\b", texto, re.I):
        puntaje_respuesta += 30
    if re.search(r"\bcomunicaci[oó]n\s+oficial\s+de\s+respuesta\b", texto, re.I):
        puntaje_respuesta += 40
    if re.search(r"\bme\s+permito\s+(?:dar|informar|comunicar)\b", texto, re.I):
        puntaje_respuesta += 20
    if re.search(r"\bref(?:erencia)?\s*[:.]\s*radicado\b", texto, re.I):
        puntaje_respuesta += 25
    if re.search(r"\bOficio\s+(?:No\.?|N[°º])\s*[A-Z0-9\-/]{3,}", texto, re.I):
        puntaje_respuesta += 30

    # Acuasan como REMITENTE (el que envía = el que responde)
    if (re.search(r"ACUASAN|ACUEDUCTO[\s,].*ALCANTARILLADO", texto, re.I)
            and re.search(r"\bAtentamente\b|\bCordialmente\b|\bRespetuosamente\b", texto, re.I)):
        # Tiene membrete de Acuasan Y cierre formal de carta = salida de Acuasan
        puntaje_respuesta += 35

    # ── Señales FUERTES de Radicado de Entrada (recibido por Acuasan) ──────
    # El sello de ventanilla física es la evidencia más fuerte
    if re.search(r"\bRemitente\s*:", texto, re.I):
        puntaje_radicado += 40
    if re.search(r"\bDestinatari[ao]\s*:", texto, re.I):
        puntaje_radicado += 30
    if re.search(r"\bRadicado\s+No\.?\s*:", texto, re.I):
        puntaje_radicado += 25
    if re.search(r"\bFolios?\s*:", texto, re.I):
        puntaje_radicado += 20
    if re.search(r"\bAnexos?\s*:", texto, re.I):
        puntaje_radicado += 15

    # Acuasan como DESTINATARIO (le están escribiendo A Acuasan)
    if re.search(r"Se[nñ]ores?\s*[:\s]+.*ACUASAN|Se[nñ]ores?\s*[:\s]+.*ACUEDUCTO", texto, re.I):
        puntaje_radicado += 35
    if re.search(r"(?:GERENTE|PRESIDENTE|REPRESENTANTE)\s+(?:GENERAL\s+)?DE[\s,].*ACUASAN", texto_upper, re.I):
        puntaje_radicado += 30

    # El peticionario ES la persona que escribe a Acuasan (no hay membrete de
    # salida de Acuasan)
    if (re.search(r"\bSolicito\b|\bSolicitud\b|\bPetici[oó]n\b", texto, re.I)
            and not re.search(r"ACUASAN", texto[:300], re.I)):
        puntaje_radicado += 20

    # Sello físico de Acuasan en documento recibido:
    # año + código de barras + fecha + EMPRESA DE ACUEDUCTO
    if (re.search(r"EMPRESA\s+DE\s+ACUEDUCTO.*ALCANTARILLADO.*ASEO", texto, re.I)
            and re.search(r"Remitente\s*:", texto, re.I)):
        puntaje_radicado += 45

    # ── Señales débiles pero útiles ────────────────────────────────────────
    if re.search(r"\bAcci[oó]n\s+de\s+tutela\b", texto, re.I):
        puntaje_radicado += 10
    if re.search(r"\bPQRS?\b", texto, re.I):
        puntaje_radicado += 10
    if re.search(r"\bDerecho\s+de\s+petici[oó]n\b", texto, re.I):
        puntaje_radicado += 10
    if re.search(r"\bOficio\b", texto, re.I) and puntaje_respuesta == 0:
        puntaje_respuesta += 5

    # Desempate: si los dos quedan en 0, es un Radicado (es lo más común)
    es_respuesta = puntaje_respuesta > puntaje_radicado
    confianza = abs(puntaje_respuesta - puntaje_radicado)
    return {
        "tipo": "RESPUESTA" if es_respuesta else "RADICADO",
        "confianza": confianza,
        "puntajeRadicado": puntaje_radicado,
        "puntajeRespuesta": puntaje_respuesta,
    }
