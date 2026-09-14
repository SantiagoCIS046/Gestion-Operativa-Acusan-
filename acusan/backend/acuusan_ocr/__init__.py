# -*- coding: utf-8 -*-
"""acuusan_ocr — Motores de extracción de campos a partir de documentos escaneados.

Porte a Python (desacoplado del navegador) de los parsers JS de Permisos y
Radicados. REGLA DE ORO compartida: el dato sale del documento o el campo
queda vacío; jamás se inventa contenido que el PDF no respalde.
"""

__all__ = ["parser_permisos", "parser_radicados", "deteccion_documental", "extraction", "server"]
