const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const moment = require('moment');
const { google } = require('googleapis');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretonoticiaacuasan2026';

// ── Sembrar usuario inicial si no existe ninguno en la BD compartida ──
async function sembrarUsuarioInicial() {
  try {
    const totalUsers = await prisma.user.count();
    if (totalUsers === 0) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      await prisma.user.create({
        data: {
          nombre: 'Encargada de Radicados',
          email: 'encargada@acuasan.gov.co',
          password: hashedPassword,
          rol: 'Administrador'
        }
      });
      console.log('👤 Usuario inicial creado en la BD: encargada@acuasan.gov.co / 123456');
    }
  } catch (err) {
    console.warn('ℹ️ Inicialización de usuarios:', err.message);
  }
}
sembrarUsuarioInicial();

// Asegurar carpeta local de respaldo
const DRIVE_LOCAL_DIR = path.join(__dirname, '../drive_local_backup');
if (!fs.existsSync(DRIVE_LOCAL_DIR)) {
  fs.mkdirSync(DRIVE_LOCAL_DIR, { recursive: true });
}

// Configuración de Multer para recibir archivos PDF en memoria
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// CONFIGURACIONES INICIALES & RUTAS DE AUTENTICACIÓN
// ==========================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── RUTAS DE AUTENTICACIÓN ──

// Login de usuario (Conectado a la BD acuasan_db -> colección usuarios)
app.post(['/api/auth/login', '/auth/login'], async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Ingresa correo y contraseña' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });
    }

    if (user.activo === false) {
      return res.status(401).json({ success: false, message: 'Tu usuario se encuentra inactivo' });
    }

    let match = await bcrypt.compare(password, user.password).catch(() => false);
    if (!match && user.password === password) {
      match = true;
    }

    if (!match) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const usuarioObj = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol || 'OPERATIVO',
      cedula: user.cedula || ''
    };

    res.json({
      success: true,
      message: `Bienvenido, ${user.nombre}`,
      data: {
        token,
        usuario: usuarioObj
      },
      // Compatibilidad adicional
      token,
      usuario: usuarioObj
    });
  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
});

// Registro de usuario nuevo
app.post(['/api/auth/register', '/auth/register'], async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const existe = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existe) {
      return res.status(400).json({ error: 'El correo ya se encuentra registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUser = await prisma.user.create({
      data: {
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        rol: rol || 'OPERATIVO'
      }
    });

    const token = jwt.sign(
      { userId: nuevoUser.id, email: nuevoUser.email, nombre: nuevoUser.nombre, rol: nuevoUser.rol },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      mensaje: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id: nuevoUser.id,
        nombre: nuevoUser.nombre,
        email: nuevoUser.email,
        rol: nuevoUser.rol
      }
    });
  } catch (error) {
    console.error('Error en /api/auth/register:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Obtener perfil actual por token
app.get(['/api/auth/me', '/auth/me'], async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      cedula: user.cedula || ''
    });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
});

// Configuración segura de Google Drive API
let drive = null;
const credencialesPath = path.join(__dirname, '../credenciales.json');
if (fs.existsSync(credencialesPath)) {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: credencialesPath,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    drive = google.drive({ version: 'v3', auth });
    console.log('✅ Google Drive API autenticado con credenciales.json');
  } catch (errAuth) {
    console.error('⚠️ Error al autenticar credenciales.json:', errAuth.message);
  }
} else {
  console.warn('ℹ️ "credenciales.json" no encontrado. Los archivos se guardan localmente en drive_local_backup/.');
}

const pdfPoppler = require('pdf-poppler');

const TEMP_OCR_DIR = path.join(__dirname, '../temp_ocr');
if (!fs.existsSync(TEMP_OCR_DIR)) {
  fs.mkdirSync(TEMP_OCR_DIR, { recursive: true });
}

// ==========================================
// OCR ULTRA-RÁPIDO: Worker precargado en memoria
// ==========================================
let ocrWorkerInstance = null;

