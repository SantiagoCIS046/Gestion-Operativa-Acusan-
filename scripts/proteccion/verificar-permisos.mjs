// ============================================================================
// VERIFICADOR DE INTEGRIDAD — MÓDULO PERMISOS (CONGELADO)
// ============================================================================
// El módulo de Permisos (frontend + backend) se declaró TERMINADO y estable.
// Este script compara el contenido actual de los archivos protegidos contra
// el registro de hashes `permisos.lock.json` (la "foto" congelada).
//
// Uso:
//   node scripts/proteccion/verificar-permisos.mjs            → verificar (exit 1 si derivó)
//   node scripts/proteccion/verificar-permisos.mjs --avisar   → solo avisa, nunca falla
//   node scripts/proteccion/verificar-permisos.mjs --staged   → verifica el INDEX de git
//   PERMISOS_DESBLOQUEAR=1 node scripts/proteccion/verificar-permisos.mjs --generar
//                                                              → regenera el lock (intencional)
//
// Normalización: CRLF→LF antes de hashear (core.autocrlf=true produce falsos
// positivos de lo contrario). El lock registra rutas con '/' estilo git.
// ============================================================================
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const RAIZ = fileURLToPath(new URL('../../', import.meta.url))
const LOCK_PATH = path.join(RAIZ, 'scripts', 'proteccion', 'permisos.lock.json')

// Directorios congelados (rutas estilo git, relativas a la raíz del repo)
const DIRS_PROTEGIDOS = [
  'acusan/frontend/src/modules/permisos',
  'acusan/backend/src/modules/permisos',
]

const ROJO = '\x1b[31m', VERDE = '\x1b[32m', AMARILLO = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m'

// ── Utilidades ───────────────────────────────────────────────────────────────
const normalizar = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
const hashDe = (buf) => createHash('sha256').update(normalizar(buf)).digest('hex')

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

const leerLock = () => JSON.parse(readFileSync(LOCK_PATH, 'utf8'))

/** Contenido staged (index) de un archivo vía git. null si no está en el index. */
function contenidoStaged(rel) {
  const r = spawnSync('git', ['show', `:${rel}`], { cwd: RAIZ, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) return null
  return r.stdout
}

// ── Modo GENERAR (requiere desbloqueo explícito) ────────────────────────────
const MODO = process.argv[2] || ''
if (MODO === '--generar') {
  if (process.env.PERMISOS_DESBLOQUEAR !== '1') {
    console.error(`${ROJO}✖ Para regenerar el lock de Permisos use PERMISOS_DESBLOQUEAR=1 (desbloqueo intencional).${RESET}`)
    console.error(`  Si no sabe por qué está esto: alguien modificó el módulo congelado. Revise con:`)
    console.error(`  git diff permisos-estable-v1 -- acusan/frontend/src/modules/permisos acusan/backend/src/modules/permisos`)
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
  process.exit(0)
}

// ── Verificación (normal / --avisar / --staged) ─────────────────────────────
const lock = leerLock()
const registrados = lock.archivos
const problemas = []
const detalle = []

const comparar = (rel, contenido, etiqueta) => {
  const esperado = registrados[rel]
  if (esperado === undefined) {
    problemas.push(`${rel} [${etiqueta}: archivo NUEVO, no está en el lock]`)
    return
  }
  if (contenido === null) {
    problemas.push(`${rel} [${etiqueta}: archivo ELIMINADO del staging]`)
    return
  }
  if (hashDe(contenido) !== esperado) {
    problemas.push(`${rel} [${etiqueta}: contenido MODIFICADO]`)
  }
}

if (MODO === '--staged') {
  // Cambios STAGED dentro de los dirs protegidos, por tipo
  const stagedDe = (filtro) => {
    const r = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=' + filtro, '--', ...DIRS_PROTEGIDOS], { cwd: RAIZ, encoding: 'utf8' })
    return new Set((r.stdout || '').split('\n').map((l) => l.trim()).filter(Boolean))
  }
  const eliminados = stagedDe('D')
  const agregados = stagedDe('A')
  for (const rel of Object.keys(registrados)) {
    if (eliminados.has(rel)) { problemas.push(`${rel} [index: archivo ELIMINADO]`); continue }
    const contenido = contenidoStaged(rel)
    // null = el archivo no está en el index (p. ej. aún no trackeado): este
    // commit no lo modifica, así que no es asunto del modo --staged.
    if (contenido !== null) comparar(rel, contenido, 'index')
  }
  for (const rel of agregados) {
    if (!(rel in registrados)) problemas.push(`${rel} [index: archivo NUEVO agregado]`)
  }
} else {
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

if (problemas.length === 0) {
  if (MODO !== '--avisar') {
    console.log(`${VERDE}✔ Módulo Permisos íntegro (${Object.keys(registrados).length} archivos coinciden con el lock).${RESET}`)
  }
  process.exit(0)
}

// ── Reporte de deriva ────────────────────────────────────────────────────────
const encabezado =
  `${ROJO}╔══════════════════════════════════════════════════════════════════╗${RESET}\n` +
  `${ROJO}║  ⚠  MÓDULO PERMISOS MODIFICADO — ESTÁ CONGELADO (YA ESTABLE)  ⚠  ║${RESET}\n` +
  `${ROJO}╚══════════════════════════════════════════════════════════════════╝${RESET}\n` +
  `  Archivos con diferencias contra el lock:\n` +
  detalle.concat(problemas.map((p) => `    ${AMARILLO}• ${p}${RESET}`)).join('\n') + '\n\n' +
  `  ${CYAN}Restaurar el estado estable (descarta los cambios):${RESET}\n` +
  `    git checkout permisos-estable-v1 -- acusan/frontend/src/modules/permisos acusan/backend/src/modules/permisos\n\n` +
  `  ${CYAN}Si el cambio es INTENCIONAL y aprobado:${RESET}\n` +
  `    1. PERMISOS_DESBLOQUEAR=1 node scripts/proteccion/verificar-permisos.mjs --generar\n` +
  `    2. Commitar juntos el cambio y el lock actualizado\n\n` +
  `  Documentación completa: PROTECCION-PERMISOS.md (raíz del repo)\n`

if (MODO === '--avisar') {
  console.warn(encabezado)
  process.exit(0)
}
console.error(encabezado)
process.exit(1)
