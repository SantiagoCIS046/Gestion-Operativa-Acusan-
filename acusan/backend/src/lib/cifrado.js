// Cifrado de datos sensibles en reposo (2026-11-03).
//
// Qué protege: si alguien obtiene una copia de la base de datos (un respaldo
// filtrado, una cadena de conexión expuesta, un acceso indebido a Atlas), los
// números, asuntos, remitentes y PDFs de los radicados son ilegibles sin la
// llave, que vive SOLO en las variables de entorno del servidor
// (CLAVE_MAESTRA_DATOS en backend/.env y en Vercel). La llave nunca se guarda
// en la base ni en el repositorio.
//
// Piezas:
// - AES-256-GCM (cifrado autenticado): confidencialidad + detección de
//   manipulación. Cada valor lleva su propio IV aleatorio, así dos radicados
//   con el mismo asunto producen textos cifrados distintos.
// - Índice ciego (HMAC-SHA256): huella determinista del número de radicado
//   para buscarlo por igualdad y mantener la unicidad sin descifrar nada.
//   No se puede revertir sin la llave.
// - Ambas llaves se DERIVAN de la llave maestra con HKDF (llaves distintas
//   para cifrar y para el índice: una no sirve para atacar la otra).
//
// Formatos guardados (el prefijo permite reconocer lo ya cifrado y rotar
// llaves en el futuro con una nueva versión):
//   texto → "enc:v1:<base64(iv|tag|cifrado)>"
//   json  → "encj:v1:<base64(iv|tag|cifrado)>"  (el JSON serializado)
//   bytes → Buffer "ENC1" + iv(12) + tag(16) + cifrado
//
// Compatibilidad: descifrar un valor SIN prefijo lo devuelve tal cual, así
// los datos previos a la migración se siguen leyendo hasta que
// scripts/cifrar-datos-existentes.mjs los cifre.

import crypto from 'node:crypto'

const ALGORITMO = 'aes-256-gcm'
const LARGO_IV = 12
const LARGO_TAG = 16

export const PREFIJO_TEXTO = 'enc:v1:'
export const PREFIJO_JSON = 'encj:v1:'
export const MAGIA_BYTES = Buffer.from('ENC1', 'latin1')

const VARIABLE_CLAVE = 'CLAVE_MAESTRA_DATOS'

let llavesEnCache = null
let maestraEnCache = null

// La maestra se acepta en hex (64 caracteres) o base64 (44): 32 bytes.
function leerMaestra() {
  const valor = String(process.env[VARIABLE_CLAVE] ?? '').trim()
  if (!valor) {
    throw new Error(
      `Falta ${VARIABLE_CLAVE} en el entorno. Genérala con "npm run claves:generar" ` +
        '(backend/) y configúrala también en Vercel → Settings → Environment Variables.',
    )
  }
  const buf = /^[0-9a-f]{64}$/i.test(valor) ? Buffer.from(valor, 'hex') : Buffer.from(valor, 'base64')
  if (buf.length !== 32) {
    throw new Error(`${VARIABLE_CLAVE} debe tener 32 bytes (64 caracteres hex o 44 en base64).`)
  }
  return { valor, buf }
}

function llaves() {
  const { valor, buf } = leerMaestra()
  // Si la variable cambió (pruebas), se derivan de nuevo
  if (llavesEnCache && maestraEnCache === valor) return llavesEnCache
  const derivar = (uso) => Buffer.from(crypto.hkdfSync('sha256', buf, Buffer.alloc(0), `acuasan:${uso}:v1`, 32))
  llavesEnCache = { cifrado: derivar('cifrado'), indice: derivar('indice') }
  maestraEnCache = valor
  return llavesEnCache
}

/** Lanza un error claro si la llave no está configurada (se llama al arrancar). */
export function verificarClaves() {
  llaves()
  return true
}

function cifrarCrudo(buffer) {
  const iv = crypto.randomBytes(LARGO_IV)
  const cifrador = crypto.createCipheriv(ALGORITMO, llaves().cifrado, iv)
  const cuerpo = Buffer.concat([cifrador.update(buffer), cifrador.final()])
  return Buffer.concat([iv, cifrador.getAuthTag(), cuerpo])
}

function descifrarCrudo(paquete) {
  if (paquete.length < LARGO_IV + LARGO_TAG) throw new Error('Dato cifrado incompleto.')
  const iv = paquete.subarray(0, LARGO_IV)
  const tag = paquete.subarray(LARGO_IV, LARGO_IV + LARGO_TAG)
  const cuerpo = paquete.subarray(LARGO_IV + LARGO_TAG)
  const descifrador = crypto.createDecipheriv(ALGORITMO, llaves().cifrado, iv)
  descifrador.setAuthTag(tag)
  // Si la llave es otra o alguien alteró el dato, final() lanza error
  return Buffer.concat([descifrador.update(cuerpo), descifrador.final()])
}

export const estaCifradoTexto = (v) => typeof v === 'string' && v.startsWith(PREFIJO_TEXTO)
export const estaCifradoJson = (v) => typeof v === 'string' && v.startsWith(PREFIJO_JSON)
export const estaCifradoBytes = (v) =>
  v instanceof Uint8Array && v.length >= MAGIA_BYTES.length && Buffer.from(v.buffer, v.byteOffset, MAGIA_BYTES.length).equals(MAGIA_BYTES)

