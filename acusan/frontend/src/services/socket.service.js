import { io } from 'socket.io-client'
import { usePqrStore } from '../stores/pqrStore'

/**
 * socket.service.js — Singleton de WebSockets para las alertas PQR.
 *
 * Conecta contra el backend con el MISMO JWT del login (auth.token).
 * En desarrollo no hace falta VITE_BACKEND_URL: el proxy de Vite
 * (/socket.io con ws:true) lleva la conexión al backend local.
 * En producción (Vercel) definir VITE_BACKEND_URL = URL del backend
 * persistente (Railway/Render), porque los WebSockets no pasan por
 * funciones serverless.
 */
let socket = null

// En Vercel (serverless) el servidor socket.io jamás arranca (app.js lo
// guarda con !process.env.VERCEL): sin VITE_BACKEND_URL apuntando a un
// backend persistente, conectar solo produce el bucle infinito de
// reconexión "Error de conexión WS: server error". Mejor no conectar.
const serverlessSinBackend =
  !import.meta.env.VITE_BACKEND_URL &&
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.vercel.app')

export const conectarSocketPQR = (token) => {
  if (socket) return socket
  if (!token) return null
  if (serverlessSinBackend) return null

  const pqrStore = usePqrStore()

  socket = io(import.meta.env.VITE_BACKEND_URL || window.location.origin, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000
  })

  socket.on('connect', () => {
    console.log(`[Socket] Conectado como operador (${socket.id})`)
  })

  socket.on('nueva_alerta_pqr', (data) => {
    console.log('🚨 Alerta de Handoff recibida:', data.telefono)
    pqrStore.agregarAlerta(data)
  })

  socket.on('connect_error', (err) => {
    // Token expirado o backend caído: se reintentará solo (reconnection)
    console.error('Error de conexión WS:', err.message)
  })

  return socket
}

export const desconectarSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const obtenerSocket = () => socket
