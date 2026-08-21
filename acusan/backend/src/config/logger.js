/**
 * logger.js — Logger centralizado para Acuasan Backend
 * Imprime logs con colores ANSI, iconos, timestamps y categorías
 * Sin dependencias externas.
 */

// ─── Colores ANSI ─────────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',

  // Texto
  white:   '\x1b[97m',
  gray:    '\x1b[90m',
  cyan:    '\x1b[96m',
  green:   '\x1b[92m',
  yellow:  '\x1b[93m',
  red:     '\x1b[91m',
  magenta: '\x1b[95m',
  blue:    '\x1b[94m',
  orange:  '\x1b[33m',

  // Fondos
  bgGreen:   '\x1b[42m',
  bgRed:     '\x1b[41m',
  bgYellow:  '\x1b[43m',
  bgBlue:    '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan:    '\x1b[46m',
  bgGray:    '\x1b[100m',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timestamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function pad(str, len) {
  return String(str || '').substring(0, len).padEnd(len)
}

// Tabla de módulos: icono + color
const MODULOS = {
  AUTH:       { icon: '🔐', color: C.cyan    },
  PERMISOS:   { icon: '📋', color: C.blue    },
  'H-EXTRAS': { icon: '⏱️ ', color: C.magenta },
  PQR:        { icon: '📩', color: C.orange  },
  RADICADOS:  { icon: '📁', color: C.yellow  },
  SISTEMA:    { icon: '⚙️ ', color: C.gray   },
  DB:         { icon: '🗄️ ', color: C.gray   },
  SERVER:     { icon: '🚀', color: C.green   },
}

// ─── Formateador de línea de log ─────────────────────────────────────────────
function formatLine(nivel, modulo, accion, detalle = '') {
  const ts    = `${C.dim}${C.gray}[${timestamp()}]${C.reset}`
  const mod   = MODULOS[modulo] || { icon: '•', color: C.white }
  const modStr = `${mod.color}${C.bold}${pad(modulo, 9)}${C.reset}`
  const actStr = `${C.bold}${pad(accion, 12)}${C.reset}`
  const det   = detalle ? `${C.dim}${detalle}${C.reset}` : ''

  // Símbolo según nivel
  let sym
  switch (nivel) {
    case 'SUCCESS': sym = `${C.green}✅${C.reset}`; break
    case 'INFO':    sym = `${C.cyan}ℹ️ ${C.reset}`; break
    case 'WARN':    sym = `${C.yellow}⚠️ ${C.reset}`; break
    case 'ERROR':   sym = `${C.red}🚨${C.reset}`; break
    case 'ACTION':  sym = `${C.blue}▶️ ${C.reset}`; break
    case 'DELETE':  sym = `${C.red}🗑️ ${C.reset}`; break
    case 'UPDATE':  sym = `${C.yellow}✏️ ${C.reset}`; break
    case 'HTTP':    sym = `${C.gray}→ ${C.reset}`; break
    default:        sym = `${C.gray}•  ${C.reset}`
  }

  const sep = `${C.dim}│${C.reset}`
  return `${ts} ${sym} ${modStr} ${sep} ${actStr} ${sep} ${det}`
}

// ─── API Pública del Logger ───────────────────────────────────────────────────
const logger = {
  /**
   * Log de éxito general
   * @param {string} modulo - Nombre del módulo (AUTH, PERMISOS, etc.)
   * @param {string} accion - Nombre de la acción (LOGIN, CREAR, etc.)
   * @param {string} detalle - Texto libre de contexto
   */
  success(modulo, accion, detalle = '') {
    console.log(formatLine('SUCCESS', modulo, accion, detalle))
  },

  /**
   * Log informativo
   */
  info(modulo, accion, detalle = '') {
    console.log(formatLine('INFO', modulo, accion, detalle))
  },

  /**
   * Log de advertencia
   */
  warn(modulo, accion, detalle = '') {
    console.warn(formatLine('WARN', modulo, accion, detalle))
  },

  /**
   * Log de error crítico
   */
  error(modulo, accion, detalle = '') {
    console.error(formatLine('ERROR', modulo, accion, detalle))
  },

  /**
   * Log de acción creación/registro
   */
  create(modulo, accion, detalle = '') {
    console.log(formatLine('ACTION', modulo, accion, detalle))
  },

  /**
   * Log de actualización
   */
  update(modulo, accion, detalle = '') {
    console.log(formatLine('UPDATE', modulo, accion, detalle))
  },

  /**
   * Log de eliminación
   */
  delete(modulo, accion, detalle = '') {
    console.log(formatLine('DELETE', modulo, accion, detalle))
  },

  /**
   * Log de una petición HTTP entrante (usado por el middleware de auditoría)
   * @param {string} method - Método HTTP
   * @param {string} ruta - Ruta solicitada
   * @param {number} status - Código de respuesta
   * @param {number} ms - Tiempo en milisegundos
   * @param {string} usuario - Email del usuario (o 'anónimo')
   */
  http(method, ruta, status, ms, usuario = 'anónimo') {
    const statusColor = status >= 500 ? C.red
                      : status >= 400 ? C.yellow
                      : status >= 300 ? C.cyan
                      : C.green

    const methodPad = pad(method, 6)
    const statusStr = `${statusColor}${C.bold}${status}${C.reset}`
    const msStr     = `${C.dim}${ms}ms${C.reset}`
    const userStr   = `${C.dim}${usuario}${C.reset}`
    const rutaStr   = `${C.white}${ruta}${C.reset}`

    const ts = `${C.dim}${C.gray}[${timestamp()}]${C.reset}`
    console.log(
      `${ts} ${C.gray}→ ${C.reset}` +
      `${C.bold}${methodPad}${C.reset} ${rutaStr}  ` +
      `${statusStr}  ${msStr}  ${userStr}`
    )
  },

  /**
   * Separador visual para inicio del servidor
   */
  banner(mensaje) {
    const linea = '═'.repeat(50)
    console.log(`\n${C.cyan}${C.bold}${linea}${C.reset}`)
    console.log(`${C.cyan}${C.bold}  ${mensaje}${C.reset}`)
    console.log(`${C.cyan}${C.bold}${linea}${C.reset}\n`)
  },

  /**
   * Log de inicio del servidor con detalles
   */
  startup(puerto, entorno = 'development') {
    const linea = '═'.repeat(50)
    const envColor = entorno === 'production' ? C.green : C.yellow
    console.log(`\n${C.cyan}${linea}${C.reset}`)
    console.log(`${C.cyan}${C.bold}  🚀 ACUASAN E.S.P. — SERVIDOR OPERATIVO${C.reset}`)
    console.log(`${C.cyan}  📡 API:     ${C.white}http://localhost:${puerto}${C.reset}`)
    console.log(`${C.cyan}  🌍 Entorno: ${envColor}${C.bold}${entorno.toUpperCase()}${C.reset}`)
    console.log(`${C.cyan}  🕐 Hora:    ${C.white}${new Date().toLocaleString('es-CO')}${C.reset}`)
    console.log(`${C.cyan}${linea}${C.reset}\n`)
  },

  /**
   * Log de línea divisoria entre secciones
   */
  divider(etiqueta = '') {
    const linea = '─'.repeat(40)
    if (etiqueta) {
      console.log(`${C.dim}${linea} ${etiqueta} ${linea}${C.reset}`)
    } else {
      console.log(`${C.dim}${linea}${C.reset}`)
    }
  }
}

export default logger
