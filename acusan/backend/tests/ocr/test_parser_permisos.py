# -*- coding: utf-8 -*-
"""Corpus del parser de permisos — porte de parserPermisosOcr.test.mjs (49/49).

Convención del expect (idéntica al corpus JS):
  · cadena  → el campo debe ser exactamente esa cadena
  · ''      → el campo DEBE quedar vacío (regla de oro: nada inventado)
  · AUSENTE → el campo debe ser falso o no estar (banderas técnicas)
"""

import os
import sys

# Asegurar importación de acuusan_ocr desde acusan/backend
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import pytest

from acuusan_ocr.parser_permisos import (
    completar_campos_faltantes,
    evaluar_campos_extraidos,
    extraer_rango_horario,
    parsear_texto_permiso,
)

AUSENTE = object()


def _casos():
    return [
        {
            "nombre": "1. Formato oficial limpio con columnas (doble espacio)",
            "texto": "\n".join([
                "ACUASAN E.S.P.",
                "SOLICITUD DE PERMISO LABORAL",
                "NOMBRE COMPLETO:  MARIA FERNANDA GOMEZ  CEDULA: 1.098.765.432",
                "CARGO: Auxiliar Administrativo  AREA: Administrativa",
                "FECHA: 18-08-2026  HORA: 7:30 a 9:30 a.m.",
                "MOTIVO: Cita médica general EPS",
                "TIPO DE PERMISO: Cita Médica",
            ]),
            "expect": {
                "nombreFuncionario": "MARIA FERNANDA GOMEZ",
                "cedula": "1098765432",
                "cargo": "Auxiliar Administrativo",
                "dependencia": "Administrativa",
                "fechaInicio": "18/08/2026",
                "horaInicio": "07:30",
                "horaFin": "09:30",
                "tipoPermiso": "Cita Médica",
                "motivo": "Cita médica general EPS",
            },
        },
        {
            "nombre": "2. Letra borrosa: etiquetas con dígitos (N0MBRE C0MPLET0, CEDU1A, H0RA)",
            "texto": "\n".join([
                "S0L1C1TUD DE PERMISO — ACUASAN",
                "N0MBRE C0MPLET0: MAR1A FERNANDA G0MEZ",
                "CEDU1A: 1.098.765.432",
                "H0RA: 7:30 a 9:30 am",
                "FECHA: 18-08-2026",
                "MOTIVO: Cita medica general",
            ]),
            "expect": {
                "nombreFuncionario": "MARIA FERNANDA GOMEZ",
                "cedula": "1098765432",
                "fechaInicio": "18/08/2026",
                "horaInicio": "07:30",
                "horaFin": "09:30",
                "tipoPermiso": "Cita Médica",
            },
        },
        {
            "nombre": "3. Orden médica EPS sin formulario (Paciente, sin horas)",
            "texto": "\n".join([
                "ORDEN DE SERVICIOS MEDICOS",
                "EPS SANITAS S.A.S.",
                "Paciente: GOMEZ RUIZ MARIA FERNANDA",
                "ID: 1.098.765.432",
                "Fecha de asignación: 12-08-2026",
                "Especialidad: Medicina General",
            ]),
            "expect": {
                "nombreFuncionario": "GOMEZ RUIZ MARIA FERNANDA",
                "cedula": "1098765432",
                "fechaInicio": "12/08/2026",
                "horaInicio": "",   # la orden no trae horario: campo vacío
                "horaFin": "",
                "tipoPermiso": "Cita Médica",
                "motivo": "",       # sin MOTIVO rotulado ni frase resaltable: vacío
            },
        },
        {
            "nombre": "4. Compensatorio electoral con certificado E-18 y jornada completa",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: CARLOS ARTURO ROJAS  CEDULA: 52.444.987",
                "MOTIVO: [X] Compensatorio por jurado de votación - certificado E-18 Registraduría",
                "FECHA: 30 de agosto de 2026",
                "HORA: jornada completa [X]",
            ]),
            "expect": {
                "nombreFuncionario": "CARLOS ARTURO ROJAS",
                "cedula": "52444987",
                "fechaInicio": "30/08/2026",
                "horaInicio": "07:30",
                "horaFin": "18:00",
                "tipoPermiso": "Compensatorio",
                "jornadaCompleta": True,
            },
        },
        {
            "nombre": "5. NIT del membrete no es cédula (cédula rotulada sí)",
            "texto": "\n".join([
                "ACUASAN E.S.P. NIT 68.679.000",
                "SOLICITUD DE PERMISO",
                "NOMBRE COMPLETO: PEDRO PABLO MONTAÑEZ",
                "CEDULA: 79.456.123",
                "FECHA: 20/08/2026",
            ]),
            "expect": {
                "nombreFuncionario": "PEDRO PABLO MONTAÑEZ",
                "cedula": "79456123",   # jamás '68679000'
                "fechaInicio": "20/08/2026",
            },
        },
        {
            "nombre": '6. "del 8 al 10 de agosto" son días, no horas',
            "texto": "\n".join([
                "PERMISO del 8 al 10 de agosto de 2026",
                "NOMBRE: LUISA MARTINEZ",
            ]),
            "expect": {
                "fechaInicio": "10/08/2026",
                "horaInicio": "",
                "horaFin": "",
            },
        },
        {
            "nombre": "7. FECHA 01-12-2026 no produce rango 01:00-12:00",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: ANA RIOS",
                "FECHA: 01-12-2026",
            ]),
            "expect": {
                "fechaInicio": "01/12/2026",
                "horaInicio": "",
                "horaFin": "",
            },
        },
        {
            "nombre": "8. Rango con p.m. en ambos extremos",
            "texto": "HORA: 2:00 p.m. a 4:00 p.m.",
            "expect": {"horaInicio": "14:00", "horaFin": "16:00"},
        },
        {
            "nombre": '9. "de 8 a 12 m." (mediodía)',
            "texto": "HORA: de 8 a 12 m.",
            "expect": {"horaInicio": "08:00", "horaFin": "12:00"},
        },
        {
            "nombre": '10. "11 a.m. a 1" cruza el mediodía',
            "texto": "HORA: 11 a.m. a 1",
            "expect": {"horaInicio": "11:00", "horaFin": "13:00"},
        },
        {
            "nombre": '11. "1 a 2" pelado (numeración) no es horario',
            "texto": "Página 1 a 2 del manual de convivencia",
            "expect": {"horaInicio": "", "horaFin": ""},
        },
        {
            "nombre": "12. Casilla JORNADA COMPLETA marcada",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: JORGE ELIECER CANTILLO  CEDULA: 8.765.432",
                "FECHA: 21/08/2026",
                "JORNADA COMPLETA [X]",
            ]),
            "expect": {
                "fechaInicio": "21/08/2026",
                "horaInicio": "07:30",
                "horaFin": "18:00",
                "jornadaCompleta": True,
            },
        },
        {
            "nombre": '13. "por 8 horas" del boilerplate NO es jornada completa',
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: ROSA JULIA PATERNINA",
                "FECHA: 19/08/2026",
                "El presente permiso se concede por 8 horas de la jornada.",
            ]),
            "expect": {
                "fechaInicio": "19/08/2026",
                "horaInicio": "",
                "horaFin": "",
                "jornadaCompleta": AUSENTE,
            },
        },
        {
            "nombre": "14. Año de dos dígitos se completa (18/08/26)",
            "texto": "FECHA: 18/08/26",
            "expect": {"fechaInicio": "18/08/2026"},
        },
        {
            "nombre": "15. 31/02/2026 no existe: fecha vacía",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: MIGUEL ANGEL TORRES",
                "FECHA: 31/02/2026",
            ]),
            "expect": {"fechaInicio": ""},
        },
        {
            "nombre": "16. Área explícita no se re-mapea por el diccionario de cargos",
            "texto": "CARGO: Fontanero  AREA: Distribución y Redes",
            "expect": {
                "cargo": "Fontanero",
                "dependencia": "Distribución y Redes",   # NO 'Alcantarillado'
            },
        },
        {
            "nombre": '17. Motivo manuscrito "c/ta médica"',
            "texto": "\n".join([
                "PERMISO ESCANEADO",
                "c/ta médica del 25 de agosto",
            ]),
            "expect": {"motivo": "c/ta médica del 25 de agosto"},
        },
        {
            "nombre": "18. Plan B: ENTRADA/SALIDA separadas",
            "texto": "ENTRADA: 8:00  SALIDA: 12:00",
            "expect": {"horaInicio": "08:00", "horaFin": "12:00"},
        },
        {
            "nombre": "19. TIPO DE PERMISO rotulado con valor que las keywords no ven",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO LABORAL",
                "NOMBRE: SANDRA MILENA RUEDA",
                "TIPO DE PERMISO: Estudio",
            ]),
            "expect": {
                "nombreFuncionario": "SANDRA MILENA RUEDA",
                "tipoPermiso": "Estudio / Capacitación",
            },
        },
        {
            "nombre": "20. TIPO DE PERMISO: Calamidad Doméstica (rotulado y keyword)",
            "texto": "\n".join([
                "NOMBRE: CAMILO ANDRES NIÑO",
                "TIPO DE PERMISO: Calamidad Doméstica",
                "FECHA: 30/10/2026",
            ]),
            "expect": {
                "fechaInicio": "30/10/2026",
                "tipoPermiso": "Calamidad Doméstica",
            },
        },
        {
            "nombre": "21. TIPO DE PERMISO: Estudio/Capacitacion (sin tildes, con barra)",
            "texto": "\n".join([
                "NOMBRE: DIANA PATRICIA SOTO",
                "TIPO DE PERMISO: Estudio/Capacitacion",
                "FECHA: 05/11/2026",
            ]),
            "expect": {
                "fechaInicio": "05/11/2026",
                "tipoPermiso": "Estudio / Capacitación",
            },
        },
        {
            "nombre": '22. Meridianos literales: "2:00 de la tarde a 4:00 de la tarde"',
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: PEDRO ALFONSO MORA",
                "FECHA: 25/09/2026",
                "HORA: 2:00 de la tarde a 4:00 de la tarde",
            ]),
            "expect": {
                "fechaInicio": "25/09/2026",
                "horaInicio": "14:00",
                "horaFin": "16:00",
            },
        },
        {
            "nombre": "23. Etiqueta DESCRIPCION como rótulo del motivo",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: LAURA VARGAS",
                "DESCRIPCION: cita control medico",
            ]),
            "expect": {
                "nombreFuncionario": "LAURA VARGAS",
                "tipoPermiso": "Cita Médica",
                "motivo": "cita control medico",
            },
        },
        {
            "nombre": "24. Columna rota: valor del CARGO en la línea siguiente",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: JUAN DAVID AVENDAÑO",
                "CARGO:",
                "Auxiliar Administrativo",
            ]),
            "expect": {
                "nombreFuncionario": "JUAN DAVID AVENDAÑO",
                "cargo": "Auxiliar Administrativo",
                "dependencia": "Administrativa",
            },
        },
        {
            "nombre": '25. Mes truncado por el OCR: "18 de novbre de 2026"',
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: MIGUEL ESPITIA",
                "FECHA: 18 de novbre de 2026",
            ]),
            "expect": {
                "nombreFuncionario": "MIGUEL ESPITIA",
                "fechaInicio": "18/11/2026",
            },
        },
        {
            "nombre": '26. Rótulo extendido del área: "ÁREA A LA QUE PERTENECE:"',
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: MARTA LUCIA ARDILA",
                "CARGO: Analista de Facturación",
                "ÁREA A LA QUE PERTENECE: Comercial y Facturación",
            ]),
            "expect": {
                "nombreFuncionario": "MARTA LUCIA ARDILA",
                "dependencia": "Comercial y Facturación",
            },
        },
        {
            "nombre": "27. Etiqueta OFICINA: (plan B, exige dos puntos)",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: HERNAN DARIO CUELLAR",
                "OFICINA: Potabilización",
            ]),
            "expect": {
                "nombreFuncionario": "HERNAN DARIO CUELLAR",
                "dependencia": "Potabilización",
            },
        },
        {
            "nombre": '28. Membrete "GERENCIA GENERAL" (sin dos puntos) no siembra el área',
            "texto": "\n".join([
                "ACUASAN E.S.P.",
                "GERENCIA GENERAL",
                "SOLICITUD DE PERMISO",
                "NOMBRE: RIGOBERTO PARRA",
            ]),
            "expect": {
                "nombreFuncionario": "RIGOBERTO PARRA",
                "dependencia": "",
            },
        },
        {
            "nombre": "29. Plan B horas: HORA DE INICIO/FINALIZACIÓN con a.m./p.m.",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: YEIMI ALEXANDRA MENDOZA",
                "HORA DE INICIO: 8:00 AM",
                "HORA DE FINALIZACIÓN: 12:00 PM",
            ]),
            "expect": {
                "nombreFuncionario": "YEIMI ALEXANDRA MENDOZA",
                "horaInicio": "08:00",
                "horaFin": "12:00",
            },
        },
        {
            "nombre": '30. "desde las 2:00 p.m. hasta las 4:00 p.m." (artículos "las")',
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: SANDRA PATRICIA QUINTERO",
                "FECHA: 03/10/2026",
                "El permiso se disfrutará desde las 2:00 p.m. hasta las 4:00 p.m.",
            ]),
            "expect": {
                "fechaInicio": "03/10/2026",
                "horaInicio": "14:00",
                "horaFin": "16:00",
            },
        },
        {
            "nombre": '31. "de 8:00 a 12:00 horas" (unidad suelta al final)',
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: CARLOS ANDRES PICO",
                "HORA: de 8:00 a 12:00 horas",
            ]),
            "expect": {
                "nombreFuncionario": "CARLOS ANDRES PICO",
                "horaInicio": "08:00",
                "horaFin": "12:00",
            },
        },
        {
            "nombre": "32. Plan B con meridianos que cruzan el mediodía (11 a.m. → 1 p.m.)",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: FABIO ALBERTO NIEVES",
                "INICIO: 11:00 a.m.  FIN: 1:00 p.m.",
            ]),
            "expect": {
                "nombreFuncionario": "FABIO ALBERTO NIEVES",
                "horaInicio": "11:00",
                "horaFin": "13:00",
            },
        },
        {
            "nombre": "33. Columna rota: valor del ÁREA en la línea siguiente",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: GLADYS ESPERANZA DURAN",
                "ÁREA:",
                "Alcantarillado",
            ]),
            "expect": {
                "nombreFuncionario": "GLADYS ESPERANZA DURAN",
                "dependencia": "Alcantarillado",
            },
        },
        {
            "nombre": "34. Observaciones rotuladas: valor completo tras la etiqueta",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: LAURA MARTINEZ ROJAS",
                "OBSERVACIONES: Adjunta cita médica confirmada por la EPS",
                "FIRMA:",
            ]),
            "expect": {
                "nombreFuncionario": "LAURA MARTINEZ ROJAS",
                "observaciones": "Adjunta cita médica confirmada por la EPS",
            },
        },
        {
            "nombre": "35. Motivo y observaciones conviven: cada etiqueta corta la suya",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: ANA CECILIA TORRES",
                "MOTIVO: Cita de control con oftalmología",
                "OBSERVACIÓN: Debe portar lentes de seguridad al retornar",
            ]),
            "expect": {
                "motivo": "Cita de control con oftalmología",
                "observaciones": "Debe portar lentes de seguridad al retornar",
            },
        },
        {
            "nombre": "36. Sin caja de observaciones → campo vacío (regla de oro)",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: PEDRO ALONSO RINCON",
                "MOTIVO: cita médica general",
            ]),
            "expect": {
                "nombreFuncionario": "PEDRO ALONSO RINCON",
                "observaciones": "",
            },
        },
        {
            "nombre": "37. Caja VACÍA antes de las firmas: 'FIRMA DEL' no es observación",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: MARIA ELENA PARRA",
                "MOTIVO: cita medica EPS",
                "OBSERVACIONES:",
                "FIRMA DEL SOLICITANTE",
                "FIRMA DEL JEFE INMEDIATO",
            ]),
            "expect": {
                "nombreFuncionario": "MARIA ELENA PARRA",
                "observaciones": "",
            },
        },
        {
            "nombre": "38. Rótulo compuesto DEL JEFE: absorbe el complemento (el valor corta en palabra-etiqueta PERMISO, como todos los campos)",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE:JORGE ENRIQUE SALAZAR",
                "MOTIVO: calamidad domestica",
                "OBSERVACIONES DEL JEFE: Se autoriza el permiso solicitado",
                "FIRMA:",
            ]),
            "expect": {
                "observaciones": "Se autoriza el",
            },
        },
        {
            "nombre": "39. 'observación' en prosa sin rótulo no contamina el campo",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: CAMILO ANDRES OJEDA",
                "MOTIVO: permiso personal",
                "Cualquier observacion comuniquese con Talento Humano.",
                "Documento diligenciado en tinta",
            ]),
            "expect": {
                "observaciones": "",
            },
        },
        {
            "nombre": "40. Valor con línea manuscrita ('______') interna se conserva limpio",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO",
                "NOMBRE: ROSA JULIA FUENTES",
                "OBSERVACIONES: Se aprueba con goce de ______ sueldo",
            ]),
            "expect": {
                "observaciones": "Se aprueba con goce de sueldo",
            },
        },
        {
            "nombre": "41. Bloque de firmas leído como nombre: rótulos no son persona → fallback al archivo",
            "texto": "\n".join([
                "SOLICITUD DE PERMISO LABORAL",
                "NOMBRE: La Mon D Ca counal ¡O CARGO: Aux A d Lun",
                "FECHA PERMISO: 03-07 - 2026",
                "SOLICITANTE",
                "FIRMA JEFE INMEDIATO",
                "FIRMA DIRECTORA ADMINISTRATIVA",
            ]),
            "archivo": "PERMISO RAMON DONATO CARDENAS RODRIGUEZ20260803.pdf",
            "expect": {
                # 'FIRMA JEFE INMEDIATO' (y 'IRMA JEFE…RMA DIRECTORA…') deben caer
                # por el guardia de rótulos; el nombre real llega del archivo.
                "nombreFuncionario": "RAMON DONATO CARDENAS RODRIGUEZ",
                "observaciones": "",
            },
        },
        {
            "nombre": "42. Membrete 'DEPARTAMENTO DE SANTANDER' (sin dos puntos) no siembra dependencia",
            "texto": "\n".join([
                "REPUBLICA DE COLOMBIA",
                "DEPARTAMENTO DE SANTANDER",
                "SOLICITUD DE PERMISO",
                "NOMBRE: RIGOBERTO PARRA",
            ]),
            "expect": {
                "nombreFuncionario": "RIGOBERTO PARRA",
                "dependencia": "",
            },
        },
        {
            "nombre": "43. 'CC 91071263 58 Años': la edad pegada no es parte de la cédula",
            "texto": "\n".join([
                "ORDEN DE REMISION",
                "RAMON DONATO CARDENAS CC 91071263 58 Años COTIZANTE 268 1",
            ]),
            "expect": {
                "cedula": "91071263",   # jamás '9107126358'
            },
        },
        {
            "nombre": "44. Membrete 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO, ASEO' no siembra cargo",
            "texto": "\n".join([
                "EMPRESA DE ACUEDUCTO, ALCANTARILLADO, ASEO Y GESTION ENERGETICA",
                "DE ALUMBRADO PUBLICO DE SAN GIL",
                "SOLICITUD DE PERMISO",
                "NOMBRE: PEDRO ALONSO RINCON",
                "FECHA: 12/08/2026",
            ]),
            "expect": {
                "nombreFuncionario": "PEDRO ALONSO RINCON",
                "fechaInicio": "12/08/2026",
                "cargo": "",   # el alcantarillado del membrete no es el oficio del solicitante
            },
        },
    ]


