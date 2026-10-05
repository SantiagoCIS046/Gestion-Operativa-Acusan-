/**
 * radicadosRoles.test.mjs — Matriz de roles de /api/radicados con cuentas reales
 * ─────────────────────────────────────────────────────────────────────────────
 * Levanta el servidor Express REAL en un puerto local de prueba y recorre la
 * matriz completa ruta × rol usando las CUENTAS REALES de la BD (una por rol,
 * con usuarios activos). Los tokens se firman con el JWT_SECRET real y el
 * MISMO payload que emite el login ({id, nombre, email, rol, cargo}), así que
 * verifican el pipeline completo: verificarToken → verificarRol → controller.
 *
 * Las operaciones de escritura usan radicados desechables marcados con
 * registradoPor "test-roles" que se borran al final; la BD real queda intacta.
 *
 * Ejecutar:  cd acusan/backend && node --env-file=.env tests/radicadosRoles.test.mjs
 */

import { spawn } from 'node:child_process'
import { exec } from 'node:child_process'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const PUERTO = 3999
const BASE = `http://127.0.0.1:${PUERTO}`
const MARCA = 'test-roles'
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const prisma = new PrismaClient()
let fallos = 0
const verificar = (ok, mensaje) => {
  if (ok) console.log(`  ✓ ${mensaje}`)
  else { fallos++; console.error(`  ✗ FALLO: ${mensaje}`) }
}

// ─── Cuentas reales: una por rol con usuarios activos ────────────────────────
const usuarios = await prisma.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true, email: true, rol: true, cargo: true } })
const porRol = new Map()
for (const u of usuarios) if (!porRol.has(u.rol)) porRol.set(u.rol, u)
const ROLES = [...porRol.keys()]
console.log(`\nCuentas reales por rol: ${[...porRol.entries()].map(([r, u]) => `${r}=<${u.email}>`).join('  ')}`)

// Tokens idénticos a los del login (mismo payload, mismo secreto, misma vida)
const tokenDe = (u) => jwt.sign(
  { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, cargo: u.cargo },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
)

// ─── Levantar el servidor real ───────────────────────────────────────────────
console.log('\nArrancando servidor de prueba en el puerto ' + PUERTO + '…')
const servidor = spawn(process.execPath, ['src/app.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PUERTO), NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
})
servidor.stdout.on('data', () => {})   // se descarta: el veredicto lo dan las respuestas HTTP
servidor.stderr.on('data', () => {})

const pedir = async (metodo, ruta, { token, cuerpo } = {}) => {
  try {
    const res = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    })
    let data = null
    const texto = await res.text()
    try { data = JSON.parse(texto) } catch { data = texto }
    return { status: res.status, data, headers: res.headers }
  } catch (e) {
    return { status: 0, data: null, headers: null, error: e.message }
  }
}

let listo = false
for (let i = 0; i < 60 && !listo; i++) {
  const r = await pedir('GET', '/api/radicados')
  if (r.status !== 0) listo = true
  else await new Promise((r2) => setTimeout(r2, 500))
}
if (!listo) {
  console.error('El servidor de prueba no arrancó. Abortando.')
  servidor.kill()
  process.exit(1)
}

