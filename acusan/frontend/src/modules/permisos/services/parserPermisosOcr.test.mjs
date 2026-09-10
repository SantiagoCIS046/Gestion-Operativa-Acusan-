/**
 * parserPermisosOcr.test.mjs — Corpus de documentos de prueba para el motor OCR
 * ─────────────────────────────────────────────────────────────────────────────
 * Corpus Node puro (mismo paquete "type": "module" del frontend): cada caso es
 * el texto tal como sale del OCR (pdfjs digital o Tesseract con letra borrosa)
 * y el resultado EXACTO que deben tener los campos. La convención del `expect`:
 *   · cadena  → el campo debe ser exactamente esa cadena
 *   · ''      → el campo DEBE quedar vacío (la regla de oro: nada inventado)
 * Los casos cubren las 9 áreas del formulario del Encargado, los formatos
 * reales de Acuasan (membrete con NIT, casillas, columnas con doble espacio) y
 * las trampas típicas del escaneo (fechas leídas como horas, página como
 * rango, NIT del membrete como cédula, letra borrosa 0↔O / 1↔I).
 *
 * Ejecutar:  node parserPermisosOcr.test.mjs   (desde este directorio)
 */

import {
  parsearTextoPermiso,
  extraerRangoHorario,
  evaluarCamposExtraidos
} from './parserPermisosOcr.js'

// ─── Casos del corpus ────────────────────────────────────────────────────────

