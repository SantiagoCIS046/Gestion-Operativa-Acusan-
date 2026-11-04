// Sesión del módulo de vencimientos: usuario, rol y área.
//
// El authService sigue siendo el único dueño del login/logout y de las claves
// de localStorage; este composable lo expone reactivo y añade el refresco con
// GET /api/me (que trae el área poblada y datos frescos del rol).

import { computed } from 'vue'

import authService from '@/modules/auth/services/authService.js'
import { cliente } from '@/api/cliente.js'

export const ROL_ETIQUETA = {
  LIDER_GENERAL: 'Líder general',
  LIDER_AREA: 'Líder de área',
  USUARIO: 'Usuario',
}

const usuario = computed(() => authService.getUsuarioActual())
const estaAutenticado = computed(() => authService.estaAutenticado())

const rol = computed(() => usuario.value?.rol || null)
const areaId = computed(() => usuario.value?.areaId || null)
// `area` llega poblada tras refrescar() con /api/me; antes solo está areaId
const area = computed(() => usuario.value?.area || null)

const esLiderGeneral = computed(() => rol.value === 'LIDER_GENERAL')
const esLiderArea = computed(() => rol.value === 'LIDER_AREA')
const etiquetaRol = computed(() => ROL_ETIQUETA[rol.value] || rol.value || '')

/** Login (mismo fallback offline del authService) + refresco best-effort */
async function entrar(email, password) {
  const data = await authService.login(email, password)
  // Si el backend está arriba, completamos área/datos frescos; si no, seguimos
  await refrescar().catch(() => {})
  return data
}

/** Rehidrata la sesión desde la BD (rol, área, nombre al día) */
async function refrescar() {
  const perfil = await cliente.get('/me')
  authService.actualizarUsuario(perfil)
  return perfil
}

/** Cierra sesión (no navega: eso lo decide quien llama, p. ej. el layout) */
function salir() {
  authService.logout()
}

export function useSesion() {
  return {
    usuario,
    rol,
    areaId,
    area,
    estaAutenticado,
    esLiderGeneral,
    esLiderArea,
    etiquetaRol,
    entrar,
    refrescar,
    salir,
  }
}

export default useSesion