try {
  // ─── 1. Autenticación: sin token y token basura → 401 ──────────────────────
  console.log('\n[1] Autenticación (verificarToken)…')
  let r = await pedir('GET', '/api/radicados')
  verificar(r.status === 401, `sin token → 401 (dio ${r.status})`)
  r = await pedir('GET', '/api/radicados', { token: 'esto-no-es-un-jwt' })
  verificar(r.status === 401, `token inválido → 401 (dio ${r.status})`)

  // ─── 2. Matriz ruta × rol (permisos declarados en radicados.routes.js) ────
  console.log('\n[2] Matriz de permisos ruta × rol (cuentas reales)…')
  const LECTURA = ['RADICADOS', 'ENCARGADO', 'GERENCIA', 'ADMIN']
  const ESCRITURA = ['RADICADOS', 'ENCARGADO', 'ADMIN']

  const casos = [
    // [etiqueta, método, ruta, roles permitidos, código de éxito]
    ['GET  /                     ', 'GET', '/api/radicados', LECTURA, 200],
    ['GET  /expedientes          ', 'GET', '/api/radicados/expedientes', LECTURA, 200],
    ['GET  /respuestas           ', 'GET', '/api/radicados/respuestas', LECTURA, 200],
    ['GET  /descargar-excel      ', 'GET', '/api/radicados/descargar-excel', LECTURA, 200],
    ['POST /extraer-campos       ', 'POST', '/api/radicados/extraer-campos', ESCRITURA, 200],
    ['POST /extraer-campos-resp  ', 'POST', '/api/radicados/extraer-campos-respuesta', ESCRITURA, 200],
    ['POST / (radicar)           ', 'POST', '/api/radicados', ESCRITURA, 201]
  ]
  const cuerpores = {}
  for (const rol of ROLES) {
    const u = porRol.get(rol)
    const token = tokenDe(u)
    for (const [etiqueta, metodo, ruta, permite, ok] of casos) {
      const cuerpo = ruta.endsWith('/extraer-campos')
        ? { texto: 'Radicado No.: 2610000736 Folios: 1\nFECHA: 14/08/2026\nRemitente: PEREZ GOMEZ JOSE' }
        : ruta.endsWith('/extraer-campos-respuesta')
          ? { texto: 'San Gil, 16 de junio de 2026\nOficio No.: OF-2026-104' }
          : ruta === '/api/radicados' && metodo === 'POST'
            ? { peticionario: `PRUEBA ROLES ${rol} (BORRAR)`, dependencia: 'ACUASAN E.S.P.', registradoPor: MARCA, diasParaVencer: 15 }
            : undefined
      const r = await pedir(metodo, ruta, { token, cuerpo })
      const esperado = permite.includes(rol) ? ok : 403
      verificar(r.status === esperado,
        `${etiqueta} como ${rol.padEnd(9)} → ${esperado} (dio ${r.status})`)
      if (r.status === 201 && r.data?.data?.id) cuerpores[rol] = r.data.data
    }
  }

  // El parser sobre HTTP también debe leer el documento (regla de oro)
  const rad = porRol.get('RADICADOS')
  r = await pedir('POST', '/api/radicados/extraer-campos', {
    token: tokenDe(rad),
    cuerpo: { texto: 'Radicado No.: 2610000736 Folios: 1\nFECHA: 14/08/2026\nRemitente: PEREZ GOMEZ JOSE' }
  })
  verificar(r.status === 200 && r.data?.data?.numeroRadicadoPdf === '2610000736',
    'extraer-campos lee el radicado del sello (2610000736)')

  // ─── 3. Operaciones completas sobre radicados desechables ──────────────────
  console.log('\n[3] Ciclo de vida completo (radicados de prueba marcados)…')

  // Higiene de datos: el listado NUNCA viaja con el documento Base64
  r = await pedir('GET', '/api/radicados', { token: tokenDe(rad) })
  verificar(r.status === 200 && Array.isArray(r.data?.data) &&
    r.data.data.every((x) => !('archivoBase64' in x)),
    'el listado nunca expone archivoBase64 (pesa MBs)')

  const propios = Object.entries(cuerpores).filter(([, v]) => v?.id)
  verificar(propios.length === 3, `radicaron por HTTP los 3 roles con permiso: ${propios.map(([rol]) => rol).join(', ')}`)

  for (const [rol, creado] of propios) {
    const u = porRol.get(rol)
    const token = tokenDe(u)

    r = await pedir('PUT', `/api/radicados/${creado.id}/estado`, { token, cuerpo: { estado: 'Resuelto' } })
    verificar(r.status === 200 && r.data?.data?.estado === 'Resuelto', `PUT /:id/estado como ${rol} → 200 Resuelto (dio ${r.status})`)
    r = await pedir('PUT', `/api/radicados/${creado.id}/estado`, { token, cuerpo: { estado: 'Pendiente' } })
    verificar(r.status === 200, `PUT /:id/estado como ${rol} vuelve a Pendiente`)

    r = await pedir('PUT', `/api/radicados/${creado.id}/archivo`, { token, cuerpo: { archivoBase64: PNG_1PX, archivoNombre: 'prueba.png' } })
    verificar(r.status === 200, `PUT /:id/archivo como ${rol} adjunta el documento (dio ${r.status})`)

    r = await pedir('GET', `/api/radicados/${creado.id}/archivo`, { token })
    verificar(r.status === 200 && (r.headers?.get('content-type') || '').includes('image/png'),
      `GET /:id/archivo como ${rol} sirve el binario con MIME real (dio ${r.status})`)

    r = await pedir('POST', '/api/radicados/respuestas', {
      token,
      cuerpo: { radicadoId: creado.id, numeroOficio: `OF-TEST-${rol.slice(0, 3)}`, registradoPor: MARCA }
    })
    verificar(r.status === 201 && r.data?.data?.numeroRadicado === creado.numeroRadicado,
      `POST /respuestas como ${rol} archiva oficio vinculado al padre (dio ${r.status})`)
  }

  // Gerencia lee los expedientes emparejados: el chip "Respondido" del
  // historial nace de este cruce — debe ver las respuestas recién archivadas
  const ger = porRol.get('GERENCIA')
  r = await pedir('GET', '/api/radicados/expedientes', { token: tokenDe(ger) })
  const conRespuesta = (r.data?.data || []).filter((x) => x.registradoPor === MARCA && x.respuestas?.length > 0)
  verificar(r.status === 200 && conRespuesta.length === 3,
    `GET /expedientes como GERENCIA ve los 3 expedientes de prueba con sus respuestas (vio ${conRespuesta.length})`)

  // Estado Resuelto coherente en el listado del historial
  r = await pedir('GET', '/api/radicados', { token: tokenDe(ger) })
  const resueltos = (r.data?.data || []).filter((x) => x.registradoPor === MARCA && x.estado === 'Resuelto')
  verificar(resueltos.length === 3, 'los 3 radicados con respuesta quedaron Resuelto en el listado del historial')

  // ─── 4. Eliminación: solo ADMIN ─────────────────────────────────────────────
  console.log('\n[4] Eliminación (exclusiva de ADMIN)…')
  const admin = porRol.get('ADMIN')
  const victima = cuerpores['RADICADOS'] // se elimina de verdad al final del todo

  for (const rol of ROLES) {
    if (rol === 'ADMIN') continue
    r = await pedir('DELETE', `/api/radicados/${victima.id}`, { token: tokenDe(porRol.get(rol)) })
    verificar(r.status === 403, `DELETE /:id como ${rol.padEnd(9)} → 403 (dio ${r.status})`)
  }
  r = await pedir('DELETE', `/api/radicados/${victima.id}`, { token: tokenDe(admin) })
  verificar(r.status === 200, `DELETE /:id como ADMIN → 200 (dio ${r.status})`)
  r = await pedir('DELETE', `/api/radicados/${victima.id}`, { token: tokenDe(admin) })
  verificar(r.status === 404, `DELETE repetido del mismo radicado → 404 limpio (dio ${r.status})`)
} finally {
  // ─── Limpieza: la BD real queda exactamente como estaba ────────────────────
  const pruevaIds = await prisma.radicado.findMany({ where: { registradoPor: MARCA }, select: { id: true } })
  if (pruevaIds.length) {
    await prisma.respuestaRadicado.deleteMany({ where: { radicadoId: { in: pruevaIds.map((x) => x.id) } } })
    const borrados = await prisma.radicado.deleteMany({ where: { registradoPor: MARCA } })
    console.log(`\nLimpieza: ${borrados.count} radicados de prueba (y sus respuestas) eliminados.`)
  } else {
    console.log('\nLimpieza: sin radicados de prueba pendientes (todo quedó borrado en la prueba).')
  }

  servidor.kill()
  if (process.platform === 'win32') exec(`taskkill /PID ${servidor.pid} /T /F`, () => {})
  await prisma.$disconnect()
  console.log(fallos === 0 ? '\nTODAS LAS PRUEBAS DE ROLES PASARON\n' : `\n${fallos} PRUEBAS FALLARON\n`)
  process.exit(fallos === 0 ? 0 : 1)
}