const CASOS = [
  {
    nombre: '1. Formato oficial limpio con columnas (doble espacio)',
    texto: [
      'ACUASAN E.S.P.',
      'SOLICITUD DE PERMISO LABORAL',
      'NOMBRE COMPLETO:  MARIA FERNANDA GOMEZ  CEDULA: 1.098.765.432',
      'CARGO: Auxiliar Administrativo  AREA: Administrativa',
      'FECHA: 18-08-2026  HORA: 7:30 a 9:30 a.m.',
      'MOTIVO: Cita médica general EPS',
      'TIPO DE PERMISO: Cita Médica'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'MARIA FERNANDA GOMEZ',
      cedula: '1098765432',
      cargo: 'Auxiliar Administrativo',
      dependencia: 'Administrativa',
      fechaInicio: '18/08/2026',
      horaInicio: '07:30',
      horaFin: '09:30',
      tipoPermiso: 'Cita Médica',
      motivo: 'Cita médica general EPS'
    }
  },
  {
    nombre: '2. Letra borrosa: etiquetas con dígitos (N0MBRE C0MPLET0, CEDU1A, H0RA)',
    texto: [
      'S0L1C1TUD DE PERMISO — ACUASAN',
      'N0MBRE C0MPLET0: MAR1A FERNANDA G0MEZ',
      'CEDU1A: 1.098.765.432',
      'H0RA: 7:30 a 9:30 am',
      'FECHA: 18-08-2026',
      'MOTIVO: Cita medica general'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'MARIA FERNANDA GOMEZ',
      cedula: '1098765432',
      fechaInicio: '18/08/2026',
      horaInicio: '07:30',
      horaFin: '09:30',
      tipoPermiso: 'Cita Médica'
    }
  },
  {
    nombre: '3. Orden médica EPS sin formulario (Paciente, sin horas)',
    texto: [
      'ORDEN DE SERVICIOS MEDICOS',
      'EPS SANITAS S.A.S.',
      'Paciente: GOMEZ RUIZ MARIA FERNANDA',
      'ID: 1.098.765.432',
      'Fecha de asignación: 12-08-2026',
      'Especialidad: Medicina General'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'GOMEZ RUIZ MARIA FERNANDA',
      cedula: '1098765432',
      fechaInicio: '12/08/2026',
      horaInicio: '',   // la orden no trae horario: campo vacío
      horaFin: '',
      tipoPermiso: 'Cita Médica',
      motivo: ''        // sin MOTIVO rotulado ni frase resaltable: vacío
    }
  },
  {
    nombre: '4. Compensatorio electoral con certificado E-18 y jornada completa',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: CARLOS ARTURO ROJAS  CEDULA: 52.444.987',
      'MOTIVO: [X] Compensatorio por jurado de votación - certificado E-18 Registraduría',
      'FECHA: 30 de agosto de 2026',
      'HORA: jornada completa [X]'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'CARLOS ARTURO ROJAS',
      cedula: '52444987',
      fechaInicio: '30/08/2026',
      horaInicio: '07:30',
      horaFin: '18:00',
      tipoPermiso: 'Compensatorio',
      jornadaCompleta: true
    }
  },
  {
    nombre: '5. NIT del membrete no es cédula (cédula rotulada sí)',
    texto: [
      'ACUASAN E.S.P. NIT 68.679.000',
      'SOLICITUD DE PERMISO',
      'NOMBRE COMPLETO: PEDRO PABLO MONTAÑEZ',
      'CEDULA: 79.456.123',
      'FECHA: 20/08/2026'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'PEDRO PABLO MONTAÑEZ',
      cedula: '79456123',   // jamás '68679000'
      fechaInicio: '20/08/2026'
    }
  },
  {
    nombre: '6. "del 8 al 10 de agosto" son días, no horas',
    texto: [
      'PERMISO del 8 al 10 de agosto de 2026',
      'NOMBRE: LUISA MARTINEZ'
    ].join('\n'),
    expect: {
      fechaInicio: '10/08/2026',
      horaInicio: '',
      horaFin: ''
    }
  },
  {
    nombre: '7. FECHA 01-12-2026 no produce rango 01:00-12:00',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: ANA RIOS',
      'FECHA: 01-12-2026'
    ].join('\n'),
    expect: {
      fechaInicio: '01/12/2026',
      horaInicio: '',
      horaFin: ''
    }
  },
  {
    nombre: '8. Rango con p.m. en ambos extremos',
    texto: 'HORA: 2:00 p.m. a 4:00 p.m.',
    expect: { horaInicio: '14:00', horaFin: '16:00' }
  },
  {
    nombre: '9. "de 8 a 12 m." (mediodía)',
    texto: 'HORA: de 8 a 12 m.',
    expect: { horaInicio: '08:00', horaFin: '12:00' }
  },
  {
    nombre: '10. "11 a.m. a 1" cruza el mediodía',
    texto: 'HORA: 11 a.m. a 1',
    expect: { horaInicio: '11:00', horaFin: '13:00' }
  },
  {
    nombre: '11. "1 a 2" pelado (numeración) no es horario',
    texto: 'Página 1 a 2 del manual de convivencia',
    expect: { horaInicio: '', horaFin: '' }
  },
  {
    nombre: '12. Casilla JORNADA COMPLETA marcada',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: JORGE ELIECER CANTILLO  CEDULA: 8.765.432',
      'FECHA: 21/08/2026',
      'JORNADA COMPLETA [X]'
    ].join('\n'),
    expect: {
      fechaInicio: '21/08/2026',
      horaInicio: '07:30',
      horaFin: '18:00',
      jornadaCompleta: true
    }
  },
  {
    nombre: '13. "por 8 horas" del boilerplate NO es jornada completa',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: ROSA JULIA PATERNINA',
      'FECHA: 19/08/2026',
      'El presente permiso se concede por 8 horas de la jornada.'
    ].join('\n'),
    expect: {
      fechaInicio: '19/08/2026',
      horaInicio: '',
      horaFin: '',
      jornadaCompleta: undefined
    }
  },
  {
    nombre: '14. Año de dos dígitos se completa (18/08/26)',
    texto: 'FECHA: 18/08/26',
    expect: { fechaInicio: '18/08/2026' }
  },
  {
    nombre: '15. 31/02/2026 no existe: fecha vacía',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: MIGUEL ANGEL TORRES',
      'FECHA: 31/02/2026'
    ].join('\n'),
    expect: { fechaInicio: '' }
  },
  {
    nombre: '16. Área explícita no se re-mapea por el diccionario de cargos',
    texto: 'CARGO: Fontanero  AREA: Distribución y Redes',
    expect: {
      cargo: 'Fontanero',
      dependencia: 'Distribución y Redes'   // NO 'Alcantarillado'
    }
  },
  {
    nombre: '17. Motivo manuscrito "c/ta médica"',
    texto: [
      'PERMISO ESCANEADO',
      'c/ta médica del 25 de agosto'
    ].join('\n'),
    expect: { motivo: 'c/ta médica del 25 de agosto' }
  },
  {
    nombre: '18. Plan B: ENTRADA/SALIDA separadas',
    texto: 'ENTRADA: 8:00  SALIDA: 12:00',
    expect: { horaInicio: '08:00', horaFin: '12:00' }
  },
  {
    nombre: '19. TIPO DE PERMISO rotulado con valor que las keywords no ven',
    texto: [
      'SOLICITUD DE PERMISO LABORAL',
      'NOMBRE: SANDRA MILENA RUEDA',
      'TIPO DE PERMISO: Estudio'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'SANDRA MILENA RUEDA',
      tipoPermiso: 'Estudio / Capacitación'
    }
  },
  {
    nombre: '20. TIPO DE PERMISO: Calamidad Doméstica (rotulado y keyword)',
    texto: [
      'NOMBRE: CAMILO ANDRES NIÑO',
      'TIPO DE PERMISO: Calamidad Doméstica',
      'FECHA: 30/10/2026'
    ].join('\n'),
    expect: {
      fechaInicio: '30/10/2026',
      tipoPermiso: 'Calamidad Doméstica'
    }
  },
  {
    nombre: '21. TIPO DE PERMISO: Estudio/Capacitacion (sin tildes, con barra)',
    texto: [
      'NOMBRE: DIANA PATRICIA SOTO',
      'TIPO DE PERMISO: Estudio/Capacitacion',
      'FECHA: 05/11/2026'
    ].join('\n'),
    expect: {
      fechaInicio: '05/11/2026',
      tipoPermiso: 'Estudio / Capacitación'
    }
  },
  {
    nombre: '22. Meridianos literales: "2:00 de la tarde a 4:00 de la tarde"',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: PEDRO ALFONSO MORA',
      'FECHA: 25/09/2026',
      'HORA: 2:00 de la tarde a 4:00 de la tarde'
    ].join('\n'),
    expect: {
      fechaInicio: '25/09/2026',
      horaInicio: '14:00',
      horaFin: '16:00'
    }
  },
  {
    nombre: '23. Etiqueta DESCRIPCION como rótulo del motivo',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: LAURA VARGAS',
      'DESCRIPCION: cita control medico'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'LAURA VARGAS',
      tipoPermiso: 'Cita Médica',
      motivo: 'cita control medico'
    }
  },
  {
    nombre: '24. Columna rota: valor del CARGO en la línea siguiente',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: JUAN DAVID AVENDAÑO',
      'CARGO:',
      'Auxiliar Administrativo'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'JUAN DAVID AVENDAÑO',
      cargo: 'Auxiliar Administrativo',
      dependencia: 'Administrativa'
    }
  },
  {
    nombre: '25. Mes truncado por el OCR: "18 de novbre de 2026"',
    texto: [
      'SOLICITUD DE PERMISO',
      'NOMBRE: MIGUEL ESPITIA',
      'FECHA: 18 de novbre de 2026'
    ].join('\n'),
    expect: {
      nombreFuncionario: 'MIGUEL ESPITIA',
      fechaInicio: '18/11/2026'
    }
  }
]

