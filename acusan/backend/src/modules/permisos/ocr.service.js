/**
 * ocr.service.js — Servicio OCR para permisos laborales (Backend Node.js)
 * Extrae los 9 campos del formulario de cualquier PDF o imagen de permiso.
 *
 * Pipeline:
 *   PDF digital  → pdf-parse extrae el texto en ms (sin OCR)
 *   PDF escaneado / imagen → Tesseract.js en Node lee el texto
 *   El texto se parsea con las mismas reglas del frontend (parserPermisosOcr.js)
 */

import path from 'path'
import { fileURLToPath } from 'url'
import logger from '../../config/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Buffer helpers ──────────────────────────────────────────────────────────

const base64ABuffer = (dataUrl) => {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  return Buffer.from(b64, 'base64')
}

const mimeDeDataUrl = (dataUrl) => {
  const m = /^data:([^;,]+)[;,]/.exec(dataUrl || '')
  return m ? m[1].toLowerCase() : ''
}

// ─── Extracción de texto de PDF digital ─────────────────────────────────────

const extraerTextoPdfDigital = async (buffer) => {
  try {
    const { default: pdfParse } = await import('pdf-parse')
    const data = await pdfParse(buffer)
    return (data && data.text) ? data.text : ''
  } catch (e) {
    try {
      // Ruta alternativa que algunos entornos necesitan
      const mod = await import('pdf-parse/lib/pdf-parse.js')
      const fn = mod.default || mod
      const data = await fn(buffer)
      return (data && data.text) ? data.text : ''
    } catch (e2) {
      logger.warn('OCR', 'pdf-parse', `No disponible: ${e2.message}`)
      return ''
    }
  }
}

// ─── Tesseract OCR ───────────────────────────────────────────────────────────

let _worker = null

const obtenerWorker = async () => {
  if (_worker) return _worker
  try {
    const { createWorker } = await import('tesseract.js')
    const langPath = path.resolve(__dirname, '..', '..', '..') // carpeta raíz del backend
    const worker = await createWorker('spa', '1', {
      logger: () => {},
      langPath,
      gzip: false
    })
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    })
    _worker = worker
    return worker
  } catch (e) {
    logger.warn('OCR', 'Tesseract init', e.message)
    return null
  }
}

const mejorarImagen = async (buf) => {
  try {
    const { default: sharp } = await import('sharp')
    return await sharp(buf).greyscale().normalize().sharpen({ sigma: 1.5 }).toBuffer()
  } catch {
    return buf
  }
}

const ejecutarTesseract = async (imagenBuf) => {
  try {
    const worker = await obtenerWorker()
    if (!worker) return ''
    const mejorado = await mejorarImagen(imagenBuf)
    const { data } = await worker.recognize(mejorado)
    return data ? (data.text || '') : ''
  } catch (e) {
    logger.warn('OCR', 'Tesseract recognize', e.message)
    return ''
  }
}

// ─── PARSER DE CAMPOS (idéntico al parserPermisosOcr.js del frontend) ────────

const MESES = {
  enero:1,ene:1,febrero:2,feb:2,marzo:3,mar:3,abril:4,abr:4,mayo:5,may:5,
  junio:6,jun:6,julio:7,jul:7,agosto:8,ago:8,agos:8,agto:8,agost:8,qgosto:8,
  septiembre:9,setiembre:9,sep:9,sept:9,octubre:10,oct:10,
  noviembre:11,nov:11,diciembre:12,dic:12
}
const MESES_NOM = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const normTx = (t) => (t||'')
  .replace(/\r\n?/g,'\n').replace(/\t/g,' ')
  .replace(/[ ]{3,}/g,'  ').replace(/[ ]+\n/g,'\n').replace(/\n[ ]+/g,'\n')
  .replace(/[–—‒]/g,'-')
  .replace(/(\d)O(\d)/g,'$10$2').replace(/O(\d{1,2}[\/\-.])/g,'0$1')
  .replace(/(\d)l(\d)/g,'$11$2')
  .replace(/(\d{1,2})[.\-\/]\s+(\d{1,2})/g,'$1-$2')

