// ============================================================================
// VERIFICADOR DE INTEGRIDAD — MÓDULO PERMISOS (CONGELADO)
// ============================================================================
// El módulo de Permisos (frontend + backend) se declaró TERMINADO y estable.
// Este script compara el contenido actual de los archivos protegidos contra
// el registro de hashes `permisos.lock.json` (la "foto" congelada).
//
// Uso:
//   node scripts/proteccion/verificar-permisos.mjs            → verificar disco (exit 1 si derivó)
//   node scripts/proteccion/verificar-permisos.mjs --avisar   → solo avisa, nunca falla
//   node scripts/proteccion/verificar-permisos.mjs --staged   → verificar el INDEX de git
//   PERMISOS_DESBLOQUEAR=1 node scripts/proteccion/verificar-permisos.mjs --generar
//                                                              → regenera el lock (intencional)
//
// Decisiones de seguridad (tras revisión adversarial 2026-09-01):
//   · Modo --staged toma el lock de HEAD (git show HEAD:...), NUNCA del disco:
//     editar el lock a mano no puede legitimar contenido staged.
//   · El modo disco comprueba además que el lock local coincida con el de HEAD
//     (un lock manipulado en disco se reporta como tal).
//   · --staged compara el CONJUNTO COMPLETO del index (git ls-files -z) contra
//     el lock: sin diff-filters, inmune a renames (R) y a core.quotePath.
//   · Todo fallo de git (ausente, no-repo, error) cierra con exit 1 (fail-closed).
//
// Normalización: CRLF→LF antes de hashear (core.autocrlf=true produce falsos
// positivos de lo contrario). El lock registra rutas con '/' estilo git.
// ============================================================================
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// Raíz del repo: por defecto se deduce de la ubicación de este archivo; los
// hooks la fijan explícitamente (PERMISOS_RAIZ) porque ejecutan una copia del
// verificador extraída de HEAD, que vive dentro de .git/.
const RAIZ = process.env.PERMISOS_RAIZ
  ? process.env.PERMISOS_RAIZ.replace(/\\/g, '/').replace(/\/$/, '') + '/'
  : fileURLToPath(new URL('../../', import.meta.url))
const LOCK_REL = 'scripts/proteccion/permisos.lock.json'
const LOCK_PATH = path.join(RAIZ, ...LOCK_REL.split('/'))

// Directorios congelados (rutas estilo git, relativas a la raíz del repo)
const DIRS_PROTEGIDOS = [
  'acusan/frontend/src/modules/permisos',
  'acusan/backend/src/modules/permisos',
]

const ROJO = '\x1b[31m', VERDE = '\x1b[32m', AMARILLO = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m'

// ── Utilidades ───────────────────────────────────────────────────────────────
const normalizar = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
const hashDe = (buf) => createHash('sha256').update(normalizar(buf)).digest('hex')

/** Aborta con mensaje estructurado y exit 1 (fail-closed). */
const fallarCerrado = (mensaje) => {
  console.error(`${ROJO}✖ PROTECCIÓN PERMISOS: ${mensaje}${RESET}`)
  console.error(`  La verificación se aborta (fail-closed): no se emite un "íntegro" sin haber comparado.`)
  console.error(`  Referencia de restauración: git checkout permisos-estable-v1 -- ${DIRS_PROTEGIDOS.join(' ')}`)
  process.exit(1)
}

/** Lista recursiva de archivos de un directorio, como rutas git ('dir/file'). */
function listarArchivos(dirRel) {
  const dirAbs = path.join(RAIZ, ...dirRel.split('/'))
  let entradas
  try { entradas = readdirSync(dirAbs) } catch { return [] }
  const salida = []
  for (const nombre of entradas) {
    if (nombre === 'node_modules' || nombre === '.git') continue
    const abs = path.join(dirAbs, nombre)
    const rel = `${dirRel}/${nombre}`
    if (statSync(abs).isDirectory()) salida.push(...listarArchivos(rel))
    else salida.push(rel)
  }
  return salida
}