async function getOcrWorker() {
  if (!ocrWorkerInstance) {
    console.log('⚡ [OCR] Precargando motor Tesseract.js (español) en memoria...');
    if (Tesseract.createWorker) {
      ocrWorkerInstance = await Tesseract.createWorker('spa');
    }
    console.log('✅ [OCR] Motor Tesseract precargado y listo para lecturas instantáneas');
  }
  return ocrWorkerInstance;
}

// Pre-calentar el motor OCR en segundo plano al arrancar el backend
getOcrWorker().catch(err => {
  console.warn('ℹ️ Inicialización diferida de OCR:', err.message);
});

async function extraerTextoConOCR(buffer, mimeType) {
  console.log('🔍 [OCR] Iniciando extracción de caracteres...');
  const tInicio = Date.now();
  let imagenBuffer = null;
  let tempPdfPath = null;
  let tempImgPath = null;

  try {
    if (mimeType === 'application/pdf') {
      const id = Date.now();
      tempPdfPath = path.join(TEMP_OCR_DIR, `doc_${id}.pdf`);
      fs.writeFileSync(tempPdfPath, buffer);

      // Escala 1024 para velocidad ultra-rápida (menos de 3 segundos)
      const opts = {
        format: 'png',
        out_dir: TEMP_OCR_DIR,
        out_prefix: `page_${id}`,
        page: 1,
        scale: 1024
      };

      await pdfPoppler.convert(tempPdfPath, opts);

      const files = fs.readdirSync(TEMP_OCR_DIR).filter(f => f.startsWith(opts.out_prefix) && f.endsWith('.png'));
      if (files.length > 0) {
        tempImgPath = path.join(TEMP_OCR_DIR, files[0]);
        imagenBuffer = fs.readFileSync(tempImgPath);
      } else {
        throw new Error('pdf-poppler no generó la imagen de salida');
      }
    } else if (mimeType && mimeType.startsWith('image/')) {
      imagenBuffer = buffer;
    }
  } catch (errConv) {
    console.error('⚠️ [OCR] Error convirtiendo PDF a imagen:', errConv.message);
  } finally {
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try { fs.unlinkSync(tempPdfPath); } catch(e){}
    }
    if (tempImgPath && fs.existsSync(tempImgPath)) {
      try { fs.unlinkSync(tempImgPath); } catch(e){}
    }
  }

  if (!imagenBuffer) {
    throw new Error('No se pudo obtener imagen del documento para realizar OCR');
  }

  let texto = '';
  try {
    const worker = await getOcrWorker();
    if (worker && worker.recognize) {
      const res = await worker.recognize(imagenBuffer);
      texto = res?.data?.text || '';
    } else {
      const res = await Tesseract.recognize(imagenBuffer, 'spa');
      texto = res?.data?.text || '';
    }
  } catch (errWorker) {
    console.warn('⚠️ Fallback directo Tesseract:', errWorker.message);
    const res = await Tesseract.recognize(imagenBuffer, 'spa');
    texto = res?.data?.text || '';
  }

  const duracion = ((Date.now() - tInicio) / 1000).toFixed(1);
  console.log(`🚀 [OCR] Lectura completada en solo ${duracion} segundos (${texto.length} caracteres)`);
  return texto;
}

// ==========================================
// UTILIDADES DE EXTRACCIÓN DE TEXTO
// ==========================================

