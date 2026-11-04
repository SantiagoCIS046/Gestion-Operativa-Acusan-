// /api/radicados — módulo unificado (fusión Archivos + Radicados): gerencia
// dirige (crea/edita/importa/elimina) y el área responde con PDF.

import { cliente } from './cliente.js'

export const RadicadosAPI = {
  // Mismos filtros que el listado: ?area= (solo gerencia), ?q&estado&categoria&orden&dir
  listar: (params) => cliente.get('/radicados', params),

  // Detalle completo: datos, adjuntos (metadatos) y línea de tiempo
  obtener: (id) => cliente.get(`/radicados/${id}`),

  // Crear es multipart: campos del radicado + PDF original (obligatorio).
  // numeroRadicado vacío/ausente → el backend genera RAD-AÑO-#### consecutivo.
  // El campo del archivo se llama "archivo" (contrato del backend).
  crear: (datos, pdf) => {
    const formData = new FormData()
    if (datos.numeroRadicado) formData.append('numeroRadicado', datos.numeroRadicado)
    formData.append('asunto', datos.asunto)
    formData.append('descripcion', datos.descripcion)
    formData.append('remitente', datos.remitente)
    formData.append('tipo', datos.tipo)
    if (datos.categoria) formData.append('categoria', datos.categoria)
    formData.append('prioridad', datos.prioridad)
    formData.append('fechaRadicacion', datos.fechaRadicacion)
    if (datos.instrucciones) formData.append('instrucciones', datos.instrucciones)
    formData.append('areaId', datos.areaId)
    formData.append('encargadoId', datos.encargadoId)
    formData.append('fechaLimite', datos.fechaLimite)
    formData.append('archivo', pdf)
    return cliente.post('/radicados', undefined, { formData })
  },

  // Editar es solo metadatos del radicado (número, datos, área, encargado o plazos)
  actualizar: (id, datos) => cliente.put(`/radicados/${id}`, datos),

  // Eliminar el radicado y todo lo derivado (adjuntos, eventos, alertas);
  // solo gerencia
  eliminar: (id) => cliente.del(`/radicados/${id}`),

  // La respuesta del área es multipart: PDF + campos opcionales de la respuesta
  responder: (id, pdf, extra = {}) => {
    const formData = new FormData()
    formData.append('archivo', pdf)
    if (extra.observacionesRespuesta) formData.append('observacionesRespuesta', extra.observacionesRespuesta)
    if (extra.numeroOficioRespuesta) formData.append('numeroOficioRespuesta', extra.numeroOficioRespuesta)
    return cliente.post(`/radicados/${id}/responder`, undefined, { formData })
  },

  // Reabrir un radicado respondido (solo gerencia, motivo obligatorio);
  // con fechaLimite además RENUEVA el plazo en el mismo paso
  reabrir: (id, datos) => cliente.post(`/radicados/${id}/reabrir`, datos),

  // Reemplaza el PDF original (p. ej. el relleno de una importación)
  reemplazarPdf: (id, pdf) => {
    const formData = new FormData()
    formData.append('archivo', pdf)
    return cliente.post(`/radicados/${id}/pdf/radicado`, undefined, { formData })
  },

  // PDFs: /pdf/radicado (por defecto) | /pdf/respuesta
  verPdf: (id, tipo = 'radicado') =>
    cliente.descargar(`/radicados/${id}/pdf/${tipo === 'respuesta' ? 'respuesta' : 'radicado'}`),

  // Excel: exportar todo el inventario, plantilla de importación y carga masiva
  exportar: () => cliente.descargar('/radicados/export.xlsx'),
  plantilla: () => cliente.descargar('/radicados/plantilla.xlsx'),
  importar: (archivo) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    return cliente.post('/radicados/import', undefined, { formData })
  },
}

export default RadicadosAPI