// ─── Casos unitarios de extraerRangoHorario ─────────────────────────────────

const CASOS_RANGO = [
  ['7:30 a 9:30 a.m.', '07:30', '09:30'],
  ['2:00 p.m. a 4:00 p.m.', '14:00', '16:00'],
  ['de 8 a 12 m.', '08:00', '12:00'],
  ['11 a.m. a 1 p.m.', '11:00', '13:00'],
  ['11 a.m. a 1', '11:00', '13:00'],
  ['07:30-18:00', '07:30', '18:00'],
  ['2:00 de la tarde a 4:00 de la tarde', '14:00', '16:00'],
  ['Página 1 a 2', null, null],
  ['01-12-2026', null, null],
  ['del 8 al 10 de agosto de 2026', null, null],
  ['', null, null]
]

// ─── Runner ──────────────────────────────────────────────────────────────────

const FORMATOS_FALLAS = []
let pasaron = 0
let fallaron = 0

const evaluar = (nombre, obtenido, esperado) => {
  let ok = true
  const detalles = []
  for (const [campo, valorEsperado] of Object.entries(esperado)) {
    const valorObtenido = obtenido[campo]
    if (valorEsperado === '') {
      // La cadena vacía exige campo vacío: la regla de oro del OCR
      if (valorObtenido) {
        ok = false
        detalles.push(`  ✗ ${campo}: DEBÍA estar vacío y salió "${valorObtenido}"`)
      }
    } else if (valorEsperado === undefined) {
      if (valorObtenido !== undefined && valorObtenido !== false) {
        ok = false
        detalles.push(`  ✗ ${campo}: DEBÍA ser falso/undefined y salió "${valorObtenido}"`)
      }
    } else if (String(valorObtenido) !== String(valorEsperado)) {
      ok = false
      detalles.push(`  ✗ ${campo}: esperado "${valorEsperado}", obtenido "${valorObtenido}"`)
    }
  }
  if (ok) {
    pasaron++
    console.log(`  ✔ ${nombre}`)
  } else {
    fallaron++
    FORMATOS_FALLAS.push(nombre)
    console.log(`  ✘ ${nombre}`)
    for (const d of detalles) console.log(d)
  }
}