CASOS_RANGO = [
    ("7:30 a 9:30 a.m.", "07:30", "09:30"),
    ("2:00 p.m. a 4:00 p.m.", "14:00", "16:00"),
    ("de 8 a 12 m.", "08:00", "12:00"),
    ("11 a.m. a 1 p.m.", "11:00", "13:00"),
    ("11 a.m. a 1", "11:00", "13:00"),
    ("07:30-18:00", "07:30", "18:00"),
    ("2:00 de la tarde a 4:00 de la tarde", "14:00", "16:00"),
    ("desde las 2:00 p.m. hasta las 4:00 p.m.", "14:00", "16:00"),
    ("de 8:00 a 12:00 horas", "08:00", "12:00"),
    ("desde las 8 hasta las 12", "08:00", "12:00"),
    ("Página 1 a 2", None, None),
    ("01-12-2026", None, None),
    ("del 8 al 10 de agosto de 2026", None, None),
    ("", None, None),
]


@pytest.mark.parametrize("caso", _casos(), ids=lambda c: c["nombre"])
def test_documento_completo(caso):
    campos = parsear_texto_permiso(caso["texto"], caso.get("archivo", ""), caso["texto"])
    for campo, esperado in caso["expect"].items():
        obtenido = campos.get(campo)
        if esperado == "":
            # La cadena vacía exige campo vacío: la regla de oro del OCR
            assert not obtenido, f"{campo}: DEBÍA estar vacío y salió {obtenido!r}"
        elif esperado is AUSENTE:
            assert not obtenido, f"{campo}: DEBÍA ser falso/ausente y salió {obtenido!r}"
        else:
            assert obtenido == esperado, f"{campo}: esperado {esperado!r}, obtenido {obtenido!r}"