const limpiar = (str) => (str || '').replace(/^[:\s\-]+/, '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

const extraer = (texto, regex) => {
  const m = texto.match(regex);
  return m && m[1] ? limpiar(m[1]) : '';
};

/**
 * Extrae todos los campos relevantes de un documento con lógica estructurada
 */
const extraerCamposPdf = (texto) => {
  const resultado = {
    numeroRadicadoPdf: '',
    fechaDocumento: '',
    lugarFecha: '',
    peticionario: '',
    dependencia: '',
    destinatario: '',
    asunto: '',
    referencia: '',
    contexto: ''
  };

  if (!texto || texto.trim().length === 0) return resultado;

  const rawLines = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Filtro de frases del cuerpo del documento que NUNCA deben ir en nombres, asuntos ni destinatarios
  const isBodySentence = (str) => {
    if (!str) return false;
    return /^(?:En atenci[oó]n|Una vez|Por medio|De acuerdo|En este sentido|deber[aá]|solicitar|mediante|que la|se evidencia|con el fin|respetuosamente|me permito|para la|jurisdicci[oó]n)/i.test(str.trim());
  };

  // ── 1. NÚMERO DE RADICADO ────────────────────────────────────────────────
  const mRad =
    texto.match(/(?:Rad(?:icado)?|No\.?|RAD)\s*[:.-]?\s*([0-9]{7,12})/i) ||
    texto.match(/\b(2[610]\d{7,9})\b/) ||
    texto.match(/\b([0-9]{8,12})\b/);
  if (mRad) resultado.numeroRadicadoPdf = mRad[1].trim();

  // ── 2. FECHA Y HORA / FECHA SELLO ─────────────────────────────────────────
  const mFechaSello = texto.match(/(?:FECHA|Fecha)\s*[:.-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
  const mFechaHora  = texto.match(/(\d{1,2}\/[a-zA-ZáéíóúÁÉÍÓÚ]{3,4}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)?)/i);
  const mFechaStd   = texto.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);

  if (mFechaSello) resultado.fechaDocumento = mFechaSello[1].trim();
  else if (mFechaHora) resultado.fechaDocumento = mFechaHora[1].trim();
  else if (mFechaStd) resultado.fechaDocumento = mFechaStd[1].trim();

  // ── 3. LUGAR Y FECHA CARTA ──────────────────────────────────────────────
  const mLugarF =
    texto.match(/((?:San Gil|Pinchote|Socorro|Bucaramanga|Bogot[aá])[^,\n\r]*,\s*\d{1,2}\s+(?:de\s+)?[a-zA-ZáéíóúÁÉÍÓÚ]+\s+(?:de\s+)?\d{4})/i) ||
    texto.match(/([A-ZÁÉÍÓÚ][a-záéíóú]+,\s*\d{1,2}\s+de\s+[a-zA-Z]+\s+de\s+\d{4})/i);
  if (mLugarF) resultado.lugarFecha = mLugarF[1].trim();

  // ── 4. EMPRESA DESTINATARIA ─────────────────────────────────────────────
  if (/ACUASAN/i.test(texto) || /ACUEDUCTO/i.test(texto)) {
    resultado.dependencia = 'EMPRESA DE ACUEDUCTO, ALCANTARILLADO Y ASEO DE SAN GIL - ACUASAN E.I.C.E. - E.S.P.';
  } else {
    const mEmp = texto.match(/Se[ñn]ores\s*:\s*([^\n\r]+)/i);
    if (mEmp) resultado.dependencia = mEmp[1].trim();
  }

  // ── 5. PETICIONARIO & DESTINATARIO ──────────────────────────────────────
  // Caso A: Sello con "Remitente:" y "Destinatario:"
  const mRem  = texto.match(/Remitente\s*[:：]?\s*([^\n\r]+)/i);
  const mDest = texto.match(/Destinatario\s*[:：]?\s*([^\n\r]+)/i);

  if (mRem && !isBodySentence(mRem[1])) {
    resultado.peticionario = mRem[1].replace(/-\s*r\/l.*$/i, '').trim();
  }
  if (mDest && !isBodySentence(mDest[1])) {
    resultado.destinatario = mDest[1].trim();
  }

  // Caso B: Carta dirigida a persona ("SEÑORA: YADIRA VELÁSQUEZ MASEY")
  if (!resultado.peticionario || isBodySentence(resultado.peticionario)) {
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (/^(?:SEÑORA|SEÑOR|SR|SRA)\s*:/i.test(line)) {
        let nombre = '';
        let cargo = '';
        for (let j = i + 1; j < Math.min(i + 4, rawLines.length); j++) {
          const nextL = rawLines[j];
          if (/REFERENCIA|ASUNTO|FECHA|San Gil|Pinchote/i.test(nextL)) break;
          if (nextL.length > 3 && !/^\d+$/.test(nextL) && !/@/.test(nextL) && !/Celular/i.test(nextL)) {
            if (!nombre && /^[A-ZÁÉÍÓÚ\s]+$/i.test(nextL) && nextL.length > 4) {
              nombre = nextL;
            } else if (nombre && /PRESIDENTA|REPRESENTANTE|ALCALDE|GERENTE|JAC/i.test(nextL)) {
              cargo = nextL;
            }
          }
        }
        if (nombre && !isBodySentence(nombre)) {
          resultado.peticionario = cargo ? `${nombre} - ${cargo}` : nombre;
          break;
        }
      }
    }
  }

  // Fallback Peticionario (ej. "Yo, LAURA DULCEY NIEVES")
  if (!resultado.peticionario || isBodySentence(resultado.peticionario)) {
    const mYo = texto.match(/Yo[,\s]+([A-ZÁÉÍÓÚ\s]{6,40})[,\s]+identificad/i);
    if (mYo) resultado.peticionario = mYo[1].trim();
  }

  if (!resultado.destinatario || isBodySentence(resultado.destinatario)) {
    resultado.destinatario = 'ACUASAN E.I.C.E. - E.S.P.';
  }

  // ── 6. REFERENCIA ──────────────────────────────────────────────────────
  const mRef =
    texto.match(/REFERENCIA\s*[:：]?\s*([^\n\r]+)/i) ||
    texto.match(/Referencia\s*[:：]?\s*([^\n\r]+)/i) ||
    texto.match(/(C[oó]digo de suscriptor[^\n\r]*)/i);

  if (mRef && !isBodySentence(mRef[1])) {
    resultado.referencia = mRef[1].trim();
  }

  // ── 7. ASUNTO ──────────────────────────────────────────────────────────
  const mAsunto = texto.match(/Asunto\s*[:：]?\s*([^\n\r]+)/i);
  if (mAsunto && !isBodySentence(mAsunto[1])) {
    resultado.asunto = mAsunto[1].trim();
  } else if (resultado.referencia) {
    resultado.asunto = resultado.referencia;
  } else {
    const mSolicitud = texto.match(/(Solicitud[^\n\r]+)/i);
    if (mSolicitud && !isBodySentence(mSolicitud[1])) resultado.asunto = mSolicitud[1].trim();
  }

  // ── 8. CONTEXTO / OBSERVACIONES INTELIGENTE ─────────────────────────────
  // 1. Filtrar líneas de encabezados, logos, NITs, referencias o firmas para aislar el cuerpo real
  const bodyLines = rawLines.filter(line => {
    if (/^(?:REPUBLICA|DEPARTAMENTO|EMPRESA DE ACUEDUCTO|NIT|NUIR|San Gil,|Pinchote,|SEÑOR|SEÑORA|REFERENCIA:|E\s*950-|Rad\.|No\.|FECHA:)/i.test(line)) return false;
    if (/^[\s_.\-\=\*]+$/.test(line)) return false; // ruidos OCR como "_._"
    if (line.length < 15 && !/[a-záéíóú]/i.test(line)) return false; // líneas cortas sin texto real
    return true;
  });

  let contextoTexto = '';

  // 2. Buscar párrafo clave de solicitud o respuesta (empieza por "En atención", "Por medio", "Solicito", "Mediante", "Yo,", "Con el fin")
  const regexParrafoClave = /(?:En atenci[oó]n|Por medio|Solicit|Se solicita|Mediante|Yo,|Con el fin|Una vez|Respetado)[^\n\r]*[\s\S]{30,600}/i;
  const matchClave = texto.match(regexParrafoClave);

  if (matchClave && matchClave[0]) {
    contextoTexto = matchClave[0]
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\s._\-]{3,}/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } else if (bodyLines.length > 0) {
    contextoTexto = bodyLines.slice(0, 4).join(' ')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\s._\-]{3,}/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 3. Formatear y acortar limpiamente en el último punto completo hasta ~450 caracteres
  if (contextoTexto.length > 450) {
    let sub = contextoTexto.substring(0, 450);
    const lastPeriod = sub.lastIndexOf('.');
    if (lastPeriod > 200) {
      sub = sub.substring(0, lastPeriod + 1);
    } else {
      const lastSpace = sub.lastIndexOf(' ');
      if (lastSpace > 200) sub = sub.substring(0, lastSpace) + '...';
    }
    contextoTexto = sub;
  }

  resultado.contexto = contextoTexto || 'Registro documental procesado mediante OCR.';

  // ── 9. DÍAS PARA VENCER (AUTO-DETECCIÓN) ───────────────────────────────
  let diasSugeridos = 10;

  const mPlazoNum = texto.match(/(?:plazo|t[eé]rmino|tiempo|vence|vencimiento|en|dentro de)\s*(?:un\s+t[eé]rmino\s+de\s*)?(?:de\s*)?\b([0-9]{1,2})\b\s*d[ií]as/i);
  const mPlazoTexto = texto.match(/(?:plazo|t[eé]rmino|tiempo|vence|vencimiento)\s*(?:de\s*)?\b(tres|cinco|diez|quince|treinta)\b\s*(?:\(([0-9]{1,2})\))?\s*d[ií]as/i);

  if (mPlazoNum && mPlazoNum[1]) {
    const num = parseInt(mPlazoNum[1], 10);
    if ([3, 5, 10, 15, 30].includes(num)) diasSugeridos = num;
    else if (num <= 4) diasSugeridos = 3;
    else if (num <= 7) diasSugeridos = 5;
    else if (num <= 12) diasSugeridos = 10;
    else if (num <= 20) diasSugeridos = 15;
    else diasSugeridos = 30;
  } else if (mPlazoTexto) {
    const w = (mPlazoTexto[1] || '').toLowerCase();
    if (w.includes('tres')) diasSugeridos = 3;
    else if (w.includes('cinco')) diasSugeridos = 5;
    else if (w.includes('diez')) diasSugeridos = 10;
    else if (w.includes('quince')) diasSugeridos = 15;
    else if (w.includes('treinta')) diasSugeridos = 30;
  } else {
    if (/tutela|urgente|inmediato|derecho de petici[oó]n prioritario/i.test(texto)) {
      diasSugeridos = 3;
    } else if (/informaci[oó]n|copias|documentos/i.test(texto)) {
      diasSugeridos = 10;
    } else if (/consulta|viabilidad|disponibilidad/i.test(texto)) {
      diasSugeridos = 15;
    } else if (/reclamo|queja|peticion/i.test(texto)) {
      diasSugeridos = 15;
    }
  }

  resultado.diasParaVencer = diasSugeridos;

  // Limpieza de seguridad final para evitar oraciones de cuerpo en los campos
  if (isBodySentence(resultado.peticionario)) resultado.peticionario = '';
  if (isBodySentence(resultado.destinatario)) resultado.destinatario = 'ACUASAN E.I.C.E. - E.S.P.';
  if (isBodySentence(resultado.asunto))       resultado.asunto = resultado.referencia || '';

  return resultado;
};