// "Ya cifrado" solo cuenta si de verdad descifra con NUESTRA llave: un texto
// que alguien escriba empezando por "enc:v1:" se cifra como cualquier otro
// (si no, quedaría guardado en claro y rompería la lectura).
function descifraBien(fn) {
  try {
    fn()
    return true
  } catch {
    return false
  }
}

// ── Texto ─────────────────────────────────────────────────────────────────────
/** null/undefined pasan tal cual; lo ya cifrado no se cifra dos veces. */
export function cifrarTexto(valor) {
  if (valor === null || valor === undefined) return valor
  const texto = String(valor)
  if (estaCifradoTexto(texto) && descifraBien(() => descifrarTexto(texto))) return texto
  return PREFIJO_TEXTO + cifrarCrudo(Buffer.from(texto, 'utf8')).toString('base64')
}

export function descifrarTexto(valor) {
  if (!estaCifradoTexto(valor)) return valor
  return descifrarCrudo(Buffer.from(valor.slice(PREFIJO_TEXTO.length), 'base64')).toString('utf8')
}

// ── JSON (campos Json de Prisma: se guarda como un string cifrado) ───────────
export function cifrarJson(valor) {
  if (valor === null || valor === undefined) return valor
  if (estaCifradoJson(valor) && descifraBien(() => descifrarJson(valor))) return valor
  return PREFIJO_JSON + cifrarCrudo(Buffer.from(JSON.stringify(valor), 'utf8')).toString('base64')
}

export function descifrarJson(valor) {
  if (!estaCifradoJson(valor)) return valor
  return JSON.parse(descifrarCrudo(Buffer.from(valor.slice(PREFIJO_JSON.length), 'base64')).toString('utf8'))
}

// ── Bytes (PDFs) ──────────────────────────────────────────────────────────────
export function cifrarBytes(valor) {
  if (valor === null || valor === undefined) return valor
  if (estaCifradoBytes(valor) && descifraBien(() => descifrarBytes(valor))) return Buffer.from(valor)
  return Buffer.concat([MAGIA_BYTES, cifrarCrudo(Buffer.from(valor))])
}

export function descifrarBytes(valor) {
  if (!estaCifradoBytes(valor)) return valor
  const buf = Buffer.from(valor)
  return descifrarCrudo(buf.subarray(MAGIA_BYTES.length))
}

// ── Índice ciego ──────────────────────────────────────────────────────────────
/**
 * Normalización del número antes de la huella: sin espacios a los lados,
 * mayúsculas y espacios internos simples. Así "rad-2026-0042 " y
 * "RAD-2026-0042" son el mismo radicado (para buscar y para la unicidad).
 */
export const normalizarNumero = (numero) =>
  String(numero ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase()

export function indiceCiego(numero) {
  return crypto.createHmac('sha256', llaves().indice).update(normalizarNumero(numero), 'utf8').digest('hex')
}

// ── Descifrado profundo de resultados ─────────────────────────────────────────
// Recorre objetos planos y arreglos (resultados de Prisma, includes anidados y
// agregados crudos) y descifra los valores con prefijo/firma reconocible,
// SOLO en las claves de campos sensibles (las de CAMPOS_SENSIBLES): un texto
// cualquiera que empiece por "enc:v1:" en otro campo no se toca.
// Fechas, ObjectId en Extended JSON, etc. se dejan intactos.
export const CAMPOS_SENSIBLES = new Set([
  'numeroRadicado', 'asunto', 'descripcion', 'remitente', 'instrucciones',
  'observacionesRespuesta', 'numeroOficioRespuesta', 'nombreOriginal',
  'contenido', 'mensaje', 'detalle', 'criticos',
])

const esPlano = (v) => {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

let avisoFallo = false
function descifrarValor(valor) {
  try {
    if (estaCifradoTexto(valor)) return descifrarTexto(valor)
    if (estaCifradoJson(valor)) return descifrarJson(valor)
    if (estaCifradoBytes(valor)) return descifrarBytes(valor)
  } catch (error) {
    // Llave equivocada o dato alterado: no se tumba la consulta, el valor
    // sale tal cual (ilegible) y queda el aviso en el log del servidor.
    if (!avisoFallo) {
      avisoFallo = true
      console.warn(`[CIFRADO] No se pudo descifrar un valor (¿CLAVE_MAESTRA_DATOS distinta?): ${error.message}`)
    }
  }
  return valor
}

export function descifrarProfundo(valor, clave = null) {
  if (clave !== null && CAMPOS_SENSIBLES.has(clave) && (typeof valor === 'string' || valor instanceof Uint8Array)) {
    return descifrarValor(valor)
  }
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) valor[i] = descifrarProfundo(valor[i], clave)
    return valor
  }
  if (esPlano(valor)) {
    for (const k of Object.keys(valor)) valor[k] = descifrarProfundo(valor[k], k)
    return valor
  }
  return valor
}