@pytest.mark.parametrize("texto,ini,fin", CASOS_RANGO, ids=[c[0] or "vacío" for c in CASOS_RANGO])
def test_rango_horario(texto, ini, fin):
    r = extraer_rango_horario(texto)
    obtenido_ini = r["horaInicio"] if r else None
    obtenido_fin = r["horaFin"] if r else None
    assert obtenido_ini == ini and obtenido_fin == fin, (
        f"esperado {ini}–{fin}, obtenido {obtenido_ini}–{obtenido_fin}"
    )


def test_cobertura_completa_confianza_100():
    completo = evaluar_campos_extraidos({
        "nombreFuncionario": "X", "cedula": "1", "cargo": "X", "dependencia": "X",
        "fechaInicio": "01/01/2026", "horaInicio": "08:00", "horaFin": "10:00",
        "tipoPermiso": "Personal", "motivo": "X", "observaciones": "X",
    })
    assert completo["faltantes"] == []
    assert completo["confianza"] == 100


def test_cobertura_parcial_2_de_10():
    parcial = evaluar_campos_extraidos({"nombreFuncionario": "X", "cedula": "1"})
    assert parcial["confianza"] == 20
    assert len(parcial["faltantes"]) == 8
    assert "Cargo" in parcial["faltantes"]
    assert "Motivo y Justificación" in parcial["faltantes"]
    assert "Observaciones" in parcial["faltantes"]