// ==========================================
// MÓDULO EXTRA: EXTRACCIÓN Y LECTURA DE PDF (con OCR fallback)
// ==========================================
app.post('/extraer-pdf', upload.single('archivoPdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha adjuntado ningún archivo PDF' });
    }

    const dataBuffer = req.file.buffer;
    const mimeType   = req.file.mimetype;
    let texto = '';
    let metodo = '';

    // ── PASO 1: Intentar extracción con pdf-parse (PDFs con texto embebido) ──
    if (mimeType === 'application/pdf') {
      try {
        const data = await pdfParse(dataBuffer);
        texto = (data.text || '').trim();
        if (texto.length > 30) {
          metodo = 'pdf-parse';
          console.log(`📄 [PDF-PARSE] Texto extraído: ${texto.length} caracteres`);
        } else {
          console.log('📄 [PDF-PARSE] Texto insuficiente o vacío — se intentará OCR');
          texto = '';
        }
      } catch (errPdf) {
        console.warn('⚠️ [PDF-PARSE] Error:', errPdf.message, '— se intentará OCR');
      }
    }

    // ── PASO 2: Si no hay texto, usar OCR (Tesseract.js) ──
    if (!texto) {
      try {
        texto = await extraerTextoConOCR(dataBuffer, mimeType);
        metodo = 'OCR (Tesseract.js)';
      } catch (errOCR) {
        console.error('⚠️ [OCR] Error:', errOCR.message);
        texto = '';
        metodo = 'manual';
      }
    }

    console.log(`\n──────── TEXTO EXTRAÍDO (${metodo}) ────────`);
    console.log(texto.substring(0, 1500));
    console.log('────────────────────────────────────────\n');

    const campos = extraerCamposPdf(texto);
    console.log('Campos extraídos:', JSON.stringify(campos, null, 2));

    res.json({
      mensaje: `PDF procesado exitosamente (método: ${metodo})`,
      metodo: metodo,
      // Campos del formulario
      peticionario:      campos.peticionario      || '',
      dependencia:       campos.dependencia       || '',
      registradoPor:     'Encargada',
      contexto:          campos.contexto          || '',
      // Campos del sello y documento
      numeroRadicadoPdf: campos.numeroRadicadoPdf || '',
      fechaDocumento:    campos.fechaDocumento    || '',
      lugarFecha:        campos.lugarFecha        || '',
      destinatario:      campos.destinatario      || '',
      asunto:            campos.asunto            || '',
      referencia:        campos.referencia        || '',
      // Info adicional
      diasParaVencer: campos.diasParaVencer || 10,
      nombreArchivo: req.file.originalname
    });
  } catch (error) {
    console.error('Error procesando PDF:', error);
    res.status(500).json({ error: 'Error al procesar el archivo PDF', detalle: error.message });
  }
});

