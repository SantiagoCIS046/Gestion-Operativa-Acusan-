/**
 * ============================================================================
 * SISTEMA GLOBAL DE NOTIFICACIONES — ACUASAN E.S.P.
 * ============================================================================
 * Servicio reactivo centralizado para gestionar notificaciones profesionales
 * (toasts flotantes) en toda la aplicación.
 *
 * Uso:
 *   import notificacionService from '@/services/notificacionService.js'
 *
 *   notificacionService.exito('Título', 'Mensaje descriptivo')
 *   notificacionService.error('Error', 'No se pudo completar la operación')
 *   notificacionService.advertencia('Atención', 'Revise los datos ingresados')
 *   notificacionService.info('Información', 'Proceso en ejecución')
 *   notificacionService.mostrar('success', 'Título', 'Mensaje', 6000)
 *   notificacionService.cerrar(id)
 * ============================================================================
 */
import { reactive } from "vue";

/** Estado reactivo global: stack de notificaciones activas */
const notificaciones = reactive([]);

/** Contador interno para generar IDs únicos */
let contadorId = 0;

/** Máximo de notificaciones simultáneas visibles en pantalla */
const MAX_VISIBLES = 5;

/**
 * Duración por defecto (ms) según severidad del mensaje.
 * Los errores permanecen más tiempo porque requieren lectura y acción.
 */
const DURACIONES = {
  success: 4500,
  info: 5000,
  warning: 6000,
  danger: 8000,
};

/**
 * Emite una notificación al stack global.
 * @param {string} tipo - 'success' | 'danger' | 'warning' | 'info'
 * @param {string} titulo - Encabezado breve de la notificación
 * @param {string} mensaje - Descripción detallada (opcional)
 * @param {number|null} duracion - Milisegundos visibles; null usa el valor por tipo
 * @returns {number} ID de la notificación (para cierre manual si se requiere)
 */
const mostrar = (tipo, titulo, mensaje = "", duracion = null) => {
  const id = ++contadorId;

  const notificacion = {
    id,
    tipo: ["success", "danger", "warning", "info"].includes(tipo)
      ? tipo
      : "info",
    titulo: titulo || "Notificación",
    mensaje,
    duracion: duracion ?? DURACIONES[tipo] ?? 5000,
    progreso: 100,
  };

  notificaciones.push(notificacion);

  // Auto-cierre con barra de progreso animada
  if (notificacion.duracion > 0) {
    const inicio = Date.now();
    const timer = setInterval(() => {
      const transcurrido = Date.now() - inicio;
      notificacion.progreso = Math.max(
        0,
        100 - (transcurrido / notificacion.duracion) * 100
      );
      if (transcurrido >= notificacion.duracion) {
        clearInterval(timer);
        cerrar(id);
      }
    }, 60);
  }

  // Limita la cantidad de notificaciones simultáneas
  while (notificaciones.length > MAX_VISIBLES) {
    cerrar(notificaciones[0].id);
  }

  return id;
};

/**
 * Cierra una notificación específica con animación de salida.
 * @param {number} id - ID de la notificación a cerrar
 */
const cerrar = (id) => {
  const idx = notificaciones.findIndex((n) => n.id === id);
  if (idx === -1) return;
  notificaciones.splice(idx, 1);
};

/** Cierra todas las notificaciones activas */
const cerrarTodas = () => {
  notificaciones.splice(0, notificaciones.length);
};

/* ==================== API SEMÁNTICA (RECOMENDADA) ==================== */

/** Notificación de operación exitosa @param {string} titulo @param {string} mensaje @param {number=} duracion */
const exito = (titulo, mensaje = "", duracion = null) =>
  mostrar("success", titulo, mensaje, duracion);

/** Notificación de error crítico @param {string} titulo @param {string} mensaje @param {number=} duracion */
const error = (titulo, mensaje = "", duracion = null) =>
  mostrar("danger", titulo, mensaje, duracion);

/** Notificación de advertencia @param {string} titulo @param {string} mensaje @param {number=} duracion */
const advertencia = (titulo, mensaje = "", duracion = null) =>
  mostrar("warning", titulo, mensaje, duracion);

/** Notificación informativa @param {string} titulo @param {string} mensaje @param {number=} duracion */
const info = (titulo, mensaje = "", duracion = null) =>
  mostrar("info", titulo, mensaje, duracion);

export default {
  notificaciones,
  mostrar,
  cerrar,
  cerrarTodas,
  exito,
  error,
  advertencia,
  info,
};
