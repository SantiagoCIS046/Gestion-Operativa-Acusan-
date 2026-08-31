<template>
  <div class="au-root">

    <!-- ══════════════════════════════════════════ -->
    <!-- HERO HEADER                               -->
    <!-- ══════════════════════════════════════════ -->
    <div class="au-hero">
      <div class="au-hero-left">
        <div class="au-hero-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <p class="au-hero-label">Panel de Administración</p>
          <h1 class="au-hero-title">Gestión de Usuarios</h1>
        </div>
      </div>
      <div class="au-hero-right">
        <div class="au-hero-meta">
          <span class="au-live-dot"></span>
          <span class="au-live-txt">Sistema en vivo</span>
        </div>
        <button class="btn-nuevo" @click="abrirModalCrear" id="btn-nuevo-usuario">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo Usuario
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ -->
    <!-- KPI CARDS                                 -->
    <!-- ══════════════════════════════════════════ -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-total">
        <div class="kpi-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-num">{{ usuarios.length }}</span>
          <span class="kpi-lbl">Usuarios totales</span>
        </div>
        <div class="kpi-bar kpi-bar-blue"></div>
      </div>

      <div class="kpi-card kpi-activo">
        <div class="kpi-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-num kpi-green">{{ usuariosActivos }}</span>
          <span class="kpi-lbl">Cuentas activas</span>
        </div>
        <div class="kpi-bar kpi-bar-green"></div>
      </div>

      <div class="kpi-card kpi-inactivo">
        <div class="kpi-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-num kpi-red">{{ usuariosInactivos }}</span>
          <span class="kpi-lbl">Cuentas inactivas</span>
        </div>
        <div class="kpi-bar kpi-bar-red"></div>
      </div>

      <div class="kpi-card kpi-roles">
        <div class="kpi-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <div class="kpi-body">
          <span class="kpi-num kpi-purple">{{ rolesUnicos }}</span>
          <span class="kpi-lbl">Roles distintos</span>
        </div>
        <div class="kpi-bar kpi-bar-purple"></div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ -->
    <!-- PANEL PRINCIPAL                           -->
    <!-- ══════════════════════════════════════════ -->
    <div class="au-panel">
      <!-- Toolbar -->
      <div class="au-toolbar">
        <div class="search-wrap">
          <svg class="search-ico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            v-model="busqueda"
            type="text"
            class="search-inp"
            placeholder="Buscar por nombre, email, rol o cargo…"
            id="au-busqueda"
          />
          <button v-if="busqueda" class="search-clear" @click="busqueda = ''">✕</button>
        </div>
        <div class="toolbar-right">
          <div class="view-switch">
            <button
              class="vswitch-btn"
              :class="{ 'vswitch-active': modoVista === 'cuadricula' }"
              @click="modoVista = 'cuadricula'"
              title="Vista en Cuadrícula"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span>Cuadrícula</span>
            </button>
            <button
              class="vswitch-btn"
              :class="{ 'vswitch-active': modoVista === 'tabla' }"
              @click="modoVista = 'tabla'"
              title="Vista en Tabla"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <span>Tabla</span>
            </button>
          </div>
          <span class="results-count">{{ usuariosFiltrados.length }} funcionario{{ usuariosFiltrados.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="cargando" class="au-state">
        <div class="state-spinner"></div>
        <p class="state-txt">Cargando directorio de usuarios…</p>
      </div>

      <!-- Error -->
      <div v-else-if="errorMsg" class="au-state au-state-error">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p class="state-txt">{{ errorMsg }}</p>
        <button class="btn-retry" @click="cargarUsuarios">Reintentar conexión</button>
      </div>

      <!-- ═════════════════════════════════════════════════════════════ -->
      <!-- VISTA EN CUADRÍCULA (GRID DE TARJETAS SIN SCROLL LATERAL)     -->
      <!-- ═════════════════════════════════════════════════════════════ -->
      <div v-else-if="modoVista === 'cuadricula'" class="au-grid-wrap">
        <div v-if="usuariosFiltrados.length === 0" class="empty-state-grid">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <p>Sin resultados para <strong>"{{ busqueda }}"</strong></p>
        </div>

        <div v-else class="au-cards-grid">
          <div
            v-for="u in usuariosFiltrados"
            :key="u.id"
            class="user-card"
            :class="{ 'card-inactiva': !u.activo }"
          >
            <!-- Barra de color superior por rol -->
            <div class="ucard-topbar" :class="rolBarClass(u.rol)"></div>

            <!-- Header de la tarjeta -->
            <div class="ucard-header">
              <div class="ucard-avatar-wrap">
                <div class="u-avatar-card" :class="avClass(u.rol)">
                  {{ iniciales(u.nombre) }}
                </div>
                <div class="ucard-user-info">
                  <h4 class="ucard-name" :title="u.nombre">{{ u.nombre }}</h4>
                  <span class="ucard-cedula" v-if="u.cedula">CC: {{ u.cedula }}</span>
                </div>
              </div>
              <span class="rol-chip" :class="rolClass(u.rol)">
                <span class="rol-dot"></span>
                {{ u.rol }}
              </span>
            </div>

            <!-- Cuerpo / Metadatos de la tarjeta -->
            <div class="ucard-body">
              <div class="ucard-item">
                <span class="ucard-label">Correo:</span>
                <span class="ucard-val ucard-email" :title="u.email">{{ u.email }}</span>
              </div>
              <div class="ucard-item">
                <span class="ucard-label">Cargo:</span>
                <span class="ucard-val ucard-cargo" :title="u.cargo">{{ u.cargo || 'Sin cargo asignado' }}</span>
              </div>
              <div class="ucard-item">
                <span class="ucard-label">Acceso:</span>
                <span class="ucard-val ucard-acceso">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {{ u.ultimoAcceso ? formatearFecha(u.ultimoAcceso) : 'Sin registro' }}
                </span>
              </div>
            </div>

            <!-- Footer / Toggle y Acciones -->
            <div class="ucard-footer">
              <button
                class="estado-toggle"
                :class="u.activo ? 'et-on' : 'et-off'"
                @click="toggleActivo(u)"
                :title="u.activo ? 'Clic para desactivar' : 'Clic para activar'"
              >
                <span class="et-track">
                  <span class="et-thumb"></span>
                </span>
                <span class="et-lbl">{{ u.activo ? 'Activo' : 'Inactivo' }}</span>
              </button>

              <div class="ucard-actions">
                <button class="act-btn act-edit" @click="abrirModalEditar(u)" title="Editar usuario">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
                <button
                  class="act-btn act-del"
                  @click="confirmarEliminar(u)"
                  :disabled="u.id === usuarioAdmin?.id"
                  title="Eliminar usuario"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═════════════════════════════════════════════════════════════ -->
      <!-- VISTA EN TABLA                                               -->
      <!-- ═════════════════════════════════════════════════════════════ -->
      <div v-else class="au-table-outer">
        <table class="au-table">
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              <th>Funcionario</th>
              <th>Correo Institucional</th>
              <th>Área / Rol</th>
              <th>Cargo</th>
              <th>Estado</th>
              <th>Último Acceso</th>
              <th class="th-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="usuariosFiltrados.length === 0" class="tr-empty">
              <td colspan="8">
                <div class="empty-state">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <p>Sin resultados para <strong>"{{ busqueda }}"</strong></p>
                </div>
              </td>
            </tr>
            <tr
              v-for="(u, idx) in usuariosFiltrados"
              :key="u.id"
              class="au-tr"
              :class="{ 'tr-inactivo': !u.activo }"
            >
              <td class="td-idx">{{ idx + 1 }}</td>

              <!-- Funcionario -->
              <td>
                <div class="user-cell">
                  <div class="u-avatar" :class="avClass(u.rol)">{{ iniciales(u.nombre) }}</div>
                  <div class="u-meta">
                    <span class="u-nombre" :title="u.nombre">{{ u.nombre }}</span>
                    <span class="u-cedula" v-if="u.cedula">CC: {{ u.cedula }}</span>
                  </div>
                </div>
              </td>

              <!-- Email -->
              <td class="td-email">
                <span class="email-pill" :title="u.email">{{ u.email }}</span>
              </td>

              <!-- Rol -->
              <td>
                <span class="rol-chip" :class="rolClass(u.rol)">
                  <span class="rol-dot"></span>
                  {{ u.rol }}
                </span>
              </td>

              <!-- Cargo -->
              <td class="td-cargo" :title="u.cargo">{{ u.cargo || '—' }}</td>

              <!-- Estado -->
              <td>
                <button
                  class="estado-toggle"
                  :class="u.activo ? 'et-on' : 'et-off'"
                  @click="toggleActivo(u)"
                  :title="u.activo ? 'Clic para desactivar' : 'Clic para activar'"
                >
                  <span class="et-track">
                    <span class="et-thumb"></span>
                  </span>
                  <span class="et-lbl">{{ u.activo ? 'Activo' : 'Inactivo' }}</span>
                </button>
              </td>

              <!-- Último acceso -->
              <td class="td-acceso">
                <div v-if="u.ultimoAcceso" class="acceso-cell">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {{ formatearFecha(u.ultimoAcceso) }}
                </div>
                <span v-else class="acceso-nunca">Sin acceso registrado</span>
              </td>

              <!-- Acciones -->
              <td class="th-center">
                <div class="actions-cell">
                  <button class="act-btn act-edit" @click="abrirModalEditar(u)" title="Editar usuario">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                  <button
                    class="act-btn act-del"
                    @click="confirmarEliminar(u)"
                    :disabled="u.id === usuarioAdmin?.id"
                    title="Eliminar usuario"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>


    <!-- ══════════════════════════════════════════ -->
    <!-- MODAL CREAR / EDITAR                      -->
    <!-- ══════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="modalVisible" class="modal-bg" @click.self="cerrarModal">
        <div class="modal-box">

          <!-- Header modal -->
          <div class="modal-hdr" :class="modoCrear ? 'modal-hdr-create' : 'modal-hdr-edit'">
            <div class="modal-hdr-left">
              <div class="modal-hdr-ico">
                <svg v-if="modoCrear" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </div>
              <div>
                <p class="modal-hdr-tag">{{ modoCrear ? 'Crear cuenta' : 'Editar cuenta' }}</p>
                <h3 class="modal-hdr-title">{{ modoCrear ? 'Nuevo Usuario del Sistema' : form.nombre || 'Editar Usuario' }}</h3>
              </div>
            </div>
            <button class="modal-x" @click="cerrarModal">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Cuerpo modal -->
          <div class="modal-content">
            <div class="form-grid">

              <!-- Nombre -->
              <div class="fgroup fgroup-full">
                <label class="flabel">Nombre completo <span class="req">*</span></label>
                <input v-model="form.nombre" type="text" class="finput" placeholder="Ej: Juan Pérez García" id="form-nombre" />
              </div>

              <!-- Email (solo crear) -->
              <div v-if="modoCrear" class="fgroup fgroup-full">
                <label class="flabel">Correo institucional <span class="req">*</span></label>
                <input v-model="form.email" type="email" class="finput" placeholder="correo@acuasan.com" id="form-email" />
              </div>

              <!-- Contraseña -->
              <div class="fgroup fgroup-full">
                <label class="flabel">
                  {{ modoCrear ? 'Contraseña' : 'Nueva contraseña' }}
                  <span class="req" v-if="modoCrear">*</span>
                  <span class="flabel-hint" v-else>— dejar vacío para no cambiar</span>
                </label>
                <div class="finput-pass">
                  <input v-model="form.password" :type="mostrarPassword ? 'text' : 'password'" class="finput" :placeholder="modoCrear ? 'Mínimo 6 caracteres' : '••••••••'" id="form-password" />
                  <button type="button" class="pass-eye" @click="mostrarPassword = !mostrarPassword">
                    <svg v-if="!mostrarPassword" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
              </div>

              <!-- Rol -->
              <div class="fgroup">
                <label class="flabel">Rol / Área de acceso <span class="req">*</span></label>
                <select v-model="form.rol" class="fselect" id="form-rol">
                  <option value="">— Seleccionar —</option>
                  <option value="ENCARGADO">ENCARGADO — Permisos & Horas Extras</option>
                  <option value="GERENCIA">GERENCIA — Supervisión General</option>
                  <option value="OPERATIVO">OPERATIVO — Atención Ciudadana PQR</option>
                  <option value="RADICADOS">RADICADOS — Gestión de Radicados</option>
                  <option value="ADMIN">ADMIN — Administrador del Sistema</option>
                </select>
              </div>

              <!-- Cédula -->
              <div class="fgroup">
                <label class="flabel">Número de cédula</label>
                <input v-model="form.cedula" type="text" class="finput" placeholder="Ej: 11009004" id="form-cedula" />
              </div>

              <!-- Cargo -->
              <div class="fgroup fgroup-full">
                <label class="flabel">Cargo institucional</label>
                <input v-model="form.cargo" type="text" class="finput" placeholder="Ej: Encargada de Radicaciones" id="form-cargo" />
              </div>

              <!-- Toggle activo (solo editar) -->
              <div v-if="!modoCrear" class="fgroup fgroup-full">
                <label class="flabel">Estado de la cuenta</label>
                <div class="cuenta-toggle" @click="form.activo = !form.activo" :class="form.activo ? 'ct-on' : 'ct-off'">
                  <div class="ct-switch">
                    <div class="ct-knob"></div>
                  </div>
                  <div class="ct-info">
                    <span class="ct-title">{{ form.activo ? 'Cuenta activa' : 'Cuenta inactiva' }}</span>
                    <span class="ct-sub">{{ form.activo ? 'El usuario puede iniciar sesión' : 'El usuario no puede ingresar al sistema' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Error -->
            <div v-if="modalError" class="modal-err">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {{ modalError }}
            </div>
          </div>

          <!-- Footer modal -->
          <div class="modal-ftr">
            <button class="btn-cancel" @click="cerrarModal">Cancelar</button>
            <button class="btn-save" @click="guardarUsuario" :disabled="guardando">
              <svg v-if="!guardando" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span v-if="guardando" class="spin-ico">⟳</span>
              {{ guardando ? 'Guardando…' : (modoCrear ? 'Crear Usuario' : 'Guardar Cambios') }}
            </button>
          </div>
        </div>
      </div>
    </transition>


    <!-- ══════════════════════════════════════════ -->
    <!-- MODAL CONFIRMAR ELIMINAR                  -->
    <!-- ══════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="modalEliminarVisible" class="modal-bg" @click.self="modalEliminarVisible = false">
        <div class="modal-box modal-box-sm">
          <div class="modal-hdr modal-hdr-danger">
            <div class="modal-hdr-left">
              <div class="modal-hdr-ico">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </div>
              <div>
                <p class="modal-hdr-tag">Acción irreversible</p>
                <h3 class="modal-hdr-title">Eliminar Usuario</h3>
              </div>
            </div>
            <button class="modal-x" @click="modalEliminarVisible = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-content">
            <div class="del-confirm-body">
              <div class="del-avatar" :class="avClass(usuarioAEliminar?.rol)">
                {{ iniciales(usuarioAEliminar?.nombre || '') }}
              </div>
              <div class="del-info">
                <p class="del-name">{{ usuarioAEliminar?.nombre }}</p>
                <p class="del-email">{{ usuarioAEliminar?.email }}</p>
              </div>
            </div>
            <p class="del-warning">Esta acción eliminará permanentemente la cuenta y no puede deshacerse.</p>
          </div>
          <div class="modal-ftr">
            <button class="btn-cancel" @click="modalEliminarVisible = false">Cancelar</button>
            <button class="btn-del-confirm" @click="ejecutarEliminar" :disabled="guardando">
              {{ guardando ? 'Eliminando…' : 'Sí, eliminar cuenta' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import authService from '../../auth/services/authService.js'
import notificacionService from '../../../services/notificacionService.js'

const API_BASE = '/api/admin'

// ─── Helpers de red ──────────────────────────────────────────────────────
// Un backend caído llega aquí como respuesta vacía o no-JSON (el proxy de
// Vite/Vercel responde 500 sin cuerpo) y `res.json()` revienta con
// "Unexpected end of JSON input". Se traduce a un mensaje accionable.
const leerJson = async (res) => {
  const texto = await res.text().catch(() => '')
  if (!texto) {
    throw new Error(`El servidor respondió vacío (HTTP ${res.status}). Verifique que el backend esté en línea.`)
  }
  try { return JSON.parse(texto) } catch {
    throw new Error('El servidor respondió en un formato inesperado (no es JSON válido).')
  }
}
const esErrorDeRed = (msg) =>
  /failed to fetch|networkerror|load failed|err_connection/i.test(msg || '')

// ─── Estado ──────────────────────────────────────────────────────────────
const usuarios              = ref([])
const cargando              = ref(true)
const errorMsg              = ref('')
const busqueda              = ref('')
const modoVista             = ref('cuadricula')
const modalVisible          = ref(false)
const modalEliminarVisible  = ref(false)
const modoCrear             = ref(false)
const guardando             = ref(false)
const modalError            = ref('')
const mostrarPassword       = ref(false)
const usuarioAEliminar      = ref(null)

const usuarioAdmin = computed(() => authService.getUsuarioActual())

const form = ref({ id: null, nombre: '', email: '', password: '', rol: '', cargo: '', cedula: '', activo: true })

// ─── Computed ─────────────────────────────────────────────────────────────
const usuariosFiltrados = computed(() => {
  if (!busqueda.value.trim()) return usuarios.value
  const q = busqueda.value.toLowerCase()
  return usuarios.value.filter(u =>
    u.nombre?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q) ||
    u.rol?.toLowerCase().includes(q) ||
    u.cargo?.toLowerCase().includes(q)
  )
})
const usuariosActivos   = computed(() => usuarios.value.filter(u => u.activo).length)
const usuariosInactivos = computed(() => usuarios.value.filter(u => !u.activo).length)
const rolesUnicos       = computed(() => new Set(usuarios.value.map(u => u.rol)).size)

// ─── Helpers ──────────────────────────────────────────────────────────────
function iniciales(nombre = '') {
  return nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}
function formatearFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}
function rolClass(rol) {
  const m = { ADMIN: 'rc-admin', ENCARGADO: 'rc-enc', GERENCIA: 'rc-ger', OPERATIVO: 'rc-ope', RADICADOS: 'rc-rad' }
  return m[rol] || ''
}
function rolBarClass(rol) {
  const m = { ADMIN: 'bar-admin', ENCARGADO: 'bar-enc', GERENCIA: 'bar-ger', OPERATIVO: 'bar-ope', RADICADOS: 'bar-rad' }
  return m[rol] || 'bar-default'
}
function avClass(rol) {
  const m = { ADMIN: 'av-admin', ENCARGADO: 'av-enc', GERENCIA: 'av-ger', OPERATIVO: 'av-ope', RADICADOS: 'av-rad' }
  return m[rol] || ''
}

// ─── API ──────────────────────────────────────────────────────────────────
async function cargarUsuarios() {
  cargando.value = true; errorMsg.value = ''
  try {
    const res  = await fetch(`${API_BASE}/usuarios`, { headers: authService.getAuthHeader() })
    const data = await leerJson(res)
    if (!res.ok || !data.success) throw new Error(data.message || `Error HTTP ${res.status}`)
    usuarios.value = data.data
  } catch (e) {
    errorMsg.value = esErrorDeRed(e.message)
      ? 'No hay conexión con el servidor. Verifique que el backend esté en línea y presione «Reintentar conexión».'
      : (e.message || 'No se pudo conectar con el servidor')
  } finally {
    cargando.value = false
  }
}

// ─── Modales ──────────────────────────────────────────────────────────────
function abrirModalCrear() {
  modoCrear.value = true; modalError.value = ''; mostrarPassword.value = false
  form.value = { id: null, nombre: '', email: '', password: '', rol: '', cargo: '', cedula: '', activo: true }
  modalVisible.value = true
}
function abrirModalEditar(u) {
  modoCrear.value = false; modalError.value = ''; mostrarPassword.value = false
  form.value = { id: u.id, nombre: u.nombre, email: u.email, password: '', rol: u.rol, cargo: u.cargo || '', cedula: u.cedula || '', activo: u.activo }
  modalVisible.value = true
}
function cerrarModal() { modalVisible.value = false; modalError.value = '' }
function confirmarEliminar(u) { usuarioAEliminar.value = u; modalEliminarVisible.value = true }

// ─── Acciones ─────────────────────────────────────────────────────────────
async function guardarUsuario() {
  modalError.value = ''
  if (!form.value.nombre.trim())                                { modalError.value = 'El nombre es obligatorio.'; return }
  if (!form.value.rol)                                          { modalError.value = 'Debe seleccionar un rol.'; return }
  if (modoCrear.value && !form.value.email.trim())              { modalError.value = 'El correo es obligatorio.'; return }
  if (modoCrear.value && form.value.password.length < 6)        { modalError.value = 'La contraseña debe tener al menos 6 caracteres.'; return }

  guardando.value = true
  try {
    let res
    if (modoCrear.value) {
      res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify({ nombre: form.value.nombre, email: form.value.email, password: form.value.password, rol: form.value.rol, cargo: form.value.cargo, cedula: form.value.cedula })
      })
    } else {
      const body = { nombre: form.value.nombre, rol: form.value.rol, cargo: form.value.cargo, cedula: form.value.cedula, activo: form.value.activo }
      if (form.value.password && form.value.password.length >= 6) body.nuevaPassword = form.value.password
      res = await fetch(`${API_BASE}/usuarios/${form.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
        body: JSON.stringify(body)
      })
    }
    const data = await leerJson(res)
    if (!res.ok || !data.success) throw new Error(data.message || `Error HTTP ${res.status}`)
    notificacionService.exito(modoCrear.value ? 'Usuario creado exitosamente' : 'Usuario actualizado correctamente')
    cerrarModal(); await cargarUsuarios()
  } catch (e) {
    modalError.value = esErrorDeRed(e.message)
      ? 'No hay conexión con el servidor. Verifique que el backend esté en línea.'
      : (e.message || 'Error al guardar el usuario')
  } finally {
    guardando.value = false
  }
}

async function toggleActivo(u) {
  try {
    const res = await fetch(`${API_BASE}/usuarios/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authService.getAuthHeader() },
      body: JSON.stringify({ activo: !u.activo })
    })
    const data = await leerJson(res)
    if (!res.ok || !data.success) throw new Error(data.message || `Error HTTP ${res.status}`)
    u.activo = !u.activo
    notificacionService.exito(`Cuenta ${u.activo ? 'activada' : 'desactivada'} — ${u.nombre}`)
  } catch (e) {
    notificacionService.error(e.message || 'Error al cambiar estado')
  }
}

async function ejecutarEliminar() {
  if (!usuarioAEliminar.value) return
  guardando.value = true
  try {
    const res = await fetch(`${API_BASE}/usuarios/${usuarioAEliminar.value.id}`, { method: 'DELETE', headers: authService.getAuthHeader() })
    const data = await leerJson(res)
    if (!res.ok || !data.success) throw new Error(data.message || `Error HTTP ${res.status}`)
    notificacionService.exito(`"${usuarioAEliminar.value.nombre}" eliminado del sistema`)
    modalEliminarVisible.value = false; usuarioAEliminar.value = null
    await cargarUsuarios()
  } catch (e) {
    notificacionService.error(e.message || 'Error al eliminar usuario')
  } finally {
    guardando.value = false
  }
}

onMounted(cargarUsuarios)
</script>

<style scoped>
/* ═══ BASE ════════════════════════════════════════════════════════════ */
.au-root { font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; gap: 14px; }

/* ═══ HERO HEADER COMPACTO ═════════════════════════════════════════════ */
.au-hero {
  background: linear-gradient(135deg, #021f3a 0%, #004884 60%, #0066cc 100%);
  border-radius: 12px;
  padding: 14px 20px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  box-shadow: 0 4px 18px rgba(0, 72, 132, 0.22);
  position: relative; overflow: hidden;
}
.au-hero::before {
  content: '';
  position: absolute; top: -30px; right: -30px;
  width: 140px; height: 140px;
  background: rgba(115, 190, 40, 0.08);
  border-radius: 50%;
}
.au-hero-left { display: flex; align-items: center; gap: 12px; z-index: 1; }
.au-hero-badge {
  width: 38px; height: 38px;
  background: rgba(115, 190, 40, 0.2);
  border: 1px solid rgba(115, 190, 40, 0.4);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #73be28; flex-shrink: 0;
}
.au-hero-label { font-size: 0.65rem; font-weight: 700; color: #73be28; letter-spacing: 0.8px; text-transform: uppercase; margin: 0 0 1px; }
.au-hero-title { font-size: 1.2rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.2px; }
.au-hero-right { display: flex; align-items: center; gap: 14px; z-index: 1; }
.au-hero-meta { display: flex; align-items: center; gap: 6px; }
.au-live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #73be28;
  box-shadow: 0 0 0 2.5px rgba(115, 190, 40, 0.25);
  animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot { 0%, 100% { box-shadow: 0 0 0 2.5px rgba(115,190,40,0.25); } 50% { box-shadow: 0 0 0 5px rgba(115,190,40,0.1); } }
.au-live-txt { font-size: 0.7rem; color: rgba(255,255,255,0.7); font-weight: 500; }
.btn-nuevo {
  display: inline-flex; align-items: center; gap: 6px;
  background: #73be28; color: #011427;
  border: none; border-radius: 8px;
  padding: 8px 16px; font-size: 0.78rem; font-weight: 800;
  cursor: pointer; transition: all 0.15s ease;
  box-shadow: 0 2px 10px rgba(115, 190, 40, 0.35);
  letter-spacing: 0.1px;
}
.btn-nuevo:hover { background: #86d42f; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(115, 190, 40, 0.45); }

/* ═══ KPI CARDS COMPACTAS ═════════════════════════════════════════════ */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
@media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
.kpi-card {
  background: #fff; border-radius: 10px;
  padding: 10px 14px 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  display: flex; align-items: center; gap: 10px;
  position: relative; overflow: hidden;
  transition: transform 0.15s, box-shadow 0.15s;
}
.kpi-card:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,0.06); }
.kpi-icon-wrap {
  width: 34px; height: 34px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.kpi-total .kpi-icon-wrap  { background: #eff6ff; color: #1d4ed8; }
.kpi-activo .kpi-icon-wrap { background: #f0fdf4; color: #16a34a; }
.kpi-inactivo .kpi-icon-wrap{ background: #fef2f2; color: #dc2626; }
.kpi-roles .kpi-icon-wrap  { background: #f5f3ff; color: #7c3aed; }
.kpi-body { display: flex; flex-direction: column; }
.kpi-num { font-size: 1.35rem; font-weight: 800; color: #011427; line-height: 1.1; }
.kpi-green  { color: #16a34a; }
.kpi-red    { color: #dc2626; }
.kpi-purple { color: #7c3aed; }
.kpi-lbl { font-size: 0.68rem; color: #64748b; font-weight: 500; margin-top: 1px; }
.kpi-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 2.5px; border-radius: 0 0 10px 10px; }
.kpi-bar-blue   { background: linear-gradient(90deg, #1d4ed8, #3b82f6); }
.kpi-bar-green  { background: linear-gradient(90deg, #16a34a, #22c55e); }
.kpi-bar-red    { background: linear-gradient(90deg, #dc2626, #f87171); }
.kpi-bar-purple { background: linear-gradient(90deg, #7c3aed, #a78bfa); }

/* ═══ PANEL PRINCIPAL ═════════════════════════════════════════════════ */
.au-panel {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
  overflow: hidden;
}

/* Toolbar */
.au-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #edf2f7;
  background: #fafbfc;
  gap: 12px;
}
.search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid #dbe2ea;
  border-radius: 8px; padding: 0 10px; flex: 1; max-width: 360px;
  transition: all 0.15s ease;
}
.search-wrap:focus-within { border-color: #004884; box-shadow: 0 0 0 2px rgba(0,72,132,0.08); }
.search-ico { color: #94a3b8; flex-shrink: 0; }
.search-inp { flex: 1; border: none; outline: none; padding: 6px 0; font-size: 0.8rem; color: #1e293b; background: transparent; }
.search-clear { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.75rem; padding: 2px; transition: color 0.15s; }
.search-clear:hover { color: #dc2626; }
.toolbar-right { display: flex; align-items: center; gap: 12px; }
.results-count { font-size: 0.72rem; color: #64748b; font-weight: 600; white-space: nowrap; }

/* Switch de vista Cuadrícula / Tabla */
.view-switch {
  display: flex; align-items: center;
  background: #edf2f7; border-radius: 7px; padding: 2px;
  gap: 2px;
}
.vswitch-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 9px; border-radius: 5px;
  border: none; background: transparent;
  color: #64748b; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s ease;
}
.vswitch-btn:hover { color: #004884; }
.vswitch-active {
  background: #fff; color: #004884 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ═══ VISTA EN CUADRÍCULA (ZERO SCROLL HORIZONTAL) ═════════════════════ */
.au-grid-wrap { padding: 14px; background: #fafbfc; }
.empty-state-grid { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: #94a3b8; gap: 8px; }
.au-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .au-cards-grid { grid-template-columns: 1fr; }
}

.user-card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.user-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.07);
}
.card-inactiva { opacity: 0.6; filter: grayscale(25%); }

/* Barra de rol superior */
.ucard-topbar { height: 3px; width: 100%; }
.bar-admin { background: linear-gradient(90deg, #4f46e5, #818cf8); }
.bar-enc   { background: linear-gradient(90deg, #0284c7, #38bdf8); }
.bar-ger   { background: linear-gradient(90deg, #059669, #34d399); }
.bar-ope   { background: linear-gradient(90deg, #d97706, #fbbf24); }
.bar-rad   { background: linear-gradient(90deg, #db2777, #f472b6); }
.bar-default{ background: linear-gradient(90deg, #64748b, #94a3b8); }

/* Header de la tarjeta */
.ucard-header {
  padding: 10px 12px 8px 12px;
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #f1f5f9;
}
.ucard-avatar-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.u-avatar-card {
  width: 30px; height: 30px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.68rem; font-weight: 800; color: #fff; flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.ucard-user-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ucard-name {
  font-size: 0.82rem; font-weight: 700; color: #0f172a; margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ucard-cedula { font-size: 0.65rem; color: #94a3b8; font-family: monospace; }

/* Cuerpo de la tarjeta */
.ucard-body {
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
  flex: 1;
}
.ucard-item { display: flex; align-items: center; gap: 6px; font-size: 0.73rem; }
.ucard-label { font-size: 0.66rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; width: 44px; flex-shrink: 0; }
.ucard-val {
  color: #334155; font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1;
}
.ucard-email {
  font-family: monospace; font-size: 0.72rem; color: #004884;
  background: #f0f7ff; padding: 1px 6px; border-radius: 4px;
}
.ucard-cargo { color: #475569; }
.ucard-acceso {
  display: inline-flex; align-items: center; gap: 4px;
  color: #64748b; font-size: 0.68rem;
}
.ucard-acceso svg { color: #94a3b8; }

/* Footer de la tarjeta */
.ucard-footer {
  padding: 8px 12px;
  background: #fafbfc;
  border-top: 1px solid #f1f5f9;
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
}
.ucard-actions { display: flex; align-items: center; gap: 4px; }

/* States */
.au-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 40px 16px; color: #94a3b8; }
.state-spinner { width: 24px; height: 24px; border: 2.5px solid #f1f5f9; border-top-color: #004884; border-radius: 50%; animation: spin 0.75s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.state-txt { font-size: 0.8rem; color: #64748b; margin: 0; }
.au-state-error { color: #dc2626; }
.btn-retry { background: #dc2626; color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
.btn-retry:hover { background: #b91c1c; }

/* Tabla Compacta Ejecutiva */
.au-table-outer { overflow-x: auto; }
.au-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: left; }
.au-table thead tr {
  background: #f1f5f9;
  border-bottom: 1px solid #cbd5e1;
}
.au-table th {
  padding: 8px 12px;
  font-size: 0.67rem; font-weight: 700; color: #475569;
  letter-spacing: 0.5px; text-transform: uppercase;
  white-space: nowrap;
}
.th-center { text-align: center; min-width: 140px; }
.td-idx { padding: 8px 6px 8px 14px !important; color: #94a3b8; font-size: 0.7rem; font-weight: 600; width: 28px; text-align: center; }
.au-table td { padding: 7px 12px; vertical-align: middle; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
.au-tr { transition: background 0.12s ease; }
.au-tr:hover { background: #f8fafc; }
.au-tr:nth-child(even) { background: #fafbfc; }
.au-tr:nth-child(even):hover { background: #f1f5f9; }
.au-tr:last-child td { border-bottom: none; }
.tr-inactivo { opacity: 0.6; filter: grayscale(20%); }
.tr-empty td { padding: 32px !important; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #94a3b8; }
.empty-state p { font-size: 0.8rem; margin: 0; }

/* Celdas Compactas */
.user-cell { display: flex; align-items: center; gap: 8px; min-width: 140px; }
.u-avatar {
  width: 26px; height: 26px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.62rem; font-weight: 800; color: #fff; flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.av-admin { background: linear-gradient(135deg, #4f46e5, #6366f1); }
.av-enc   { background: linear-gradient(135deg, #0284c7, #38bdf8); }
.av-ger   { background: linear-gradient(135deg, #059669, #34d399); }
.av-ope   { background: linear-gradient(135deg, #d97706, #fbbf24); }
.av-rad   { background: linear-gradient(135deg, #db2777, #f472b6); }
.u-meta { display: flex; flex-direction: column; line-height: 1.2; }
.u-nombre { font-weight: 700; color: #0f172a; font-size: 0.78rem; white-space: nowrap; }
.u-cedula { font-size: 0.65rem; color: #94a3b8; font-family: monospace; }

.td-email { }
.email-pill {
  display: inline-block;
  font-size: 0.72rem; color: #334155;
  background: #f1f5f9; border-radius: 4px;
  padding: 2px 7px; border: 1px solid #e2e8f0;
  font-family: monospace;
}

.rol-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 12px;
  font-size: 0.64rem; font-weight: 700; letter-spacing: 0.3px;
  white-space: nowrap;
}
.rol-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.8; }
.rc-admin { background: #ede9fe; color: #4338ca; border: 1px solid #c7d2fe; }
.rc-enc   { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.rc-ger   { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.rc-ope   { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.rc-rad   { background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; }

.td-cargo {
  color: #475569; font-size: 0.74rem;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Micro Toggle de Estado */
.estado-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  background: none; border: none; cursor: pointer; padding: 0;
  transition: opacity 0.15s;
}
.estado-toggle:hover { opacity: 0.85; }
.et-track {
  width: 28px; height: 15px; border-radius: 8px;
  position: relative; transition: background 0.2s;
  flex-shrink: 0;
}
.et-on .et-track  { background: #16a34a; }
.et-off .et-track { background: #cbd5e1; }
.et-thumb {
  position: absolute; top: 1.5px; width: 12px; height: 12px;
  border-radius: 50%; background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  transition: left 0.2s;
}
.et-on .et-thumb  { left: 14.5px; }
.et-off .et-thumb { left: 1.5px; }
.et-lbl { font-size: 0.7rem; font-weight: 600; }
.et-on .et-lbl  { color: #15803d; }
.et-off .et-lbl { color: #64748b; }

.td-acceso { }
.acceso-cell { display: flex; align-items: center; gap: 5px; color: #475569; font-size: 0.7rem; }
.acceso-cell svg { color: #94a3b8; flex-shrink: 0; }
.acceso-nunca { font-size: 0.68rem; color: #94a3b8; font-style: italic; }

/* Botones de acción compactos */
.actions-cell { display: flex; align-items: center; justify-content: center; gap: 4px; }
.act-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 5px;
  font-size: 0.68rem; font-weight: 600;
  border: 1px solid transparent; cursor: pointer;
  transition: all 0.12s ease; white-space: nowrap;
}
.act-edit { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
.act-edit:hover { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
.act-del { background: #fff5f5; color: #dc2626; border-color: #fecaca; }
.act-del:hover:not(:disabled) { background: #dc2626; color: #fff; border-color: #dc2626; }
.act-del:disabled { opacity: 0.3; cursor: not-allowed; }

/* ═══ MODAL ═══════════════════════════════════════════════════════════ */
.modal-bg {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(1, 20, 39, 0.65);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.modal-box {
  background: #fff; border-radius: 18px;
  width: 100%; max-width: 540px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.28);
  overflow: hidden;
  display: flex; flex-direction: column;
}
.modal-box-sm { max-width: 400px; }

.modal-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
}
.modal-hdr-create { background: linear-gradient(135deg, #021f3a, #004884); }
.modal-hdr-edit   { background: linear-gradient(135deg, #1e293b, #334155); }
.modal-hdr-danger { background: linear-gradient(135deg, #7f1d1d, #991b1b); }
.modal-hdr-left { display: flex; align-items: center; gap: 14px; }
.modal-hdr-ico {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(255,255,255,0.12);
  display: flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
}
.modal-hdr-tag { font-size: 0.68rem; font-weight: 600; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 2px; }
.modal-hdr-title { font-size: 1rem; font-weight: 800; color: #fff; margin: 0; }
.modal-x {
  background: rgba(255,255,255,0.12); border: none; color: #fff;
  width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s; flex-shrink: 0;
}
.modal-x:hover { background: rgba(255,255,255,0.22); }

.modal-content { padding: 22px; flex: 1; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fgroup { display: flex; flex-direction: column; gap: 5px; }
.fgroup-full { grid-column: 1 / -1; }
.flabel { font-size: 0.76rem; font-weight: 700; color: #374151; }
.flabel-hint { font-size: 0.7rem; color: #94a3b8; font-weight: 400; }
.req { color: #dc2626; margin-left: 2px; }
.finput, .fselect {
  padding: 10px 13px; border: 1.5px solid #e2e8f0;
  border-radius: 9px; font-size: 0.85rem; color: #1e293b;
  background: #f8fafc; outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
  font-family: inherit;
}
.finput:focus, .fselect:focus {
  border-color: #004884; background: #fff;
  box-shadow: 0 0 0 3px rgba(0,72,132,0.1);
}
.finput-pass { position: relative; }
.finput-pass .finput { padding-right: 42px; width: 100%; box-sizing: border-box; }
.pass-eye {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #94a3b8;
  display: flex; transition: color 0.15s;
}
.pass-eye:hover { color: #004884; }

/* Toggle cuenta activo/inactivo en modal */
.cuenta-toggle {
  display: flex; align-items: center; gap: 14px;
  padding: 13px 16px; border-radius: 10px;
  cursor: pointer; transition: all 0.2s; border: 1.5px solid;
  user-select: none;
}
.ct-on  { background: #f0fdf4; border-color: #86efac; }
.ct-off { background: #fef2f2; border-color: #fca5a5; }
.ct-switch {
  width: 40px; height: 22px; border-radius: 11px;
  position: relative; flex-shrink: 0; transition: background 0.25s;
}
.ct-on .ct-switch  { background: #16a34a; }
.ct-off .ct-switch { background: #d1d5db; }
.ct-knob {
  position: absolute; top: 3px; width: 16px; height: 16px;
  border-radius: 50%; background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  transition: left 0.25s;
}
.ct-on .ct-knob  { left: 21px; }
.ct-off .ct-knob { left: 3px; }
.ct-info { display: flex; flex-direction: column; }
.ct-title { font-size: 0.85rem; font-weight: 700; }
.ct-on .ct-title  { color: #15803d; }
.ct-off .ct-title { color: #dc2626; }
.ct-sub { font-size: 0.73rem; color: #64748b; margin-top: 1px; }

.modal-err {
  display: flex; align-items: center; gap: 8px;
  background: #fef2f2; border: 1px solid #fecaca;
  border-radius: 8px; padding: 10px 14px;
  font-size: 0.81rem; color: #dc2626; margin-top: 12px;
}

.modal-ftr {
  padding: 14px 22px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid #f1f5f9; background: #fafafa;
}
.btn-cancel {
  padding: 9px 20px; border-radius: 9px;
  border: 1.5px solid #e2e8f0; background: #fff;
  color: #64748b; font-size: 0.83rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.btn-cancel:hover { background: #f8fafc; border-color: #cbd5e1; }
.btn-save {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 22px; border-radius: 9px;
  background: linear-gradient(135deg, #004884, #0066cc);
  color: #fff; border: none; font-size: 0.83rem;
  font-weight: 700; cursor: pointer; transition: all 0.15s;
  font-family: inherit; box-shadow: 0 3px 10px rgba(0,72,132,0.3);
}
.btn-save:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.btn-del-confirm {
  padding: 9px 22px; border-radius: 9px;
  background: #dc2626; color: #fff; border: none;
  font-size: 0.83rem; font-weight: 700; cursor: pointer;
  font-family: inherit; transition: all 0.15s;
  box-shadow: 0 3px 10px rgba(220,38,38,0.3);
}
.btn-del-confirm:hover:not(:disabled) { background: #b91c1c; }
.btn-del-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

/* Confirmar eliminar */
.del-confirm-body {
  display: flex; align-items: center; gap: 14px;
  background: #f8fafc; border-radius: 10px;
  padding: 16px; border: 1px solid #f1f5f9;
  margin-bottom: 14px;
}
.del-avatar {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 800; color: #fff; flex-shrink: 0;
}
.del-info { display: flex; flex-direction: column; }
.del-name { font-weight: 700; color: #0f172a; margin: 0 0 2px; font-size: 0.9rem; }
.del-email { font-size: 0.78rem; color: #64748b; margin: 0; }
.del-warning { font-size: 0.83rem; color: #64748b; margin: 0; line-height: 1.5; }
.del-warning strong { color: #dc2626; }

.spin-ico { display: inline-block; animation: spin 0.7s linear infinite; }

/* ═══ Animación modal ═════════════════════════════════════════════════ */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.22s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-box, .modal-fade-leave-to .modal-box { transform: scale(0.97) translateY(-8px); transition: transform 0.22s ease; }
</style>
