const API_URL = 'http://localhost:3000';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const radicadoForm        = document.getElementById('radicadoForm');
const radicadosTableBody  = document.getElementById('radicadosTableBody');
const searchInput         = document.getElementById('searchInput');
const filterEstado        = document.getElementById('filterEstado');
const btnVerHistorial     = document.getElementById('btnVerHistorial');
const btnVerAlertas       = document.getElementById('btnVerAlertas');
const btnSincronizarDrive = document.getElementById('btnSincronizarDrive');
const btnDescargarExcel   = document.getElementById('btnDescargarExcel');
const pdfInput            = document.getElementById('pdfInput');
const pdfStatusMsg        = document.getElementById('pdfStatusMsg');
const pdfEmptyState       = document.getElementById('pdfEmptyState');
const pdfPreviewFrame     = document.getElementById('pdfPreviewFrame');
const pdfResumenExtraccion= document.getElementById('pdfResumenExtraccion');
const historialSection    = document.getElementById('historialSection');
const alertasPanel        = document.getElementById('alertasPanel');
const alertCountBadge     = document.getElementById('alertCountBadge');
const docModal            = document.getElementById('docModal');
const bannerCamposPendientes = document.getElementById('bannerCamposPendientes');

let todosLosRadicados = [];
let archivoNombreAdjunto = null;
let pdfCargado = false; // Flag: se ha intentado extraer un PDF