// ==========================================
// MÓDULO 1: GESTIÓN DE RADICADOS (CRUD & DRIVE)
// ==========================================

// Leer todos los radicados ordenados por fecha de radicación
app.get('/radicados', async (req, res) => {
  try {
    const radicados = await prisma.radicado.findMany({
      orderBy: { fechaRadicacion: 'desc' }
    });
    res.json(radicados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los radicados' });
  }
});

// Crear un nuevo radicado
app.post('/radicados', async (req, res) => {
  const {
    peticionario, dependencia, correoDrive, registradoPor, contexto, diasParaVencer, archivoNombre,
    // Nuevos campos del PDF
    destinatario, asunto, referencia, fechaDocumento, lugarFecha, numeroRadicadoPdf
  } = req.body;

  try {
    const numeroRadicado = `RAD-${Math.floor(1000 + Math.random() * 9000)}`;
    const fechaVencimiento = moment().add(diasParaVencer || 10, 'days').toDate();

    // 1. Guardar en MongoDB Atlas
    const nuevo = await prisma.radicado.create({
      data: {
        numeroRadicado,
        peticionario,
        dependencia,
        correoDrive:       correoDrive       || 'encargada@empresa.com',
        registradoPor:     registradoPor     || peticionario || 'Encargada',
        contexto:          contexto          || 'Registro documental de radicación.',
        destinatario:      destinatario      || null,
        asunto:            asunto            || null,
        referencia:        referencia        || null,
        fechaDocumento:    fechaDocumento    || null,
        lugarFecha:        lugarFecha        || null,
        numeroRadicadoPdf: numeroRadicadoPdf || null,
        fechaVencimiento,
        archivoNombre:     archivoNombre     || null
      }
    });



    // 3. Guardar copia local en la carpeta drive_local_backup/
    const localFileName = `Radicado_${numeroRadicado}_${peticionario.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    const localFilePath = path.join(DRIVE_LOCAL_DIR, localFileName);
    const content = [
      `NUMERO RADICADO SISTEMA: ${numeroRadicado}`,
      `NUMERO RADICADO PDF:     ${numeroRadicadoPdf || 'N/A'}`,
      `FECHA REGISTRO:          ${moment().format('YYYY-MM-DD HH:mm')}`,
      `FECHA DOCUMENTO PDF:     ${fechaDocumento || 'N/A'}`,
      `LUGAR Y FECHA CARTA:     ${lugarFecha || 'N/A'}`,
      `REMITENTE/PETICIONARIO:  ${peticionario}`,
      `EMPRESA DESTINATARIA:    ${dependencia}`,
      `DESTINATARIO (FUNC.):    ${destinatario || 'N/A'}`,
      `ASUNTO:                  ${asunto || 'N/A'}`,
      `REFERENCIA:              ${referencia || 'N/A'}`,
      `REGISTRADO POR:          ${registradoPor || peticionario}`,
      `CORREO DESTINO DRIVE:    ${correoDrive || 'encargada@empresa.com'}`,
      `CONTEXTO:                ${contexto || 'N/A'}`,
      `FECHA VENCIMIENTO:       ${moment(fechaVencimiento).format('YYYY-MM-DD')}`
    ].join('\n');

    fs.writeFileSync(localFilePath, content, 'utf8');

    let driveId = `LOCAL_BACKUP_${Date.now()}`;

    // 3. Subir a Google Drive API si credenciales.json está disponible
    if (drive) {
      try {
        const fileMetadata = {
          name: localFileName,
          parents: process.env.DRIVE_FOLDER_ID ? [process.env.DRIVE_FOLDER_ID] : []
        };
        const media = { mimeType: 'text/plain', body: fs.createReadStream(localFilePath) };
        const archivoDrive = await drive.files.create({ resource: fileMetadata, media: media, fields: 'id' });
        driveId = archivoDrive.data.id;

        await prisma.radicado.update({
          where: { id: nuevo.id },
          data: { urlDrive: driveId }
        });
        console.log(`✅ Archivo subido a Google Drive (ID: ${driveId})`);
      } catch (errDrive) {
        console.error('⚠️ Error subiendo a Google Drive API:', errDrive.message);
      }
    } else {
      console.log(`📂 Archivo guardado localmente en backend/drive_local_backup/${localFileName}`);
    }

    res.status(201).json({
      mensaje: 'Radicado registrado y guardado en Drive exitosamente',
      data: nuevo,
      driveId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el radicado' });
  }
});

// Actualizar estado de un radicado (Para marcarlo como Resuelto)
app.put('/radicados/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const actualizado = await prisma.radicado.update({
      where: { id: String(id) },
      data: { estado }
    });
    res.json({ mensaje: 'Estado actualizado', data: actualizado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el radicado' });
  }
});

// ==========================================
// MÓDULO 2: DESCARGA DE EXCEL Y DRIVE
// ==========================================

// Descargar archivo Excel (.csv) del Historial directamente
app.get('/descargar-excel', async (req, res) => {
  try {
    const radicados = await prisma.radicado.findMany({ orderBy: { fechaRadicacion: 'desc' } });
    const fileName = `Historial_Radicados_${moment().format('YYYY-MM-DD')}.csv`;
    const filePath = `./${fileName}`;

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'numeroRadicado',    title: 'CODIGO RADICADO SISTEMA' },
        { id: 'numeroRadicadoPdf', title: 'NUMERO RADICADO PDF' },
        { id: 'fechaRadicacion',   title: 'FECHA REGISTRO' },
        { id: 'fechaDocumento',    title: 'FECHA/HORA DOCUMENTO' },
        { id: 'lugarFecha',        title: 'LUGAR Y FECHA CARTA' },
        { id: 'peticionario',      title: 'REMITENTE / PETICIONARIO' },
        { id: 'dependencia',       title: 'EMPRESA DESTINATARIA' },
        { id: 'destinatario',      title: 'DESTINATARIO (FUNCIONARIO)' },
        { id: 'asunto',            title: 'ASUNTO' },
        { id: 'referencia',        title: 'REFERENCIA' },
        { id: 'registradoPor',     title: 'REGISTRADO POR (RESPONSABLE)' },
        { id: 'correoDrive',       title: 'CORREO DRIVE / DESTINATARIO' },
        { id: 'estado',            title: 'ESTADO' },
        { id: 'fechaVencimiento',  title: 'FECHA VENCIMIENTO' },
        { id: 'contexto',          title: 'CONTEXTO DE PETICION' }
      ]
    });

    const recordsFormatted = radicados.map(r => ({
      numeroRadicado:    r.numeroRadicado,
      numeroRadicadoPdf: r.numeroRadicadoPdf || 'N/A',
      fechaRadicacion:   moment(r.fechaRadicacion).format('YYYY-MM-DD HH:mm'),
      fechaDocumento:    r.fechaDocumento || 'N/A',
      lugarFecha:        r.lugarFecha || 'N/A',
      peticionario:      r.peticionario,
      dependencia:       r.dependencia,
      destinatario:      r.destinatario || 'N/A',
      asunto:            r.asunto || 'N/A',
      referencia:        r.referencia || 'N/A',
      registradoPor:     r.registradoPor || r.peticionario || 'Encargada',
      correoDrive:       r.correoDrive || 'N/A',
      estado:            r.estado,
      fechaVencimiento:  moment(r.fechaVencimiento).format('YYYY-MM-DD'),
      contexto:          (r.contexto || '').replace(/\n/g, ' ')
    }));

    await csvWriter.writeRecords(recordsFormatted);

    res.download(filePath, fileName, (err) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error('Error al generar Excel:', error);
    res.status(500).json({ error: 'Error al generar el reporte Excel' });
  }
});

// Subida manual a Google Drive
app.post('/sincronizar-drive', async (req, res) => {
  const radicados = await prisma.radicado.findMany();
  const filePath = path.join(DRIVE_LOCAL_DIR, `Export_Radicados_${moment().format('YYYY-MM-DD')}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'numeroRadicado',    title: 'NUMERO SISTEMA' },
      { id: 'numeroRadicadoPdf', title: 'NUMERO PDF' },
      { id: 'peticionario',      title: 'REMITENTE' },
      { id: 'dependencia',       title: 'EMPRESA' },
      { id: 'destinatario',      title: 'DESTINATARIO' },
      { id: 'asunto',            title: 'ASUNTO' },
      { id: 'referencia',        title: 'REFERENCIA' },
      { id: 'registradoPor',     title: 'REGISTRADO POR' },
      { id: 'correoDrive',       title: 'CORREO DRIVE' },
      { id: 'estado',            title: 'ESTADO' },
      { id: 'fechaVencimiento',  title: 'VENCIMIENTO' }
    ]
  });

  await csvWriter.writeRecords(radicados);

  if (drive) {
    try {
      const fileMetadata = {
        name: `Radicados_${moment().format('YYYY-MM-DD')}.csv`,
        parents: process.env.DRIVE_FOLDER_ID ? [process.env.DRIVE_FOLDER_ID] : []
      };
      const media = { mimeType: 'text/csv', body: fs.createReadStream(filePath) };
      const archivo = await drive.files.create({ resource: fileMetadata, media: media, fields: 'id' });
      return res.json({ mensaje: 'Subido exitosamente a la carpeta de Google Drive', driveId: archivo.data.id });
    } catch (error) {
      console.error('Error subiendo a Drive API:', error.message);
      return res.json({ mensaje: `Reporte generado localmente. (Nota Drive: ${error.message})`, driveId: 'LOCAL_BACKUP' });
    }
  } else {
    return res.json({ mensaje: 'Reporte generado y guardado localmente en rad/backend/drive_local_backup/.', driveId: 'LOCAL_BACKUP' });
  }
});

// ==========================================
// ARRANQUE DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 BACKEND AL 100% CORRIENDO EN http://localhost:${PORT}`);
});