/** git show :ruta → contenido en el INDEX. null solo si la ruta no está en el index. */
function contenidoStaged(rel) {
  const r = spawnSync('git', ['-c', 'core.quotePath=false', 'show', `:${rel}`],
    { cwd: RAIZ, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  if (r.status === 0) return r.stdout
  if (r.error) fallarCerrado(`git no pudo ejecutarse (${r.error.message}).`)
  const err = (r.stderr || '').toString()
  if (/does not exist/i.test(err)) return null // ausencia legítima en el index
  fallarCerrado(`git show falló para ${rel}: ${err.split('\n')[0].trim()}`)
}

/** Lock confirmado en HEAD — el ancla inmutable para el modo --staged. */
function lockDesdeHEAD() {
  const r = spawnSync('git', ['show', `HEAD:${LOCK_REL}`],
    { cwd: RAIZ, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 })
  if (r.error) fallarCerrado(`git no pudo ejecutarse (${r.error.message}).`)
  if (r.status !== 0) {
    fallarCerrado(`no se pudo leer el lock confirmado en HEAD (¿historial anterior al congelamiento?). ` +
      `Restaure con: git checkout permisos-estable-v1 -- ${LOCK_REL}`)
  }
  return parsearLock(r.stdout.toString('utf8'), 'HEAD')
}

/** Parsea el lock tolerando BOM; ante lock inválido aborta con guía clara. */
function parsearLock(texto, origen) {
  try {
    return JSON.parse(texto.replace(/^﻿/, ''))
  } catch {
    fallarCerrado(`el lock (${origen}) está ausente, corrupto o con BOM. ` +
      `Si el cambio de módulo fue aprobado regenérelo con la llave ` +
      `(PERMISOS_DESBLOQUEAR=1 ... --generar); si no, restaure desde git.`)
  }
}

const leerLockDisco = () => parsearLock(readFileSync(LOCK_PATH, 'utf8'), 'disco')

// ── Modo GENERAR (requiere desbloqueo explícito) ────────────────────────────
const MODO = process.argv[2] || ''
if (MODO === '--generar') {
  if (process.env.PERMISOS_DESBLOQUEAR !== '1') {
    console.error(`${ROJO}✖ Para regenerar el lock de Permisos use PERMISOS_DESBLOQUEAR=1 (desbloqueo intencional).${RESET}`)
    console.error(`  Si no sabe por qué está esto: alguien modificó el módulo congelado. Revise con:`)
    console.error(`  git diff permisos-estable-v1 -- ${DIRS_PROTEGIDOS.join(' ')}`)
    process.exit(1)
  }
  const archivos = {}
  for (const dir of DIRS_PROTEGIDOS) {
    for (const rel of listarArchivos(dir)) {
      archivos[rel] = hashDe(readFileSync(path.join(RAIZ, ...rel.split('/'))))
    }
  }
  const lock = {
    version: 1,
    descripcion: 'Módulo Permisos congelado — estado estable verificado',
    algoritmo: 'sha256',
    normalizacion: 'crlf-a-lf',
    generado: new Date().toISOString(),
    archivos,
  }
  writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n')
  console.log(`${VERDE}✔ Lock de Permisos regenerado: ${Object.keys(archivos).length} archivos registrados.${RESET}`)
  console.log(`  Recuerde commitar el cambio y el lock JUNTOS y con PERMISOS_DESBLOQUEAR=1 activo.`)
  process.exit(0)
}

// ── Verificación (normal / --avisar / --staged) ─────────────────────────────
const problemas = []

const comparar = (rel, contenido, etiqueta) => {
  const esperado = (MODO === '--staged' ? lockStaged : lockDisco).archivos[rel]
  if (esperado === undefined) {
    problemas.push(`${rel} [${etiqueta}: archivo NUEVO, no está en el lock]`)
    return
  }
  if (contenido === null || contenido === undefined) {
    problemas.push(`${rel} [${etiqueta}: archivo ELIMINADO]`)
    return
  }
  if (hashDe(contenido) !== esperado) {
    problemas.push(`${rel} [${etiqueta}: contenido MODIFICADO]`)
  }
}

let lockDisco, lockStaged

if (MODO === '--staged') {
  // Ancla inmutable: el lock confirmado en HEAD. Un lock editado en disco
  // (o staged por un atacante) jamás es la referencia de esta comparación.
  lockStaged = lockDesdeHEAD()
  const registrados = lockStaged.archivos

  // Conjunto COMPLETO del index bajo los dirs protegidos (sin diff-filters:
  // inmune a renames R y a la cita de paths no-ASCII gracias a -z).
  const rIdx = spawnSync('git', ['-c', 'core.quotePath=false', 'ls-files', '--cached', '-z', '--', ...DIRS_PROTEGIDOS],
    { cwd: RAIZ, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  if (rIdx.error) fallarCerrado(`git no pudo ejecutarse (${rIdx.error.message}).`)
  if (rIdx.status !== 0) {
    fallarCerrado(`git ls-files falló: ${(rIdx.stderr || '').toString().split('\n')[0].trim()}`)
  }
  const enIndex = new Set(rIdx.stdout.toString('utf8').split('\0').filter(Boolean))

  for (const rel of Object.keys(registrados)) {
    if (!enIndex.has(rel)) { problemas.push(`${rel} [index: archivo ELIMINADO]`); continue }
    comparar(rel, contenidoStaged(rel), 'index')
  }
  for (const rel of enIndex) {
    if (!(rel in registrados)) problemas.push(`${rel} [index: archivo NUEVO agregado]`)
  }
} else {
  lockDisco = leerLockDisco()
  const registrados = lockDisco.archivos

  // El lock local debe ser el confirmado en HEAD: un lock editado a mano para
  // silenciar al verificador se reporta como manipulación.
  const rHead = spawnSync('git', ['show', `HEAD:${LOCK_REL}`],
    { cwd: RAIZ, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 })
  if (rHead.status === 0) {
    if (hashDe(rHead.stdout) !== hashDe(readFileSync(LOCK_PATH))) {
      problemas.push(`${LOCK_REL} [disco: LOCK MANIPULADO — difiere del confirmado en HEAD. ` +
        `Regenérelo con llave solo si el cambio fue aprobado]`)
    }
  }

  const enDisco = new Set()
  for (const dir of DIRS_PROTEGIDOS) {
    for (const rel of listarArchivos(dir)) {
      enDisco.add(rel)
      comparar(rel, readFileSync(path.join(RAIZ, ...rel.split('/'))), 'disco')
    }
  }
  for (const rel of Object.keys(registrados)) {
    if (!enDisco.has(rel)) problemas.push(`${rel} [disco: archivo ELIMINADO]`)
  }
}

const totalRegistrados = Object.keys((lockStaged || lockDisco).archivos).length

if (problemas.length === 0) {
  if (MODO !== '--avisar') {
    console.log(`${VERDE}✔ Módulo Permisos íntegro (${totalRegistrados} archivos coinciden con el lock${MODO === '--staged' ? ' de HEAD' : ''}).${RESET}`)
  }
  process.exit(0)
}

// ── Reporte de deriva ────────────────────────────────────────────────────────
const encabezado =
  `${ROJO}╔══════════════════════════════════════════════════════════════════╗${RESET}\n` +
  `${ROJO}║  ⚠  MÓDULO PERMISOS MODIFICADO — ESTÁ CONGELADO (YA ESTABLE)  ⚠  ║${RESET}\n` +
  `${ROJO}╚══════════════════════════════════════════════════════════════════╝${RESET}\n` +
  `  Archivos con diferencias contra el lock:\n` +
  problemas.map((p) => `    ${AMARILLO}• ${p}${RESET}`).join('\n') + '\n\n' +
  `  ${CYAN}Restaurar el estado estable (descarta los cambios):${RESET}\n` +
  `    git checkout permisos-estable-v1 -- ${DIRS_PROTEGIDOS.join(' ')}\n\n` +
  `  ${CYAN}Si el cambio es INTENCIONAL y aprobado:${RESET}\n` +
  `    1. PERMISOS_DESBLOQUEAR=1 node scripts/proteccion/verificar-permisos.mjs --generar\n` +
  `    2. Commitar juntos el cambio y el lock, con PERMISOS_DESBLOQUEAR=1 aún activo\n\n` +
  `  Documentación completa: PROTECCION-PERMISOS.md (raíz del repo)\n`

if (MODO === '--avisar') {
  console.warn(encabezado)
  process.exit(0)
}
console.error(encabezado)
process.exit(1)
