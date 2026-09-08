import { defineStore } from 'pinia'

/**
 * pqrStore — Estado global del módulo PQR (Pinia).
 *
 * Alertas de handoff: las llena socket.service.js al recibir
 * 'nueva_alerta_pqr' del backend; cualquier componente puede reaccionar
 * (badge en el menú, campana, panel del dashboard).
 */
export const usePqrStore = defineStore('pqr', {
  state: () => ({
    alertasPendientes: [], // Cola de ciudadanos solicitando atención humana
    metricasDashboard: {
      totalRecibidos: 0,
      pendientes: 0,
      enProceso: 0,
      resueltos: 0
    },
    pqrsRecientes: []
  }),
  actions: {
    agregarAlerta(alerta) {
      // Evitar duplicados por número de teléfono
      const existe = this.alertasPendientes.find(a => a.telefono === alerta.telefono)
      if (!existe) {
        this.alertasPendientes.push(alerta)
      }
    },
    removerAlerta(telefono) {
      this.alertasPendientes = this.alertasPendientes.filter(a => a.telefono !== telefono)
    },
    actualizarMetricas(nuevasMetricas) {
      this.metricasDashboard = nuevasMetricas
    },
    /**
     * Carga las PQR del backend (pqrService.obtenerTodas) y recalcula las
     * métricas del dashboard a partir del estado real de cada radicado.
     */
    cargarPqrs(pqrs) {
      this.pqrsRecientes = pqrs
      this.actualizarMetricas({
        totalRecibidos: pqrs.length,
        pendientes:  pqrs.filter(p => p.estado === 'ABIERTO').length,
        enProceso:   pqrs.filter(p => p.estado === 'EN_TRAMITE').length,
        resueltos:   pqrs.filter(p => p.estado === 'RESUELTO').length
      })
    }
  }
})
