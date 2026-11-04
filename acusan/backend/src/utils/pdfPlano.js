// ── PDF plano de una página, armado en código ────────────────────────────────
// Genera un PDF mínimo VÁLIDO con offsets reales de xref: cualquier visor lo
// abre. Lo usan el seed (adjuntos de ejemplo) y la importación de Excel
// (placeholder del PDF de radicado, que gerencia reemplaza luego con el
// oficial vía POST /:id/pdf/radicado).

export function pdfUnaPagina(titulo, lineas = []) {
  const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const textos = [
    { t: titulo, f: 16 },
    ...lineas.map((l) => ({ t: l, f: 11 })),
  ]
  const contenido = textos
    .map(({ t, f }, i) => `BT /F1 ${f} Tf 60 ${770 - i * 22} Td (${escape(t)}) Tj ET`)
    .join('\n')
  const stream = Buffer.from(contenido, 'latin1')

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objetos.forEach((cuerpo, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