const desOcrEtiquetas = (t) => (t||'').replace(
  /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,15}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,15}){0,2}(?=\s*:)/g,
  s => s.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]{3,15}/g, tok => {
    const letras = tok.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'')
    if (letras.length < 3 || !/[0-9]/.test(tok)) return tok
    return tok.replace(/0/g,'O').replace(/1/g,'I').replace(/5/g,'S').replace(/8/g,'B').replace(/6/g,'G')
  })
)

const prepTexto = (t) => desOcrEtiquetas(normTx(t))

const numMes = (p) => {
  const s = String(p||'').toLowerCase().replace(/[^a-záéíóúñ]/g,'')
  if (!s) return null
  for (const [k,v] of Object.entries(MESES)) if (s.startsWith(k)||k.startsWith(s)) return v
  return null
}

const esFechaReal = (dd,mm,aa) => {
  const d=parseInt(dd,10),m=parseInt(mm,10),a=parseInt(aa,10)
  if (!d||!m||!a||d<1||m<1||m>12) return false
  const f=new Date(a,m-1,d)
  return f.getDate()===d&&f.getMonth()===m-1&&f.getFullYear()===a
}

const recolFechas = (txt, esPag1=false) => {
  const fechas=[]
  const R1=/\b([0-3]?\d)\s+de\s+([a-záéíóúñ]{3,12})(?:\s+de|\s+del\s+a[nñ]o|\s+de\s+)?\s*(\d{4})\b/gi
  const R2=/\b([0-3]?\d)\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})\b/g
  const anclar = (m,dd,mm,aa,tipo) => {
    const anio=aa.length===2?`20${aa}`:aa
    const mes=tipo==='txt'?numMes(mm):parseInt(mm,10)
    if (!mes) return
    if (!esFechaReal(dd,String(mes).padStart(2,'0'),anio)) return
    const ctx=txt.slice(Math.max(0,m.index-22),m.index)
    const rot=/fecha|permiso|solicitud/i.test(ctx)
    fechas.push({dd:String(parseInt(dd,10)).padStart(2,'0'),mm:String(mes).padStart(2,'0'),aa:anio,idx:m.index,rot,p1:esPag1,tipo})
  }
  for (const m of txt.matchAll(R1)) anclar(m,m[1],m[2],m[3],'txt')
  for (const m of txt.matchAll(R2)) anclar(m,m[1],m[2],m[3],'num')
  return fechas
}

const elegirFecha = (fs) => {
  if (!fs.length) return null
  const con=fs.map(f=>({...f,pt:(f.rot?3:0)+(f.p1?2:0)+(f.tipo==='txt'?1:0)}))
  con.sort((a,b)=>b.pt-a.pt||a.idx-b.idx)
  return con[0]
}