console.log('════════════════════════════════════════════════════════════════')
console.log('CORPUS parserPermisosOcr — textos como salen del OCR real')
console.log('════════════════════════════════════════════════════════════════\n')

console.log('── Documentos completos (parsearTextoPermiso) ──')
for (const caso of CASOS) {
  const campos = parsearTextoPermiso(caso.texto, '', caso.texto)
  evaluar(caso.nombre, campos, caso.expect)
}

console.log('\n── Rangos horarios aislados (extraerRangoHorario) ──')
for (const [texto, ini, fin] of CASOS_RANGO) {
  const r = extraerRangoHorario(texto)
  const ok = (r ? r.horaInicio : null) === ini && (r ? r.horaFin : null) === fin
  if (ok) {
    pasaron++
    console.log(`  ✔ "${texto}" → ${ini ?? '∅'}–${fin ?? '∅'}`)
  } else {
    fallaron++
    FORMATOS_FALLAS.push(`rango "${texto}"`)
    console.log(`  ✘ "${texto}" → esperado ${ini ?? '∅'}–${fin ?? '∅'}, obtenido ${r ? r.horaInicio + '–' + r.horaFin : '∅'}`)
  }
}

console.log('\n── Cobertura de las 9 áreas (evaluarCamposExtraidos) ──')
{
  const completo = evaluarCamposExtraidos({
    nombreFuncionario: 'X', cedula: '1', cargo: 'X', dependencia: 'X',
    fechaInicio: '01/01/2026', horaInicio: '08:00', horaFin: '10:00',
    tipoPermiso: 'Personal', motivo: 'X'
  })
  const ok1 = completo.faltantes.length === 0 && completo.confianza === 100
  if (ok1) { pasaron++; console.log('  ✔ completo → confianza 100, sin faltantes') }
  else { fallaron++; FORMATOS_FALLAS.push('evaluarCamposExtraidos completo'); console.log(`  ✘ completo → ${JSON.stringify(completo)}`) }

  const parcial = evaluarCamposExtraidos({ nombreFuncionario: 'X', cedula: '1' })
  const ok2 = parcial.confianza === 22 && parcial.faltantes.length === 7 &&
    parcial.faltantes.includes('Cargo') && parcial.faltantes.includes('Motivo y Justificación')
  if (ok2) { pasaron++; console.log('  ✔ parcial (2/9) → confianza 22 con 7 faltantes') }
  else { fallaron++; FORMATOS_FALLAS.push('evaluarCamposExtraidos parcial'); console.log(`  ✘ parcial → ${JSON.stringify(parcial)}`) }
}

console.log('\n════════════════════════════════════════════════════════════════')
console.log(`RESULTADO: ${pasaron} pasan · ${fallaron} fallan`)
if (fallaron) {
  console.log('\nCasos fallidos:')
  for (const f of FORMATOS_FALLAS) console.log(`  · ${f}`)
  process.exit(1)
}
console.log('REGLA DE ORO VERIFICADA: ningún campo inventado, vacío donde el PDF no respalda.')
process.exit(0)