// ═════════════════════════════════════════════════════════════════════════════
// DEFINICIÓN DE LOS CAMPOS DEL FORMULARIO
// Cada entrada tiene: id del input, etiqueta legible, si es requerido por el PDF
// ═════════════════════════════════════════════════════════════════════════════
const CAMPOS_PDF = [
  { id: 'numeroRadicadoPdf', label: 'N° Radicado PDF',             requerido: true  },
  { id: 'fechaDocumento',    label: 'Fecha / Hora del Sello',       requerido: true  },
  { id: 'lugarFecha',        label: 'Lugar y Fecha de la Carta',    requerido: true  },
  { id: 'peticionario',      label: 'Remitente / Peticionario',     requerido: true  },
  { id: 'dependencia',       label: 'Empresa Destinataria',         requerido: true  },
  { id: 'destinatario',      label: 'Destinatario (Funcionario)',   requerido: true  },
  { id: 'asunto',            label: 'Asunto',                       requerido: true  },
  { id: 'referencia',        label: 'Referencia',                   requerido: true  },
  { id: 'contexto',          label: 'Contexto / Observaciones',     requerido: false },
  { id: 'registradoPor',     label: 'Registrado Por (Responsable)', requerido: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// SISTEMA DE ESTADO DE CAMPOS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Aplica el estado visual a un campo del formulario.
 * @param {string} campoId  - id del input
 * @param {'ok'|'pending'|'none'} estado
 * @param {string} [mensajeAviso] - texto del aviso bajo el input
 */
function setCampoEstado(campoId, estado, mensajeAviso = '') {
  const fg   = document.getElementById(`fg-${campoId}`);
  const ico  = document.getElementById(`ico-${campoId}`);
  const aviso= document.getElementById(`aviso-${campoId}`);
  const input= document.getElementById(campoId);

  if (!fg || !input) return;

  // Quitar clases anteriores
  fg.classList.remove('campo-ok', 'campo-pendiente', 'campo-neutral');
  input.classList.remove('input-ok', 'input-pendiente');

  if (estado === 'ok') {
    fg.classList.add('campo-ok');
    input.classList.add('input-ok');
    if (ico) ico.textContent = '✅';
    if (aviso) { aviso.textContent = ''; aviso.className = 'campo-aviso'; }
  } else if (estado === 'pending') {
    fg.classList.add('campo-pendiente');
    input.classList.add('input-pendiente');
    if (ico) ico.textContent = '⚠️';
    if (aviso) {
      aviso.textContent = mensajeAviso || '⚠️ Campo no detectado en el PDF — complétalo manualmente';
      aviso.className = 'campo-aviso aviso-visible';
    }
  } else {
    fg.classList.add('campo-neutral');
    if (ico) ico.textContent = '';
    if (aviso) { aviso.textContent = ''; aviso.className = 'campo-aviso'; }
  }
}

/** Resetea todos los campos a estado neutral (sin PDF cargado) */
function resetearEstadosCampos() {
  CAMPOS_PDF.forEach(c => setCampoEstado(c.id, 'none'));
  bannerCamposPendientes.style.display = 'none';
  pdfResumenExtraccion.style.display   = 'none';
}

/**
 * Aplica los estados visuales a todos los campos según los datos extraídos del PDF.
 * @param {Object} data - respuesta del backend /extraer-pdf
 */
function aplicarEstadosCampos(data) {
  const mapa = {
    numeroRadicadoPdf: data.numeroRadicadoPdf,
    fechaDocumento:    data.fechaDocumento,
    lugarFecha:        data.lugarFecha,
    peticionario:      data.peticionario,
    dependencia:       data.dependencia,
    destinatario:      data.destinatario,
    asunto:            data.asunto,
    referencia:        data.referencia,
    contexto:          data.contexto,
    registradoPor:     data.registradoPor,
    correoDrive:       '', // nunca viene del PDF; siempre manual
  };

  const pendientes = [];

  CAMPOS_PDF.forEach(campo => {
    const valor = mapa[campo.id];
    if (valor && valor.trim && valor.trim() !== '') {
      setCampoEstado(campo.id, 'ok');
    } else {
      if (campo.id === 'registradoPor') {
        setCampoEstado(campo.id, 'pending', '✏️ Indica quién está registrando el radicado');
      } else {
        setCampoEstado(campo.id, 'pending');
        pendientes.push(campo.label);
      }
    }
  });

  // Mostrar banner si hay campos pendientes del PDF
  if (pendientes.length > 0) {
    bannerCamposPendientes.style.display = 'flex';
    document.getElementById('bannerTitulo').textContent =
      `⚠️ ${pendientes.length} campo${pendientes.length > 1 ? 's' : ''} no detectado${pendientes.length > 1 ? 's' : ''} en el PDF`;
    document.getElementById('bannerDetalle').innerHTML =
      pendientes.map(p => `<span class="banner-campo-tag">📌 ${p}</span>`).join('');
  } else {
    bannerCamposPendientes.style.display = 'none';
  }

  // Mostrar resumen de extracción
  mostrarResumenExtraccion(data, pendientes);
}

/** Muestra el panel resumen de qué se extrajo */
function mostrarResumenExtraccion(data, pendientes) {
  const total     = CAMPOS_PDF.filter(c => !['correoDrive','registradoPor'].includes(c.id)).length;
  const encontrados = total - pendientes.length;
  const pct       = Math.round((encontrados / total) * 100);

  const resumen = document.getElementById('pdfResumenExtraccion');
  const icono   = document.getElementById('resumenIcono');
  const texto   = document.getElementById('resumenTexto');
  const campos  = document.getElementById('resumenCampos');

  resumen.style.display = 'block';

  if (pct === 100) {
    icono.textContent = '✅';
    texto.textContent = `¡Extracción completa! Los ${total} campos fueron detectados.`;
    resumen.className = 'pdf-resumen-extraccion resumen-completo';
  } else if (pct >= 60) {
    icono.textContent = '⚠️';
    texto.textContent = `${encontrados} de ${total} campos detectados (${pct}%). Completa los marcados en rojo.`;
    resumen.className = 'pdf-resumen-extraccion resumen-parcial';
  } else {
    icono.textContent = '🔴';
    texto.textContent = `Solo ${encontrados} de ${total} campos detectados. El PDF puede ser imagen o escaneado. Completa los campos en rojo.`;
    resumen.className = 'pdf-resumen-extraccion resumen-bajo';
  }

  // Barra de progreso
  campos.innerHTML = `
    <div class="resumen-barra-wrap">
      <div class="resumen-barra" style="width:${pct}%"></div>
    </div>
    <div class="resumen-lista">
      ${CAMPOS_PDF.filter(c => !['correoDrive','registradoPor'].includes(c.id)).map(c => {
        const val = {
          numeroRadicadoPdf: data.numeroRadicadoPdf,
          fechaDocumento: data.fechaDocumento,
          lugarFecha: data.lugarFecha,
          peticionario: data.peticionario,
          dependencia: data.dependencia,
          destinatario: data.destinatario,
          asunto: data.asunto,
          referencia: data.referencia,
          contexto: data.contexto,
        }[c.id];
        const ok = val && val.trim && val.trim() !== '';
        return `<span class="resumen-campo-tag ${ok ? 'tag-ok' : 'tag-falta'}">${ok ? '✅' : '❌'} ${c.label}</span>`;
      }).join('')}
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
// COLORES DE VENCIMIENTO
// ═════════════════════════════════════════════════════════════════════════════
function calcularDiasRestantes(fechaVencimiento) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const venc = new Date(fechaVencimiento); venc.setHours(0,0,0,0);
  return Math.ceil((venc - hoy) / 86400000);
}

function getVencimientoInfo(dias, estado) {
  if (estado === 'Resuelto') return { rowClass:'row-resuelto', badgeClass:'badge badge-done',     label:'✓ Resuelto',                                        icon:'✅' };
  if (dias <= 0)  return { rowClass:'row-vencido',  badgeClass:'badge badge-vencido',  label: dias===0 ? '🔴 Vence HOY':`🔴 Venció hace ${Math.abs(dias)} día(s)`, icon:'🔴' };
  if (dias <= 3)  return { rowClass:'row-critico',  badgeClass:'badge badge-critico',  label:`🟠 Crítico: ${dias} día(s)`,  icon:'🟠' };
  if (dias <= 7)  return { rowClass:'row-urgente',  badgeClass:'badge badge-urgente',  label:`🟡 Urgente: ${dias} días`,    icon:'🟡' };
  if (dias <= 15) return { rowClass:'row-atencion', badgeClass:'badge badge-atencion', label:`🔵 ${dias} días restantes`,   icon:'🔵' };
  return              { rowClass:'row-normal',   badgeClass:'badge badge-normal',   label:`🟢 ${dias} días restantes`,   icon:'🟢' };
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN Y CONTROL DE SESIÓN (ACUASAN)
// ═════════════════════════════════════════════════════════════════════════════
const API_LOGIN_URL = 'http://localhost:3000/api/auth/login';

/**
 * Función para iniciar sesión desde Radicados usando el backend de Acuasan
 * @param {string} email - Correo del usuario
 * @param {string} password - Contraseña del usuario
 */
async function iniciarSesion(email, password) {
  const errorMsg = document.getElementById('loginErrorMsg');
  if (errorMsg) errorMsg.style.display = 'none';

  try {
    const respuesta = await fetch(API_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });
    const resultado = await respuesta.json();

    if (resultado.success) {
      // 1. Guardar el Token JWT y los datos del usuario en localStorage
      localStorage.setItem('token', resultado.data.token);
      localStorage.setItem('usuario', JSON.stringify(resultado.data.usuario));
      console.log('✅ Inicio de sesión exitoso:', resultado.data.usuario);
      mostrarNotificacion(`Bienvenido, ${resultado.data.usuario.nombre}`, 'success');
      verificarSesion();
    } else {
      // Error de autenticación
      const msg = resultado.message || 'Error al iniciar sesión';
      if (errorMsg) {
        errorMsg.textContent = `⚠️ ${msg}`;
        errorMsg.style.display = 'block';
      } else {
        mostrarNotificacion(msg, 'error');
      }
    }
  } catch (error) {
    console.error('❌ Error al conectar con la API de Acuasan:', error);
    if (errorMsg) {
      errorMsg.textContent = '⚠️ No se pudo conectar con el servidor de autenticación de Acuasan.';
      errorMsg.style.display = 'block';
    } else {
      mostrarNotificacion('No se pudo conectar con el servidor de autenticación de Acuasan.', 'error');
    }
  }
}

function verificarSesion() {
  const token = localStorage.getItem('token');
  const usuarioRaw = localStorage.getItem('usuario');
  const loginScreen = document.getElementById('loginScreen');
  const appMainContainer = document.getElementById('appMainContainer');
  const userSessionPill = document.getElementById('userSessionPill');
  const userSessionName = document.getElementById('userSessionName');
  const registradoPor = document.getElementById('registradoPor');

  if (token && usuarioRaw) {
    try {
      const usuario = JSON.parse(usuarioRaw);
      if (userSessionName) userSessionName.textContent = `👤 ${usuario.nombre}`;
      if (userSessionPill) userSessionPill.style.display = 'inline-flex';
      if (loginScreen) loginScreen.style.display = 'none';
      if (appMainContainer) appMainContainer.style.display = 'block';
      if (registradoPor && !registradoPor.value) registradoPor.value = usuario.nombre;
      return true;
    } catch(e){}
  }

  // Si no hay sesión válida: Mostrar pantalla completa de Login y ocultar la aplicación
  if (userSessionPill) userSessionPill.style.display = 'none';
  if (appMainContainer) appMainContainer.style.display = 'none';
  if (loginScreen) loginScreen.style.display = 'flex';
  return false;
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  mostrarNotificacion('Sesión cerrada correctamente', 'info');
  verificarSesion();
}

function togglePasswordVisibility() {
  const input = document.getElementById('password');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  verificarSesion();

  // --- ESCUCHAR SUBMIT DEL FORMULARIO DE LOGIN ---
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      await iniciarSesion(email, password);
    });
  }

  cargarRadicados();
  radicadoForm.addEventListener('submit', guardarRadicado);
  searchInput.addEventListener('input', filtrarTabla);
  filterEstado.addEventListener('change', filtrarTabla);
  btnSincronizarDrive.addEventListener('click', sincronizarDrive);
  if (btnVerHistorial)   btnVerHistorial.addEventListener('click', toggleHistorial);
  if (btnDescargarExcel) btnDescargarExcel.addEventListener('click', descargarExcel);
  if (btnVerAlertas)     btnVerAlertas.addEventListener('click', toggleAlertas);
  pdfInput.addEventListener('change', procesarArchivoPdf);

  // Cuando el usuario corrige un campo pendiente, quitar el aviso
  CAMPOS_PDF.forEach(c => {
    const el = document.getElementById(c.id);
    if (el) {
      el.addEventListener('input', () => {
        if (pdfCargado && el.value.trim() !== '') {
          setCampoEstado(c.id, 'ok');
          actualizarBannerPendientes();
        }
      });
    }
  });
});

function actualizarBannerPendientes() {
  if (!pdfCargado) return;
  const pendientes = CAMPOS_PDF
    .filter(c => !['correoDrive','registradoPor'].includes(c.id))
    .filter(c => {
      const el = document.getElementById(c.id);
      return !el || !el.value.trim();
    });

  if (pendientes.length > 0) {
    bannerCamposPendientes.style.display = 'flex';
    document.getElementById('bannerTitulo').textContent =
      `⚠️ ${pendientes.length} campo${pendientes.length > 1 ? 's' : ''} sin completar`;
    document.getElementById('bannerDetalle').innerHTML =
      pendientes.map(p => `<span class="banner-campo-tag">📌 ${p.label}</span>`).join('');
  } else {
    bannerCamposPendientes.style.display = 'none';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CARGAR RADICADOS
// ═════════════════════════════════════════════════════════════════════════════
async function cargarRadicados() {
  try {
    const r = await fetch(`${API_URL}/radicados`);
    if (!r.ok) throw new Error();
    todosLosRadicados = await r.json();
    actualizarIndicadorAlertas();
    filtrarTabla();
  } catch {
    radicadosTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell" style="color:#ef4444;">⚠️ Servidor backend inactivo en http://localhost:3000. Inicia 'npm run dev' en rad/backend.</td></tr>`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// INDICADOR DE ALERTAS
// ═════════════════════════════════════════════════════════════════════════════
function actualizarIndicadorAlertas() {
  const criticos = todosLosRadicados.filter(r => r.estado === 'Pendiente' && calcularDiasRestantes(r.fechaVencimiento) <= 7);
  if (criticos.length > 0) {
    alertCountBadge.textContent = criticos.length;
    alertCountBadge.style.display = 'inline-flex';
    btnVerAlertas.classList.add('has-alerts');
  } else {
    alertCountBadge.style.display = 'none';
    btnVerAlertas.classList.remove('has-alerts');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PANEL DE ALERTAS
// ═════════════════════════════════════════════════════════════════════════════
function toggleAlertas() {
  if (alertasPanel.style.display === 'none' || !alertasPanel.style.display) {
    renderAlertas(); alertasPanel.style.display = 'block';
    alertasPanel.scrollIntoView({ behavior:'smooth' });
  } else {
    alertasPanel.style.display = 'none';
  }
}

function renderAlertas() {
  const pendientes = todosLosRadicados
    .filter(r => r.estado === 'Pendiente')
    .map(r => ({ ...r, dias: calcularDiasRestantes(r.fechaVencimiento) }))
    .sort((a,b) => a.dias - b.dias);

  const container = document.getElementById('alertasListContainer');
  if (pendientes.length === 0) {
    container.innerHTML = `<div class="alertas-empty"><span style="font-size:2rem;">✅</span><p>No hay radicados pendientes. ¡Todo al día!</p></div>`;
    return;
  }
  container.innerHTML = pendientes.map(r => {
    const info = getVencimientoInfo(r.dias, r.estado);
    const fv   = new Date(r.fechaVencimiento).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});
    const np   = r.numeroRadicadoPdf ? ` | PDF: ${r.numeroRadicadoPdf}` : '';
    return `
      <div class="alerta-item ${info.rowClass}">
        <div class="alerta-icon">${info.icon}</div>
        <div class="alerta-body">
          <div class="alerta-codigo">${r.numeroRadicado}${np}</div>
          <div class="alerta-detalle"><strong>${r.peticionario}</strong> — ${r.dependencia}</div>
          ${r.asunto ? `<div class="alerta-asunto">📌 ${r.asunto}</div>` : ''}
          <div class="alerta-meta">Vence: ${fv} | Responsable: ${r.registradoPor || 'Encargada'}</div>
        </div>
        <div class="alerta-badge-wrap"><span class="${info.badgeClass}">${info.label}</span></div>
      </div>`;
  }).join('');
}

// ═════════════════════════════════════════════════════════════════════════════
// HISTORIAL
// ═════════════════════════════════════════════════════════════════════════════
function toggleHistorial() {
  if (historialSection.style.display === 'none' || !historialSection.style.display) {
    historialSection.style.display = 'block';
    filterEstado.value = ''; searchInput.value = '';
    filtrarTabla();
    historialSection.scrollIntoView({ behavior:'smooth' });
  } else {
    historialSection.style.display = 'none';
  }
}
function descargarExcel() { window.location.href = `${API_URL}/descargar-excel`; }

// ═════════════════════════════════════════════════════════════════════════════
// EXTRACCIÓN DE PDF  ← NÚCLEO DE LA FUNCIONALIDAD
// ═════════════════════════════════════════════════════════════════════════════
async function procesarArchivoPdf(e) {
  const file = e.target.files[0];
  if (!file) return;
  archivoNombreAdjunto = file.name;
  pdfCargado = false;

  // Previsualizar
  try {
    pdfPreviewFrame.src = URL.createObjectURL(file);
    pdfPreviewFrame.style.display = 'block';
    pdfEmptyState.style.display   = 'none';
  } catch (err) { console.error(err); }

  // Estado: analizando
  setPdfStatus('info', `⏳ Analizando "${file.name}"... extrayendo todos los campos del radicado`);
  resetearEstadosCampos();

  const formData = new FormData();
  formData.append('archivoPdf', file);

  try {
    const response = await fetch(`${API_URL}/extraer-pdf`, { method:'POST', body:formData });
    const data = await response.json();

    if (!response.ok) {
      setPdfStatus('error', `⚠️ ${data.error || 'Error al procesar el archivo PDF'}`);
      return;
    }

    pdfCargado = true;

    // ── 1. Llenar todos los campos del formulario ──────────────────────────
    setVal('numeroRadicadoPdf', data.numeroRadicadoPdf);
    setVal('fechaDocumento',    data.fechaDocumento);
    setVal('lugarFecha',        data.lugarFecha);
    setVal('peticionario',      data.peticionario);
    setVal('dependencia',       data.dependencia);
    setVal('destinatario',      data.destinatario);
    setVal('asunto',            data.asunto);
    setVal('referencia',        data.referencia);
    setVal('contexto',          data.contexto);
    setVal('registradoPor',     data.registradoPor);

    if (data.diasParaVencer) {
      const selDias = document.getElementById('diasParaVencer');
      if (selDias) selDias.value = String(data.diasParaVencer);
    }

    // ── 2. Aplicar estado visual a cada campo ──────────────────────────────
    aplicarEstadosCampos(data);

    // ── 3. Mensaje de estado general ──────────────────────────────────────
    const vacios = CAMPOS_PDF.filter(c => {
      if (['correoDrive','registradoPor'].includes(c.id)) return false;
      const el = document.getElementById(c.id);
      return !el || !el.value.trim();
    }).length;

    if (vacios === 0) {
      setPdfStatus('success', `✅ ¡Extracción completa! Todos los campos fueron detectados en "${file.name}". Revisa y guarda.`);
    } else {
      setPdfStatus('warning', `⚠️ PDF analizado. <strong>${vacios} campo${vacios>1?'s':''}</strong> no ${vacios>1?'pudieron':'pudo'} detectarse — están marcados en <strong style="color:#991b1b;">rojo</strong> para que los completes.`);
    }

  } catch (err) {
    console.error(err);
    setPdfStatus('error', '⚠️ No se pudo procesar el PDF. Puede ser un archivo escaneado o protegido. Completa los campos marcados manualmente.');
    // Marcar todos como pendientes cuando falla la extracción
    pdfCargado = true;
    CAMPOS_PDF.forEach(c => {
      if (c.id === 'correoDrive') setCampoEstado(c.id, 'pending', '✏️ Ingresa el correo destino manualmente');
      else if (c.id === 'registradoPor') setCampoEstado(c.id, 'pending', '✏️ Indica quién está registrando el radicado');
      else setCampoEstado(c.id, 'pending');
    });
    const todos = CAMPOS_PDF.filter(c => !['correoDrive','registradoPor'].includes(c.id)).map(c => c.label);
    bannerCamposPendientes.style.display = 'flex';
    document.getElementById('bannerTitulo').textContent = '⚠️ No se detectaron campos — completa todos manualmente';
    document.getElementById('bannerDetalle').innerHTML = todos.map(l => `<span class="banner-campo-tag">📌 ${l}</span>`).join('');
  }
}

function setPdfStatus(tipo, html) {
  pdfStatusMsg.style.display = 'block';
  const estilos = {
    info:    { bg:'#e0f2fe', color:'#0369a1' },
    success: { bg:'#dcfce7', color:'#15803d' },
    warning: { bg:'#fff7ed', color:'#c2410c' },
    error:   { bg:'#fee2e2', color:'#991b1b' },
  };
  const s = estilos[tipo] || estilos.info;
  pdfStatusMsg.style.background = s.bg;
  pdfStatusMsg.style.color      = s.color;
  pdfStatusMsg.innerHTML        = html;
}

// ── Helpers ──
function setVal(id, valor) {
  const el = document.getElementById(id);
  if (el && valor && valor.trim && valor.trim() !== '') el.value = valor;
}

// ═════════════════════════════════════════════════════════════════════════════
// FILTRAR TABLA
// ═════════════════════════════════════════════════════════════════════════════
function filtrarTabla() {
  const query  = searchInput.value.toLowerCase().trim();
  const estado = filterEstado.value;
  const filtrados = todosLosRadicados.filter(r => {
    const campos = [r.numeroRadicado,r.numeroRadicadoPdf,r.peticionario,r.dependencia,
      r.destinatario,r.asunto,r.referencia,r.registradoPor,r.correoDrive,r.contexto].map(v=>(v||'').toLowerCase());
    return (!query || campos.some(c=>c.includes(query))) && (!estado || r.estado===estado);
  });
  renderTabla(filtrados);
}

// ═════════════════════════════════════════════════════════════════════════════
// RENDERIZAR TABLA
// ═════════════════════════════════════════════════════════════════════════════
function renderTabla(radicados) {
  if (radicados.length === 0) {
    radicadosTableBody.innerHTML = `<tr><td colspan="9" class="loading-cell">No hay radicados registrados.</td></tr>`;
    return;
  }
  radicados.sort((a,b) => new Date(b.fechaRadicacion) - new Date(a.fechaRadicacion));
  radicadosTableBody.innerHTML = radicados.map(r => {
    const dias   = calcularDiasRestantes(r.fechaVencimiento);
    const info   = getVencimientoInfo(dias, r.estado);
    const fv     = new Date(r.fechaVencimiento);
    const numPdf = r.numeroRadicadoPdf ? `<div><span class="code-badge pdf-num">${r.numeroRadicadoPdf}</span></div>` : '';
    const fDoc   = r.fechaDocumento ? `<div style="font-size:.7rem;color:#64748b;">${r.fechaDocumento}</div>` : '';
    const lF     = r.lugarFecha     ? `<div style="font-size:.7rem;color:#64748b;">${r.lugarFecha}</div>`     : '';
    const dest   = r.destinatario   ? `<div style="font-size:.72rem;color:#475569;margin-top:2px;">👤 ${r.destinatario}</div>` : '';
    const ref    = r.referencia     ? `<div style="font-size:.7rem;color:#64748b;margin-top:2px;">📎 ${r.referencia}</div>` : '';
    return `
      <tr class="${info.rowClass}">
        <td><div><span class="code-badge">${r.numeroRadicado}</span></div>${numPdf}</td>
        <td>${fDoc}${lF}</td>
        <td><strong>${r.peticionario}</strong></td>
        <td><div style="font-size:.75rem;font-weight:600;">${r.dependencia}</div>${dest}</td>
        <td>${r.asunto?`<div class="contexto-preview" title="${r.asunto}">${r.asunto}</div>`:'—'}${ref}</td>
        <td><strong style="color:#107c41;">👤 ${r.registradoPor||'Encargada'}</strong></td>
        <td>${r.estado==='Resuelto'?'<span class="badge badge-done">✓ Resuelto</span>':'<span class="badge badge-pendiente">⏳ Pendiente</span>'}</td>
        <td>
          <div><strong>${fv.toLocaleDateString()}</strong></div>
          <div style="margin-top:2px;"><span class="${info.badgeClass}">${info.label}</span></div>
        </td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button onclick="abrirModalDocumento('${r.id}')" class="btn-icon" style="background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;">👁️ Ver</button>
            ${r.estado==='Pendiente'
              ?`<button onclick="marcarResuelto('${r.id}')" class="btn-icon" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;">✅ Resolver</button>`
              :`<span style="font-size:.725rem;color:#64748b;font-weight:500;align-self:center;">✓ Finalizado</span>`}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL
// ═════════════════════════════════════════════════════════════════════════════
function abrirModalDocumento(id) {
  const rad = todosLosRadicados.find(r => r.id === id);
  if (!rad) return;
  const dias = calcularDiasRestantes(rad.fechaVencimiento);
  const info = getVencimientoInfo(dias, rad.estado);

  document.getElementById('modalNumeroRadicado').innerText  = `Documento Oficial ${rad.numeroRadicado}`;
  document.getElementById('modalFechaRadicacion').innerText = `Registrado: ${new Date(rad.fechaRadicacion).toLocaleString()}`;
  document.getElementById('stampDetails').innerText         = `${rad.numeroRadicado} | ESTADO: ${rad.estado.toUpperCase()}`;
  document.getElementById('modalNumeroRadPdf').innerText    = rad.numeroRadicadoPdf || '—';
  document.getElementById('modalFechaDocumento').innerText  = rad.fechaDocumento    || '—';
  document.getElementById('modalLugarFecha').innerText      = rad.lugarFecha        || '—';
  document.getElementById('modalPeticionario').innerText    = rad.peticionario;
  document.getElementById('modalDependencia').innerText     = rad.dependencia;
  document.getElementById('modalDestinatario').innerText    = rad.destinatario      || '—';
  document.getElementById('modalAsunto').innerText          = rad.asunto            || '—';
  document.getElementById('modalReferencia').innerText      = rad.referencia        || '—';
  document.getElementById('modalRegistradoPor').innerText   = rad.registradoPor     || 'Encargada';
  document.getElementById('modalFechaVencimiento').innerHTML= `${new Date(rad.fechaVencimiento).toLocaleDateString()} <span class="${info.badgeClass}">${info.label}</span>`;
  document.getElementById('modalContextoText').innerText    = rad.contexto          || 'Sin observaciones.';
  document.getElementById('paperCode').innerText            = rad.numeroRadicado;
  document.getElementById('paperNumPdf').innerText          = rad.numeroRadicadoPdf || '—';
  document.getElementById('paperRegistradoPor').innerText   = rad.registradoPor     || 'Encargada';
  document.getElementById('paperAsunto').innerText          = rad.asunto            || '—';
  docModal.style.display = 'flex';
}

function cerrarModalDocumento() { docModal.style.display = 'none'; }

// ═════════════════════════════════════════════════════════════════════════════
// GUARDAR RADICADO
// ═════════════════════════════════════════════════════════════════════════════
async function guardarRadicado(e) {
  e.preventDefault();

  // Verificar que los campos obligatorios estén llenos (los marcados como requeridos)
  const camposVaciosReq = CAMPOS_PDF.filter(c => c.requerido && ['peticionario','dependencia'].includes(c.id))
    .filter(c => { const el=document.getElementById(c.id); return !el||!el.value.trim(); });

  if (camposVaciosReq.length > 0) {
    mostrarNotificacion(`⚠️ Completa los campos obligatorios: ${camposVaciosReq.map(c=>c.label).join(', ')}`, 'error');
    return;
  }

  const get = id => (document.getElementById(id)||{}).value?.trim() || '';

  const payload = {
    peticionario:      get('peticionario'),
    dependencia:       get('dependencia'),
    registradoPor:     get('registradoPor'),
    contexto:          get('contexto'),
    diasParaVencer:    parseInt(get('diasParaVencer'), 10) || 10,
    archivoNombre:     archivoNombreAdjunto,
    numeroRadicadoPdf: get('numeroRadicadoPdf'),
    fechaDocumento:    get('fechaDocumento'),
    lugarFecha:        get('lugarFecha'),
    destinatario:      get('destinatario'),
    asunto:            get('asunto'),
    referencia:        get('referencia'),
  };

  const btnGuardar = document.getElementById('btnGuardar');
  btnGuardar.disabled = true;
  btnGuardar.innerHTML = '<span>⏳ Guardando...</span>';

  try {
    const response = await fetch(`${API_URL}/radicados`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (response.ok) {
      radicadoForm.reset();
      pdfPreviewFrame.src=''; pdfPreviewFrame.style.display='none';
      pdfEmptyState.style.display='flex'; pdfInput.value='';
      pdfStatusMsg.style.display='none'; pdfResumenExtraccion.style.display='none';
      bannerCamposPendientes.style.display='none';
      archivoNombreAdjunto=null; pdfCargado=false;
      resetearEstadosCampos();

      historialSection.style.display='block';
      mostrarNotificacion(`✅ Radicado <strong>${data.data.numeroRadicado}</strong> registrado exitosamente por <strong>${payload.registradoPor||'Sistema'}</strong>.`, 'success');
      await cargarRadicados();
      historialSection.scrollIntoView({ behavior:'smooth' });
    } else {
      mostrarNotificacion(`Error: ${data.error||'No se pudo guardar el radicado.'}`, 'error');
    }
  } catch {
    mostrarNotificacion('No se pudo comunicar con el servidor backend.', 'error');
  } finally {
    btnGuardar.disabled=false;
    btnGuardar.innerHTML='<span>➕ Guardar Radicado</span>';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MARCAR RESUELTO
// ═════════════════════════════════════════════════════════════════════════════
async function marcarResuelto(id) {
  try {
    const r = await fetch(`${API_URL}/radicados/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:'Resuelto'})});
    if (r.ok) await cargarRadicados();
  } catch(e){console.error(e);}
}

// ═════════════════════════════════════════════════════════════════════════════
// SINCRONIZAR DRIVE
// ═════════════════════════════════════════════════════════════════════════════
async function sincronizarDrive() {
  btnSincronizarDrive.disabled=true; btnSincronizarDrive.innerHTML='<span>⏳ Exportando...</span>';
  try {
    const r=await fetch(`${API_URL}/sincronizar-drive`,{method:'POST'});
    const d=await r.json();
    mostrarNotificacion(r.ok?`✅ ${d.mensaje}`:`⚠️ ${d.error}`,r.ok?'success':'error');
  } catch { mostrarNotificacion('No se pudo realizar la sincronización con Google Drive.','error'); }
  finally { btnSincronizarDrive.disabled=false; btnSincronizarDrive.innerHTML='<span>☁️ Exportar Excel Drive</span>'; }
}

// ═════════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION
// ═════════════════════════════════════════════════════════════════════════════
function mostrarNotificacion(mensaje, tipo='info') {
  let toast=document.getElementById('toastNotificacion');
  if (!toast) { toast=document.createElement('div'); toast.id='toastNotificacion'; document.body.appendChild(toast); }
  toast.className=`toast-notificacion toast-${tipo}`;
  toast.innerHTML=mensaje; toast.style.display='block'; toast.style.opacity='1';
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>{ toast.style.opacity='0'; setTimeout(()=>{toast.style.display='none';},400); },5000);
}

// ── Exponer globales ──
window.abrirModalDocumento      = abrirModalDocumento;
window.cerrarModalDocumento     = cerrarModalDocumento;
window.marcarResuelto           = marcarResuelto;
window.iniciarSesion            = iniciarSesion;
window.cerrarSesion             = cerrarSesion;
window.togglePasswordVisibility = togglePasswordVisibility;