const hhmm=(h,min)=>`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
const hval=(h,min)=>h>=0&&h<=23&&min>=0&&min<=59

const a24=(h,mer)=>{
  const m=String(mer||'').toLowerCase().replace(/[\s.]/g,'')
  let hh=h
  if (m.startsWith('a')){if(hh===12)hh=0}
  else if(m.startsWith('p')){if(hh!==12)hh+=12}
  else if(m==='m'&&hh===12){hh=12}
  return hh
}

const extraerRango = (texto) => {
  if (!texto) return null
  const t=texto
    .replace(/(\d)\s+de\s+la\s+ma[nñ]ana\b/gi,'$1 a.m.')
    .replace(/(\d)\s+de\s+la\s+tarde\b/gi,'$1 p.m.')
    .replace(/(\d)\s+de\s+la\s+noche\b/gi,'$1 p.m.')

  const MES='(?:ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)'
  const RX=/(^|[^\w.,:\/-])\s*(?:desde\s+(?:la[s]?\s+)?|de\s+(?:la[s]?\s+)?)?(\\d{1,2})(?:[:.h](\\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?\s*(?:a\b|hasta(?:\s+la[s]?)?|al\b|-|–)\s*(?:la[s]?\s+)?(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?(?!\d)(?![.,]\d)(?!\s*[-\/\.]\s*\d)/gi

  // Usamos una versión simplificada del regex que funciona en Node
  const RX2 = /(^|[^\w.,:\/-])\s*(?:desde\s+(?:las?\s+)?|de\s+(?:las?\s+)?)?(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?\s*(?:a\b|hasta(?:\s+las?)?|al\b|-|–)\s*(?:las?\s+)?(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?(?!\d)(?![.,]\d)(?!\s*[-\/\.]\s*\d)/gi

  const cands=[]
  for (const m of t.matchAll(RX2)) {
    const h1=parseInt(m[2],10),min1=m[3]!==undefined?parseInt(m[3],10):0
    const h2=parseInt(m[5],10),min2=m[6]!==undefined?parseInt(m[6],10):0
    if (!hval(h1,min1)||!hval(h2,min2)) continue
    const posterior=t.slice(m.index+m[0].length,m.index+m[0].length+34)
    if (new RegExp(`^\\s*(?:de\\s+)?${MES}\\b`,'i').test(posterior)) continue
    const previo=t.slice(Math.max(0,m.index-14),m.index)
    if (/\b(?:del|d[ií]as?)$/i.test(previo)) continue
    const combos=[]
    if (m[4]&&m[7]) combos.push([m[4],m[7]])
    else if (m[4]) combos.push([m[4],m[4]],[m[4],'p.m.'],[m[4],null])
    else if (m[7]) combos.push([m[7],m[7]],['a.m.',m[7]],[null,m[7]])
    else combos.push([null,null])
    const rot=/hora|horario|entrada|salida|permiso/i.test(t.slice(Math.max(0,m.index-18),m.index))
    const tieneMins=m[3]!==undefined||m[6]!==undefined
    const tieneMer=Boolean(m[4]||m[7])
    if (!tieneMins&&!tieneMer&&!rot&&(h1<6||h2<6)) continue
    for (const [mer1,mer2] of combos) {
      const ini=a24(h1,mer1)*60+min1
      const fin=a24(h2,mer2)*60+min2
      if (fin<=ini) continue
      cands.push({horaInicio:hhmm(a24(h1,mer1),min1),horaFin:hhmm(a24(h2,mer2),min2),rot,idx:m.index})
      break
    }
  }
  if (cands.length) {
    cands.sort((a,b)=>(b.rot?1:0)-(a.rot?1:0)||a.idx-b.idx)
    return {horaInicio:cands[0].horaInicio,horaFin:cands[0].horaFin}
  }

  // Plan B: ENTRADA/INICIO y SALIDA/FIN separadas
  const mE=t.match(/\b(?:entr(?:ada|e)|inicio)\s*[:\-]?\s*(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?/i)
  const mS=t.match(/\b(?:salida|fin|finalizaci[oó]n)\s*[:\-]?\s*(\d{1,2})(?:[:.h](\d{2}))?\s*([ap]\.?\s*m\.?|m\.?)?/i)
  if (mE&&mS) {
    const h1=mE[3]?a24(parseInt(mE[1],10),mE[3]):parseInt(mE[1],10)
    const min1=mE[2]!==undefined?parseInt(mE[2],10):0
    const h2=mS[3]?a24(parseInt(mS[1],10),mS[3]):parseInt(mS[1],10)
    const min2=mS[2]!==undefined?parseInt(mS[2],10):0
    if (hval(h1,min1)&&hval(h2,min2)&&h2*60+min2>h1*60+min1)
      return {horaInicio:hhmm(h1,min1),horaFin:hhmm(h2,min2)}
  }
  return null
}

const limpiarNom = (r) => {
  if (!r) return ''
  return r
    .replace(/^PERMISO\s+/i,'').replace(/202[0-9]{5,}.*$/i,'').replace(/\.pdf$/i,'')
    .replace(/\b[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*[0156][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*\b/g,tok=>{
      const l=tok.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'')
      if (l.length<3) return tok
      return tok.replace(/0/g,'O').replace(/1/g,'I').replace(/5/g,'S').replace(/6/g,'G')
    })
    .replace(/[0-9_\-\.\:\;\,\(\)]+/g,' ').replace(/\s{2,}/g,' ').trim()
    .replace(/\b(?:PERMISO|ACUASAN|ESCANEO|SCAN|SOLICITUD|DOC)\b/gi,'')
    .replace(/\s{2,}/g,' ').trim().toUpperCase()
}

const mapTipo = (v) => {
  const s=String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()
  if (!s) return ''
  if (s.includes('compensatori')||s.includes('votacion')||s.includes('electoral')) return 'Compensatorio'
  if (s.includes('medic')||s.includes('salud')||s.includes('eps')) return 'Cita Médica'
  if (s.includes('calamidad')) return 'Calamidad Doméstica'
  if (s.includes('estudio')||s.includes('capacitacion')||s.includes('academ')) return 'Estudio / Capacitación'
  if (s.includes('personal')||s.includes('asunto')) return 'Personal'
  return ''
}

const EC = String.raw`(?:CEDULA|C[eÉ]DULA|C\.?\s?C\.?|DOCUMENTO|IDENTIFICACI[oÓ]N|NOMBRES?|APELLIDOS|CARGO|PUESTO|OFICIO|DEPENDENCIA|DEPARTAMENTO|[ÁA]REA|FECHA|HORA|ENTRADA|SALIDA|FIRMA|MOTIVO|JEFE|OBSERVACION|SOLICITANTE|Vo\.?\s?Bo\.?|PERMISO|TIPO)`

const parsearCampos = (textoCompleto, nombreArch='', textoPag1='') => {
  const texto = prepTexto(textoCompleto)
  const p1 = prepTexto(textoPag1 || textoCompleto)
  const c = {}

  // ═══ 1. NOMBRE ═══
  {
    const rx = new RegExp(
      String.raw`\b(?:NOMBRES?\s*(?:Y\s*APELLIDOS|COMPLETO|DEL\s*(?:TRABAJADOR|FUNCIONARIO|SOLICITANTE))?|TRABAJADOR|SOLICITANTE|FUNCIONARIO)\s*:?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9' ]{5,70}?)(?=\s{2,}|\s*\b${EC}\b|[.\n]|$)`,
      'i'
    )
    const m=(p1+'\n'+texto).match(rx)
    if (m) {
      const n=limpiarNom(m[1])
      if (n.length>=5&&n.split(' ').filter(Boolean).length>=2) c.nombreFuncionario=n
    }
  }
  if (!c.nombreFuncionario) {
    const m=texto.match(/(?:Paciente|PACIENTE|Usuario|Afiliado)[:\s]+([A-ZÁÉÍÓÚÑa-z\s]{6,55})(?=\s*ID|\s*CC|\s*Contrato|\s*Edad|\n|$)/i)
    if (m){const n=limpiarNom(m[1]);if(n.split(' ').filter(Boolean).length>=2)c.nombreFuncionario=n}
  }
  if (!c.nombreFuncionario&&nombreArch){
    const n=limpiarNom(nombreArch);if(n.split(' ').filter(Boolean).length>=2)c.nombreFuncionario=n
  }
  if (c.nombreFuncionario&&/\d/.test(c.nombreFuncionario)) delete c.nombreFuncionario

  // ═══ 2. CÉDULA ═══
  const EXC=['890120175','8901201757','68679000','1686790001']
  const ced_ok=(d)=>{
    if (!/^[0-9]{6,11}$/.test(d)) return false
    if (EXC.includes(d)) return false
    if (/^20(1[5-9]|2[0-9])$/.test(d)) return false
    if (/^20(1[5-9]|2[0-9])[0-9]{4}$/.test(d)) return false
    if (/^(30|31|32)[0-9]{8}$/.test(d)) return false
    return true
  }
  const ctx_emp=(p)=>/(nit|n\.?i\.?t|registro|empresa|acueducto|acuasan|e\.?s\.?p|tel[eé]fono)/i.test(p||'')
  const PAT_CC=[
    /\b(?:CEDULA|C[eÉ]DULA)\s*(?:DE\s*CIUDADANIA)?\s*[:\-]?\s*N?o?\.?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
    /\bC\.?\s?C\.?\s*(?:No\.?|#)?\s*[:\-]?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
    /\bdocumento\s*(?:No\.?|n[uú]mero|#)?\s*[:\-]?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
    /\bidentificad[oa]\s*(?:con)?\s*(?:el)?\s*(?:documento|c[eé]dula)?\s*(?:No\.?|#)?\s*([0-9][0-9\.,\s]{4,16}?)(?=[^\d\.,\s]|$)/gim,
  ]
  for (const rx of PAT_CC) {
    for (const m of texto.matchAll(rx)) {
      const d=(m[1]||'').trim().replace(/[^\d]/g,'')
      if (ced_ok(d)){c.cedula=d;break}
    }
    if (c.cedula) break
  }
  if (!c.cedula) {
    for (const m of texto.matchAll(/\b[0-9][0-9\.,]{5,14}\b/g)) {
      const d=(m[0]||'').replace(/[^\d]/g,'')
      const prev=texto.slice(Math.max(0,m.index-45),m.index)
      if (ced_ok(d)&&!ctx_emp(prev)){c.cedula=d;break}
    }
  }

  // ═══ 3. CARGO / 4. DEPENDENCIA ═══
  const rxV=(etqs)=>new RegExp(
    String.raw`\b(?:${etqs})\s*[:.\-]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\.\-/ ]{2,50}?)(?=\s{2,}|\s*\b${EC}\b\s*[:.\-]|[.\n]|$)`,
    'i'
  )

  // Cargo — busca en el texto completo y también un valor en la siguiente línea
  const mCargo=texto.match(rxV('CARGO|PUESTO|OFICIO|EMPLEO|OCUPACI[oÓ]N'))
  if (mCargo) {
    let v=mCargo[1].replace(/\s{2,}/g,' ').replace(/[\s\-.,:;]+$/,'').trim()
    // Si el valor extraído está vacío (columna rota), busca en la siguiente línea
    if (!v) {
      const posF=texto.indexOf(mCargo[0])
      const resto=texto.slice(posF+mCargo[0].length).trim()
      const primLin=resto.split('\n')[0].trim()
      if (primLin&&primLin.length>=3&&/^[A-ZÁÉÍÓÚÜÑ]/.test(primLin)) v=primLin
    }
    if (v&&v.length>=3) c.cargo=v
  }

  // Dependencia — rótulos extendidos
  const RELLENO=String.raw`(?:\s+(?:[ÁA]\s+LA\s+QUE\s+PERTENECE|DE\s+TRABAJO|SOLICITANTE|DONDE\s+LABORA|DE\s+LA\s+EMPRESA))*`
  const mDep=texto.match(new RegExp(
    String.raw`\b(?:DEPENDENCIA|DEPARTAMENTO|[ÁA]REA)${RELLENO}\s*[:.\-]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\.\-/ ]{2,50}?)(?=\s{2,}|\s*\b${EC}\b\s*[:.\-]|[.\n]|$)`,
    'i'
  ))
  let depL=mDep?mDep[1].replace(/\s{2,}/g,' ').replace(/[\s\-.,:;]+$/,'').trim():''
  depL=depL.replace(/^(?:[aá]\s+la\s+que\s+pertenece|de\s+trabajo|solicitante|donde\s+labora|de\s+la\s+empresa)\s+/i,'')
  // Columna rota: valor en la siguiente línea
  if (!depL&&mDep) {
    const posF=texto.indexOf(mDep[0])
    const resto=texto.slice(posF+mDep[0].length).trim()
    const primLin=resto.split('\n')[0].trim()
    if (primLin&&primLin.length>=3&&/^[A-ZÁÉÍÓÚÜÑ]/.test(primLin)) depL=primLin
  }
  if (!depL) {
    const mOf=texto.match(new RegExp(
      String.raw`\b(?:OFICINA|SECCI[oÓ]N|DIRECCI[oÓ]N|UNIDAD|GERENCIA|SUBGERENCIA|DIVISI[oÓ]N|PROCESO)\s*:\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\.\-/ ]{2,50}?)(?=\s{2,}|\s*\b${EC}\b\s*[:.\-]|[.\n]|$)`,
      'i'
    ))
    if (mOf) depL=mOf[1].replace(/\s{2,}/g,' ').replace(/[\s\-.,:;]+$/,'').trim()
  }
  if (depL&&/^[A-ZÁÉÍÓÚÜÑ0-9]/.test(depL)&&depL.length>=3) c.dependencia=depL

  // Fallback cargo/dependencia por palabras clave en el texto
  if (!c.cargo) {
    if (/potabiliz|planta\s+de\s+tratam/i.test(texto)) { c.cargo='Líder de Potabilización'; c.dependencia=c.dependencia||'Planta de Tratamiento / Potabilización' }
    else if (/fontan/i.test(texto)) { c.cargo='Fontanero'; c.dependencia=c.dependencia||'Distribución y Redes' }
    else if (/alcant/i.test(texto)) { c.cargo='Operario de Alcantarillado'; c.dependencia=c.dependencia||'Redes de Alcantarillado' }
    else if (/conduct/i.test(texto)) { c.cargo='Conductor Operativo'; c.dependencia=c.dependencia||'Transporte y Maquinaria' }
    else if (/analist/i.test(texto)) { c.cargo='Analista de Facturación y Cartera'; c.dependencia=c.dependencia||'Comercial y Facturación' }
    else if (/auxiliar/i.test(texto)) { c.cargo='Auxiliar Administrativo'; c.dependencia=c.dependencia||'Administrativa' }
  }

  // ═══ 5. FECHA ═══
  const fp1=recolFechas(p1,true)
  const ftodo=recolFechas(texto,false)
  const fe=elegirFecha([...fp1,...ftodo])
  if (fe) {
    c.fechaInicio=`${fe.dd}/${fe.mm}/${fe.aa}`
    c.fechaFin=c.fechaInicio
    c.fechaPermisoTexto=`${parseInt(fe.dd,10)} de ${MESES_NOM[parseInt(fe.mm,10)]} de ${fe.aa}`
  }

  // ═══ 6. HORAS ═══
  const rango=extraerRango(p1)||extraerRango(texto)
  const rxJornada=/jornada[^.\n]{0,30}[\[\(]?\s*[xX✓☑]\s*[\]\)]?|[\[\(]?\s*[xX✓☑]\s*[\]\)]?[^.\n]{0,30}jornada/i
  const hayMarcas=/\b07[:.]?30\b/.test(texto)&&/\b(?:17[:.]?30|18[:.]?00)\b/.test(texto)
  const evidJornada=rxJornada.test(texto)||hayMarcas
  if (rango) {
    c.horaInicio=rango.horaInicio; c.horaFin=rango.horaFin
    c.jornadaCompleta=rango.horaInicio==='07:30'&&(rango.horaFin==='18:00'||rango.horaFin==='17:30')
  } else if (evidJornada||/jornada\s+(?:laboral\s+)?completa|todo\s+el\s+d[ií]a/i.test(texto)) {
    c.horaInicio='07:30'; c.horaFin='18:00'; c.jornadaCompleta=true
  }

  // ═══ 7. TIPO DE PERMISO ═══
  let tipo=''
  if (/M[eé]dic[ao]\*?\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*M[eé]dic[ao]\*?/.test(p1)) tipo='Cita Médica'
  else if (/[Cc]ompensatori[ao]\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]ompensatori[ao]/.test(p1)) tipo='Compensatorio'
  else if (/[Pp]ersonal\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Pp]ersonal/.test(p1)) tipo='Personal'
  else if (/[Cc]alamidad\s*[\[\(]?[xX✓✗☑]\s*[\]\)]?|[\[\(]?[xX✓✗☑][\]\)]?\s*[Cc]alamidad/.test(p1)) tipo='Calamidad Doméstica'
  // Rótulo explícito "TIPO DE PERMISO: ..." o "TIPO: ..."
  if (!tipo) {
    const mT=texto.match(/\btipo(?:\s+de\s+permiso)?\s*[:\-]\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\/\s]{3,40})/i)
    if (mT) tipo=mapTipo(mT[1])
  }
  if (!tipo&&/permiso\s+personal|asunto\s+propio/i.test(texto)) tipo='Personal'
  if (!tipo) {
    if (/[Ee]studio|[Cc]apacitaci[oó]n\s*[\[\(]?[xX✓✗☑]/.test(p1)) tipo='Estudio / Capacitación'
  }
  if (!tipo) {
    const hM=/m[eé]dic[ao]|cita\s*m[eé]dic|eps|cardiolog|urolog|ortoped|remisi[oó]n|especialista|orden\s*m[eé]dic|diagn[oó]stico/i.test(texto)
    const hJ=/jurado|votaci[oó]n|electoral|registradur|jurament/i.test(texto)
    const hC=/calamidad|fallecimiento|inundaci[oó]n|accidente\s*familiar/i.test(texto)
    const hE=/universidad|capacitaci[oó]n|seminario|congreso|examen\s*acad[eé]mico/i.test(texto)
    if (hJ) tipo='Compensatorio'
    else if (hM) tipo='Cita Médica'
    else if (hC) tipo='Calamidad Doméstica'
    else if (hE) tipo='Estudio / Capacitación'
  }
  c.tipoPermiso=tipo


  // ═══ 8. MOTIVO ═══
  let mot=''
  const rxMot=new RegExp(
    String.raw`(?:MOTIVO|DESCRIPC[IÍ]ON(?:\s+DEL\s+MOTIVO)?|JUSTIFICACI[oÓ]N)[\s\:\*]*(?:Compensatorio|M[eé]dic[oa]\*?|Personal|Calamidad)?[\s\[\]\(\)\{\}xX✓✗☑☒☐\*]*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\/\s\,\.\-\(\)]{6,140}?)(?=\s{2,}|\s*\b${EC}\b\s*[:.\-]?|[.\n]|$)`,
    'i'
  )
  const mMot=p1.match(rxMot)
  if (mMot) {
    let t2=mMot[1].replace(/en caso de cita.*/i,'').replace(/\*en caso.*/i,'')
      .replace(/firma.*/i,'').replace(/solicitante.*/i,'').replace(/jefe.*/i,'')
      .replace(/observacion.*/i,'').replace(/dependencia.*/i,'').replace(/vo\.?\s?bo\..*/i,'')
      .replace(/[_|~]{2,}/g,' ').replace(/[\[\]\(\)\{\}]/g,' ').replace(/\b[xX✓✗☑☒☐]\b/g,' ')
    const rxR=/^(?:[^\wáéíóúñ]+|\b[a-záéíóúñ]{1,2}\b|\b\d{1,2}\b|\b(?:compensatorio|m[eé]dic[oa]\*?|calamidad|personal|estudio|capacitaci[oó]n)\b)\s*/i
    let estable=false; while(!estable){const r=t2.replace(rxR,'');estable=r===t2;t2=r}
    t2=t2.replace(/\s{2,}/g,' ').trim()
    if (t2.length>=5&&/[a-záéíóúñ]{3,}/i.test(t2)) mot=t2
  }
  if (!mot) {
    const mC=texto.match(/c[\/.]{1}?ta\s+m[eé]dic[oa][a-z0-9\s\/\,\.]{0,60}/i)
    if (mC) mot=mC[0].replace(/\s+/g,' ').trim()
  }
  if (!mot) {
    if (/registradur|jurament|jurado\s+de\s+votaci|electoral/i.test(texto))
      mot='Compensatorio por función electoral (certificado E-18 / Registraduría adjunto)'
    else if (/cardiolog/i.test(texto)) mot='Cita médica - Consulta especialista Cardiología'
    else if (/reclamar|medicam/i.test(texto)) mot='Cita médica - Reclamar medicamentos (EPS)'
  }
  c.motivo=mot; c.motivoManuscrito=mot

  return c
}

// ─── Evaluación de cobertura ─────────────────────────────────────────────────

const CAMPOS=[
  ['nombreFuncionario','Nombre Completo'],['cedula','Cédula'],['cargo','Cargo'],
  ['dependencia','Área / Dependencia'],['fechaInicio','Fecha'],
  ['horaInicio','Hora Inicio'],['horaFin','Hora Fin'],
  ['tipoPermiso','Tipo de Permiso'],['motivo','Motivo'],
]
const evalCampos=(c)=>{
  const falt=CAMPOS.filter(([k])=>!String(c[k]??'').trim()).map(([,e])=>e)
  return {faltantes:falt,confianza:Math.round(((CAMPOS.length-falt.length)/CAMPOS.length)*100)}
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

/**
 * Procesa un archivo Base64 (PDF o imagen) y devuelve los campos del permiso.
 */
export const procesarArchivoOCR = async (archivoBase64='', nombreArchivo='', mimeType='', texto='') => {
  // ── 1. MOTOR PRIMARIO EN PYTHON (acuusan_ocr / Flask port 5001) ─────────────
  try {
    const resPython = await fetch('http://127.0.0.1:5001/api/permisos/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivoBase64, nombreArchivo, mimeType, texto })
    })
    if (resPython.ok) {
      const dataPy = await resPython.json()
      if (dataPy.success && dataPy.campos) {
        logger.info('OCR', 'PYTHON ENGINE', `Éxito motor Python: ${dataPy.confianza}% confianza | Archivo: ${nombreArchivo}`)
        return dataPy
      }
    }
  } catch (errPy) {
    logger.warn('OCR', 'PYTHON ENGINE', `Servidor Python no disponible en puerto 5001 (${errPy.message}), usando fallback Node`)
  }

  // ── 2. FALLBACK EN NODE.JS ───────────────────────────────────────────────────
  const mime=mimeType||mimeDeDataUrl(archivoBase64)||''
  const esPdf=mime==='application/pdf'||(nombreArchivo||'').toLowerCase().endsWith('.pdf')
  const esImg=mime.startsWith('image/')||/\.(png|jpe?g|webp|gif|bmp)$/i.test(nombreArchivo||'')

  const buffer=base64ABuffer(archivoBase64)
  let textoCompleto=''
  let textoPag1=''

  if (esPdf) {
    logger.info('OCR','PDF',`Extrayendo: ${nombreArchivo}`)
    textoCompleto=await extraerTextoPdfDigital(buffer)
    // La primera "página" es el texto antes del primer salto de formulario
    textoPag1=textoCompleto.split(/\f/)[0]||textoCompleto
    logger.info('OCR','pdf-parse',`${textoCompleto.replace(/\s/g,'').length} chars útiles`)

    // Si el PDF es un escaneo (muy poco texto extraído) → Tesseract
    if (textoCompleto.replace(/\s/g,'').length<30) {
      logger.info('OCR','PDF escaneado','Activando Tesseract sobre el buffer del PDF')
      // Intentar renderizar con pdfjs en Node si está disponible
      try {
        const pdfjsLib=await import('pdfjs-dist/legacy/build/pdf.mjs')
        const { createCanvas }=await import('canvas')
        const task=pdfjsLib.getDocument({data:new Uint8Array(buffer)})
        const doc=await task.promise
        const page=await doc.getPage(1)
        const vp=page.getViewport({scale:3.0})
        const canvas=createCanvas(vp.width,vp.height)
        const ctx=canvas.getContext('2d')
        await page.render({canvasContext:ctx,viewport:vp}).promise
        const imgBuf=canvas.toBuffer('image/png')
        textoCompleto=await ejecutarTesseract(imgBuf)
        textoPag1=textoCompleto
        logger.info('OCR','pdfjs+Tesseract',`${textoCompleto.replace(/\s/g,'').length} chars`)
      } catch {
        // canvas no instalado — Tesseract directo sobre el buffer del PDF (puede funcionar)
        textoCompleto=await ejecutarTesseract(buffer)
        textoPag1=textoCompleto
        logger.info('OCR','Tesseract directo',`${textoCompleto.replace(/\s/g,'').length} chars`)
      }
    }
  } else if (esImg) {
    logger.info('OCR','Imagen',`Procesando: ${nombreArchivo}`)
    textoCompleto=await ejecutarTesseract(buffer)
    textoPag1=textoCompleto
  } else {
    // TXT / Word decodificado directamente
    try { textoCompleto=buffer.toString('utf-8'); textoPag1=textoCompleto } catch {}
  }

  const campos=parsearCampos(textoCompleto,nombreArchivo,textoPag1)
  const {faltantes,confianza}=evalCampos(campos)
  logger.info('OCR','Resultado',`${confianza}% — faltantes: ${faltantes.join(', ')||'ninguno'}`)

  return {campos,confianza,faltantes,textoExtraido:textoCompleto}
}