def test_completar_campos_faltantes_llena_solo_vacios():
    """Contrato del refuerzo: los llenos quedan INTACTOS, los vacíos se llenan,
    y un valor vacío del refuerzo no cuenta ni pisa nada."""
    base = {"nombreFuncionario": "MARIA GOMEZ", "cedula": "", "tipoPermiso": "Personal"}
    refuerzo = {
        "nombreFuncionario": "OTRA PERSONA",      # debe NO pisar el lleno
        "cedula": "1098765432",                   # vacío → se llena
        "cargo": "",                              # vacío del refuerzo: no entra
        "horaInicio": "14:00",                    # nuevo: entra
        "horaFin": None,                          # None: no entra
    }
    finales = completar_campos_faltantes(base, refuerzo)
    assert finales["nombreFuncionario"] == "MARIA GOMEZ"
    assert finales["cedula"] == "1098765432"
    assert finales["tipoPermiso"] == "Personal"
    assert finales["horaInicio"] == "14:00"
    assert not finales.get("cargo")
    assert not finales.get("horaFin")
    # La base original no se muta
    assert base["cedula"] == ""


def test_completar_campos_faltantes_entradas_nulas():
    assert completar_campos_faltantes(None, None) == {}
    assert completar_campos_faltantes({"cargo": "Fontanero"}, None)["cargo"] == "Fontanero"
    assert "cedula" not in completar_campos_faltantes(None, {"cedula": "1"}) or \
        completar_campos_faltantes(None, {"cedula": "1"})["cedula"] == "1"
