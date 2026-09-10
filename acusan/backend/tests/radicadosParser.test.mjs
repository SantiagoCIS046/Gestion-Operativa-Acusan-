/**
 * radicadosParser.test.mjs — Corpus de documentos de prueba para el parser de radicados
 * ─────────────────────────────────────────────────────────────────────────────
 * Corpus Node puro (backend es "type": "module"): cada caso es el texto tal como
 * sale del OCR del navegador (pdfjs digital o Tesseract con letra borrosa) y el
 * resultado EXACTO que deben tener los campos del parser del BACKEND
 * (RadicadosService.extraerCampos / extraerCamposRespuesta). La convención del
 * `expect` es la del corpus de permisos:
 *   · cadena  → el campo debe ser exactamente esa cadena
 *   · ''      → el campo DEBE quedar vacío (la regla de oro: nada inventado)
 *
 * OJO: RadicadosService importa Prisma al cargar; no se hace ninguna consulta
 * en los métodos de parsing (son puros), pero la construcción del cliente exige
 * DATABASE_URL — se fija una dummy ANTES del import dinámico.
 *
 * Este archivo vive FUERA de los módulos congelados (locks de protección) para
 * poder crecer sin llaves: es la red de seguridad de regresión del parser.
 *
 * Ejecutar:  cd acusan/backend && node tests/radicadosParser.test.mjs
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/prueba-parser'

const { RadicadosService } = await import('../src/modules/radicados/radicados.service.js')

const NOMBRE_INSTITUCIONAL = 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.'

// ─── Radicados de ENTRADA (extraerCampos) ────────────────────────────────────

const CASOS_ENTRADA = [
  {
    nombre: 'E1. Sello SIGOB completo (radicado, fecha, hora, dependencia, remitente)',
    texto: [
      'REPUBLICA DE COLOMBIA',
      'Radicado No.: 2610000736 Folios: 1',
      'FECHA: 14/08/2026',
      'Hora: 4:06 PM',
      'Dependencia: EMPRESA DE ACUEDUCTO ALCANTARILLADO Y ASEO DE SAN GIL ACUASAN',
      'Remitente: PEREZ GOMEZ JOSE',
      'Destinataria: 940 - RUIZ SUAREZ LUZ MARINA',
      'Anexos: 0',
      'Asunto: Solicitud de revisión de facturación'
    ].join('\n'),
    expect: {
      numeroRadicadoPdf: '2610000736',
      fechaDocumento: '14/08/2026 — 4:06 PM',
      lugarFecha: '',
      peticionario: 'Pérez Gómez José',
      dependencia: NOMBRE_INSTITUCIONAL,
      destinatario: 'Ruiz Suárez Luz Marina',
      referencia: '940',
      asunto: 'Solicitud de Revisión de Facturación',
      diasParaVencer: null
    }
  },
  {
    nombre: 'E2. Carta particular con "Yo, identificada con C.C." y bloque Señores',
    texto: [
      'San Gil, 12 de agosto de 2026',
      '',
      'SEÑORES:',
      'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL ACUASAN E.S.P.',
      'GERENTE GENERAL',
      '',
      'Me dirijo a ustedes para solicitar la revisión de mi factura',
      'correspondiente al mes de julio de 2026.',
      '',
      'Yo, ANA MARIA RIOS, identificada con C.C. 42.657.890.',
      '',
      'Atentamente,',
      '',
      'ANA MARIA RIOS',
      'C.C. 42.657.890'
    ].join('\n'),
    expect: {
      numeroRadicadoPdf: '',
      lugarFecha: 'San Gil, 12 de agosto de 2026',
      fechaDocumento: '12 de agosto de 2026',
      dependencia: NOMBRE_INSTITUCIONAL,
      peticionario: 'Ana María Ríos',
      destinatario: 'Empresa de Acueducto, Alcantarillado y Aseo de San Gil ACUASAN E.S.P. - Gerente General',
      asunto: '',
      contexto: 'Me dirijo a ustedes para solicitar la revisión de mi factura correspondiente al mes de julio de 2026. Yo, ANA MARIA RIOS, identificada con C.C. 42.657.890.',
      // "Me dirijo" (verbo de petición en primera persona) → petición general: 15 días
      diasParaVencer: 15
    }
  },
  {
    nombre: 'E3. Tutela → término fijo de 3 días (Ley 1755/2015 y Decreto 2591)',
    texto: [
      'ACCION DE TUTELA',
      'San Gil, 10 de agosto de 2026',
      '',
      'SEÑOR',
      'JUEZ PENAL DEL CIRCUITO',
      '',
      'Acción de tutela contra ACUASAN por suspensión del servicio.',
      'El accionante solicita amparo de sus derechos fundamentales.'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 10 de agosto de 2026',
      fechaDocumento: '10 de agosto de 2026',
      dependencia: NOMBRE_INSTITUCIONAL,
      diasParaVencer: 3
    }
  },
  {
    nombre: 'E4. Plazo declarado en el documento: "dentro de los quince (15) días"',
    texto: [
      'San Gil, 2 de enero de 2026',
      '',
      'Por medio de la presente solicito se me responda dentro de los quince (15) días hábiles.'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 2 de enero de 2026',
      peticionario: '',
      diasParaVencer: 15
    }
  },
  {
    nombre: 'E5. Petición general por verbo en primera persona ("Solicito…") → 15 días',
    texto: [
      'San Gil, 3 de marzo de 2026',
      '',
      'Señores',
      'ACUASAN',
      '',
      'Solicito amablemente la conexión del servicio de acueducto.'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 3 de marzo de 2026',
      peticionario: '',
      diasParaVencer: 15
    }
  },
  {
    nombre: 'E6. Peticionario ilegible → campo vacío (regla de oro)',
    texto: [
      'San Gil, 5 de mayo de 2026',
      '',
      'SEÑORES:',
      'EMPRESA DE ACUEDUCTO ALCANTARILLADO Y ASEO DE SAN GIL ACUASAN',
      '',
      'Por medio de la presente solicito la revisión del servicio de acueducto.',
      'Sin otro particular,'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 5 de mayo de 2026',
      peticionario: '',
      // "Por medio de la presente" → petición general: 15 días
      diasParaVencer: 15
    }
  },
  {
    nombre: 'E7. Solicitud de información → 10 días (art. 14, Ley 1755/2015)',
    texto: [
      'San Gil, 8 de abril de 2026',
      '',
      'Señores',
      'ACUASAN',
      '',
      'Solicito amablemente información sobre el estado de mi contrato de acueducto.'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 8 de abril de 2026',
      fechaDocumento: '8 de abril de 2026',
      dependencia: NOMBRE_INSTITUCIONAL,
      peticionario: '',
      tipoPeticion: 'Información / Documentos',
      diasParaVencer: 10
    }
  },
  {
    nombre: 'E8. Queja → 15 días (arts. 21-22, Ley 1755/2015)',
    texto: [
      'San Gil, 9 de abril de 2026',
      '',
      'Señores',
      'ACUASAN',
      '',
      'Presento queja por el cobro repetido de la factura de marzo.'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 9 de abril de 2026',
      fechaDocumento: '9 de abril de 2026',
      dependencia: NOMBRE_INSTITUCIONAL,
      peticionario: '',
      tipoPeticion: 'Consulta / Queja / Reclamo',
      diasParaVencer: 15
    }
  },
  {
    nombre: 'E9. Petición general ("pido") sin señal de información ni queja → 15 días',
    texto: [
      'San Gil, 10 de abril de 2026',
      '',
      'Señores',
      'ACUASAN',
      '',
      'Respetuosamente pido la revisión de las obras del acueducto veredal.'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 10 de abril de 2026',
      fechaDocumento: '10 de abril de 2026',
      dependencia: NOMBRE_INSTITUCIONAL,
      peticionario: '',
      tipoPeticion: 'Petición General',
      diasParaVencer: 15
    }
  },
  {
    nombre: 'E10. Fórmula SUSCRITA: con corte por "mayor de edad" → peticionario',
    texto: [
      'San Gil, 12 de agosto de 2026',
      '',
      'SUSCRITA:',
      'MARIA FERNANDA GOMEZ PEREZ, mayor de edad, identificada con C.C. 65.876.543,',
      'presento petición para la revisión del cobro del mes de junio.'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 12 de agosto de 2026',
      peticionario: 'María Fernanda Gómez Pérez'
    }
  },
  {
    nombre: 'E11. Firma final: el nombre solo aparece tras "Atentamente,"',
    texto: [
      'San Gil, 20 de agosto de 2026',
      '',
      'Señores',
      'ACUASAN E.S.P.',
      '',
      'Solicito la reconexión del servicio de mi residencia.',
      '',
      'Atentamente,',
      '',
      'LUZ MARINA RUIZ SUAREZ',
      'C.C. 43.210.987'
    ].join('\n'),
    expect: {
      lugarFecha: 'San Gil, 20 de agosto de 2026',
      fechaDocumento: '20 de agosto de 2026',
      peticionario: 'Luz Marina Ruiz Suárez',
      diasParaVencer: 15
    }
  },
  {
    nombre: 'E12. Lugar de la Provincia Comunera: "Valle de San José, …"',
    texto: [
      'Valle de San José, 15 de septiembre de 2026',
      '',
      'Señores',
      'ACUASAN',
      '',
      'Solicito información sobre los proyectos de acueducto del municipio.'
    ].join('\n'),
    expect: {
      lugarFecha: 'Valle de San José, 15 de septiembre de 2026',
      fechaDocumento: '15 de septiembre de 2026',
      dependencia: NOMBRE_INSTITUCIONAL,
      tipoPeticion: 'Información / Documentos',
      diasParaVencer: 10
    }
  }
]

// ─── Oficios de RESPUESTA (extraerCamposRespuesta) ───────────────────────────

const CASOS_RESPUESTA = [
  {
    nombre: 'R1. Oficio completo: código, radicado padre, lugar/fecha, doctor, asunto y firma',
    texto: [
      'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.',
      'NIT 686.790.009-1',
      'CÓDIGO: 940-CE-236-2026',
      '',
      'San Gil, 16 de junio de 2026',
      '',
      'Respuesta a Radicado No.: 2610000736',
      '',
      'Doctor',
      'JOSE PEREZ GOMEZ',
      '',
      'Asunto: Respuesta a solicitud de revisión de facturación',
      '',
      'En atención a su solicitud, me permito informar que el proceso',
      'de revisión fue aprobado.',
      '',
      'Atentamente,',
      '',
      'WBEIMAR HERNANDO PEREZ BELTRAN',
      'Gerente General'
    ].join('\n'),
    expect: {
      radicadoReferencia: '2610000736',
      numeroOficio: '940-CE-236-2026',
      lugarFecha: 'San Gil, 16 de junio de 2026',
      fechaDocumento: '16 de junio de 2026',
      destinatario: 'José Pérez Gómez',
      asunto: 'Respuesta a Solicitud de Revisión de Facturación',
      firmante: 'Wbeimar Hernando Pérez Beltrán - Gerente General'
    }
  },
  {
    nombre: 'R2. Oficio sin código: fallback al radicado del sticker; firma ilegible',
    texto: [
      'EMPRESA DE ACUEDUCTO Y ASEO DE SAN GIL ACUASAN',
      'NIT 686.790.009-1',
      '',
      '16 de septiembre de 2026',
      '',
      'Respuesta a Radicado No.: 2620000123',
      '',
      'Asunto: Constancia de no cobro',
      '',
      'Cordialmente,',
      '',
      '(firma ilegible)'
    ].join('\n'),
    expect: {
      radicadoReferencia: '2620000123',
      numeroOficio: '2620000123',
      lugarFecha: '',
      fechaDocumento: '16 de septiembre de 2026',
      asunto: 'Constancia de No Cobro',
      firmante: ''   // "(firma ilegible)": regla de oro, no se adivina
    }
  },
  {
    nombre: 'R3. Oficio con serie clásica OF-AAAA-NNN y fecha mes-primero',
    texto: [
      'EMPRESA DE ACUEDUCTO Y ASEO DE SAN GIL ACUASAN',
      'Oficio No. OF-2026-104',
      '',
      'Bogotá, junio 16 de 2026',
      '',
      'En respuesta al radicado No. 2610000736 me permito informar',
      'que la solicitud fue atendida.',
      '',
      'Atentamente,',
      '',
      'WBEIMAR HERNANDO PEREZ BELTRAN',
      'Gerente General'
    ].join('\n'),
    expect: {
      radicadoReferencia: '2610000736',
      numeroOficio: 'OF-2026-104',
      lugarFecha: 'Bogotá, junio 16 de 2026',
      fechaDocumento: '16 de junio de 2026',
      firmante: 'Wbeimar Hernando Pérez Beltrán - Gerente General'
    }
  },
  {
    nombre: 'R4. Etiqueta explícita "Firmante:" con nombre y cargo en el valor',
    texto: [
      'EMPRESA DE ACUEDUCTO Y ASEO DE SAN GIL ACUASAN',
      'Oficio No. OF-2026-105',
      '',
      'San Gil, 20 de enero de 2026',
      '',
      'Asunto: Certificación de deuda',
      '',
      'Cordial saludo.',
      '',
      'Se expide la presente certificación a solicitud del interesado.',
      '',
      'Firmante: Wbeimar Perez Beltran - Gerente General'
    ].join('\n'),
    expect: {
      numeroOficio: 'OF-2026-105',
      lugarFecha: 'San Gil, 20 de enero de 2026',
      fechaDocumento: '20 de enero de 2026',
      asunto: 'Certificación de Deuda',
      firmante: 'Wbeimar Pérez Beltrán - Gerente General'
    }
  }
]

// ─── Casos unitarios de _inferirDias ─────────────────────────────────────────

const CASOS_DIAS = [
  ['Responder dentro de los quince (15) días', 15],
  ['con un término de diez (10) días', 10],
  ['plazo de 3 días', 3],
  ['ACCIÓN DE TUTELA', 3],
  ['Sin ninguna señal de plazo', null],
  // Clasificación textual (Ley 1755/2015) sin plazo declarado:
  ['Solicito información sobre el estado de mi contrato', 10],
  ['Se expide certificación de copias del expediente', 10],
  ['Presento queja formal por el cobro duplicado', 15],
  ['Respetuosamente pido la revisión del cobro', 15]
]

// ─── Runner ──────────────────────────────────────────────────────────────────

const FALLAS = []
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
    FALLAS.push(nombre)
    console.log(`  ✘ ${nombre}`)
    for (const d of detalles) console.log(d)
  }
}

console.log('════════════════════════════════════════════════════════════════')
console.log('CORPUS radicadosParser — textos como salen del OCR real')
console.log('════════════════════════════════════════════════════════════════\n')

console.log('── Radicados de entrada (extraerCampos) ──')
for (const caso of CASOS_ENTRADA) {
  evaluar(caso.nombre, RadicadosService.extraerCampos(caso.texto), caso.expect)
}

console.log('\n── Oficios de respuesta (extraerCamposRespuesta) ──')
for (const caso of CASOS_RESPUESTA) {
  evaluar(caso.nombre, RadicadosService.extraerCamposRespuesta(caso.texto), caso.expect)
}

console.log('\n── Términos legales (_inferirDias) ──')
for (const [texto, esperado] of CASOS_DIAS) {
  const obtenido = RadicadosService._inferirDias(texto)
  if (obtenido === esperado) {
    pasaron++
    console.log(`  ✔ "${texto}" → ${esperado ?? 'null'}`)
  } else {
    fallaron++
    FALLAS.push(`_inferirDias "${texto}"`)
    console.log(`  ✘ "${texto}" → esperado ${esperado ?? 'null'}, obtenido ${obtenido}`)
  }
}

console.log('\n════════════════════════════════════════════════════════════════')
console.log(`RESULTADO: ${pasaron} pasan · ${fallaron} fallan`)
if (fallaron) {
  console.log('\nCasos fallidos:')
  for (const f of FALLAS) console.log(`  · ${f}`)
  process.exit(1)
}
console.log('REGLA DE ORO VERIFICADA: ningún campo inventado, vacío donde el documento no respalda.')
process.exit(0)
