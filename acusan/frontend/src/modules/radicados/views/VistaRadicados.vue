<template>
  <section class="vista-radicados">
    <header class="cabecera-vista">
      <div>
        <h2>Radicados</h2>
        <p class="vista-sub">
          {{ esLiderGeneral
            ? 'Registra los radicados que llegan de afuera, dirígelos a cada área y sigue sus respuestas (todas las áreas).'
            : 'Radicados que gerencia dirige a tu área: evalúa cada uno y entrega la respuesta en PDF antes de la fecha límite.' }}
        </p>
      </div>
      <div class="cabecera-acciones">
        <button v-if="esLiderGeneral" type="button" class="btn-secundario" :disabled="revisando" @click="revisarAlertas">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {{ revisando ? 'Revisando…' : 'Revisar alertas' }}
        </button>
        <button v-if="esLiderGeneral" type="button" class="btn-secundario" @click="abrirImportar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Importar Excel
        </button>
        <button v-if="esLiderGeneral" type="button" class="btn-secundario" :disabled="exportando" @click="exportar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {{ exportando ? 'Generando…' : 'Exportar a Excel' }}
        </button>
        <button v-if="esLiderGeneral" type="button" class="btn-primario" @click="abrirCrear">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo radicado
        </button>
      </div>
    </header>

    <!-- Barra de filtros: el área se refleja en el query (filtro del servidor);
         estado, categoría y búsqueda se filtran en el cliente con los datos ya cargados -->
    <div class="barra-filtros">
      <input
        v-model="busqueda"
        type="search"
        class="filtro-busqueda"
        placeholder="Buscar por número, asunto, remitente o encargado…"
        aria-label="Buscar radicados"
      />

      <select v-if="esLiderGeneral" v-model="filtroArea" aria-label="Filtrar por área" @change="aplicarQuery()">
        <option value="">Todas las áreas</option>
        <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
      </select>

      <!-- Áreas: pestañas Por responder / Entregados (lo que llega vs. lo que
           se devuelve a gerencia); gerencia: filtro por estado -->
      <div v-if="!esLiderGeneral" class="pestanas-radicados" role="tablist" aria-label="Estado de los radicados">
        <button
          type="button"
          class="pestana"
          :class="{ 'pestana--activa': pestannaActiva === 'pendientes' }"
          role="tab"
          :aria-selected="pestannaActiva === 'pendientes'"
          @click="irAPestanna('')"
        >
          Por responder
          <span class="pestana-num">{{ conteoPestannas.pendientes }}</span>
        </button>
        <button
          type="button"
          class="pestana"
          :class="{ 'pestana--activa': pestannaActiva === 'respondidas' }"
          role="tab"
          :aria-selected="pestannaActiva === 'respondidas'"
          @click="irAPestanna('respondido')"
        >
          Entregados
          <span class="pestana-num">{{ conteoPestannas.respondidas }}</span>
        </button>
      </div>

      <select v-else v-model="filtroEstado" aria-label="Filtrar por estado" @change="aplicarQuery()">
        <option value="">Todo estado</option>
        <option value="vencido">Vencidos</option>
        <option value="por_vencer">Por vencer (≤ 7 días)</option>
        <option value="sano">En tiempo</option>
        <option value="respondido">Respondidos</option>
        <option value="a_tiempo">Respondidos a tiempo</option>
        <option value="con_retraso">Respondidos con retraso</option>
      </select>

      <select v-model="filtroCategoria" aria-label="Filtrar por categoría" @change="aplicarQuery()">
        <option value="">Toda categoría</option>
        <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
      </select>

      <button v-if="hayFiltros" type="button" class="btn-limpiar" @click="limpiarFiltros">Limpiar filtros</button>
    </div>

    <div v-if="error" class="vista-error">
      <p>{{ error }}</p>
    </div>

    <!-- Hoja de cálculo -->
    <div v-else class="hoja-calculo">
      <div class="tabla-scroll">
        <table class="tabla-radicados">
          <thead>
            <tr>
              <th class="c-num" scope="col">#</th>
              <th scope="col" :class="claseOrden('numero')" @click="alternarOrden('numero')">Radicado</th>
              <th scope="col">Remitente</th>
              <th scope="col" :class="claseOrden('categoria')" @click="alternarOrden('categoria')">Categoría</th>
              <th v-if="esLiderGeneral" scope="col" :class="[...claseOrden('area'), 'th-centro']" @click="alternarOrden('area')">Área</th>
              <th scope="col" :class="claseOrden('encargado')" @click="alternarOrden('encargado')">Encargado</th>
              <th scope="col" :class="[...claseOrden('limite'), 'th-centro']" @click="alternarOrden('limite')">Fecha límite</th>
              <th
                scope="col"
                :class="[...claseOrden('dias'), 'th-centro']"
                title="Días calendario hasta la fecha límite (debajo, los días hábiles)"
                @click="alternarOrden('dias')"
              >Días</th>
              <th scope="col" :class="[...claseOrden('estado'), 'th-centro']" @click="alternarOrden('estado')">Estado</th>
              <th v-if="esLiderGeneral" scope="col" :class="claseOrden('respuesta')" @click="alternarOrden('respuesta')">Respuesta</th>
              <th scope="col" class="c-acciones">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="cargando">
              <td :colspan="columnas" class="c-estado">Cargando radicados…</td>
            </tr>
            <tr v-else-if="!filasVisibles.length">
              <td :colspan="columnas" class="c-estado">
                No hay radicados con estos filtros.
                <button v-if="hayFiltros" type="button" class="enlace-limpiar" @click="limpiarFiltros">Limpiar filtros</button>
              </td>
            </tr>
            <tr v-for="(f, i) in filasVisibles" v-else :key="f.id" :class="{ 'fila-respondida': f.estado === 'respondido' }">
              <td class="c-num">{{ i + 1 }}</td>
              <td class="c-codigo">
                <button type="button" class="enlace-codigo" :title="f.asunto" @click="abrirVer(f)">
                  {{ f.numeroRadicado }}
                </button>
                <span class="c-asunto">{{ f.asunto }}</span>
              </td>
              <td class="c-remitente" :title="f.remitente">{{ f.remitente || '—' }}</td>
              <td class="c-categoria" :title="f.categoria">{{ f.categoria || '—' }}</td>
              <td v-if="esLiderGeneral" class="c-area" :title="f.area?.nombre">
                <span class="chip-area" :class="`chip-area--${(f.area?.codigo || '').toLowerCase().replace(/\s+/g, '-')}`">
                  {{ f.area?.codigo || '—' }}
                </span>
              </td>
              <td class="c-encargado">{{ f.encargado?.nombre || '—' }}</td>
              <td class="c-limite">{{ fechaLarga(f.fechaLimite) }}</td>
              <td class="c-dias" :class="{ 'c-dias--vencido': f.estado !== 'respondido' && f.diasRestantes < 0 }">
                {{ f.estado === 'respondido' ? '—' : textoDias(f.diasRestantes) }}
                <span
                  v-if="f.estado !== 'respondido' && f.diasRestantes > 0 && f.diasHabilesRestantes != null"
                  class="c-dias-habiles"
                  :title="`${f.diasHabilesRestantes} día(s) hábil(es) hasta la fecha límite`"
                >{{ f.diasHabilesRestantes }} háb.</span>
              </td>
              <td class="c-estado-celda">
                <div class="estado-celda">
                  <RadicadoChip :estado="f.estado" :resultado-respuesta="f.resultadoRespuesta" :dias-restantes="f.diasRestantes" />
                  <svg
                    v-if="f.alertaPendiente"
                    class="campana"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    role="img"
                  >
                    <title>Tiene alerta sin atender</title>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
              </td>
              <td v-if="esLiderGeneral" class="c-respuesta">
                <template v-if="f.respondidoEn">
                  <span class="respuesta-quien">{{ f.respondidoPor?.nombre || '—' }}</span>
                  <span class="respuesta-fecha"> · {{ fechaLarga(f.respondidoEn) }}</span>
                </template>
                <span v-else class="c-muted">—</span>
              </td>
              <td class="c-acciones">
                <button
                  v-if="f.puedeResponder && !f.respondidoEn"
                  type="button"
                  class="btn-accion btn-accion--responder"
                  :title="`Responder ${f.numeroRadicado} — se abre el detalle`"
                  :aria-label="`Responder ${f.numeroRadicado}`"
                  @click="abrirVer(f)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
                <button
                  v-if="f.puedeEditar"
                  type="button"
                  class="btn-accion"
                  :title="`Editar ${f.numeroRadicado}`"
                  :aria-label="`Editar ${f.numeroRadicado}`"
                  @click="abrirEditar(f)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>
                <button
                  v-if="f.puedeEditar"
                  type="button"
                  class="btn-accion btn-accion--renovar"
                  :title="`Renovar plazo de ${f.numeroRadicado}`"
                  :aria-label="`Renovar plazo de ${f.numeroRadicado}`"
                  @click="abrirRenovar(f)"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </button>
                <span v-if="(!f.puedeResponder || f.respondidoEn) && !f.puedeEditar" class="c-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Barra de resumen estática con fondo azul cálido y cuadros glass -->
      <footer class="pie-hoja">
        <div class="pie-glass-card">
          <span class="pie-glass-val">{{ resumenVisibles.total }}</span>
          <span class="pie-glass-lbl">radicado(s) visible(s)</span>
        </div>
        <div class="pie-glass-card pie-glass-card--vencidos">
          <span class="pie-glass-dot"></span>
          <span class="pie-glass-val">{{ resumenVisibles.vencidos }}</span>
          <span class="pie-glass-lbl">vencidos</span>
        </div>
        <div class="pie-glass-card pie-glass-card--por-vencer">
          <span class="pie-glass-dot"></span>
          <span class="pie-glass-val">{{ resumenVisibles.porVencer }}</span>
          <span class="pie-glass-lbl">por vencer</span>
        </div>
        <div class="pie-glass-card pie-glass-card--en-tiempo">
          <span class="pie-glass-dot"></span>
          <span class="pie-glass-val">{{ resumenVisibles.enTiempo }}</span>
          <span class="pie-glass-lbl">en tiempo</span>
        </div>
        <div class="pie-glass-card pie-glass-card--respondidos">
          <span class="pie-glass-dot"></span>
          <span class="pie-glass-val">{{ resumenVisibles.respondidos }}</span>
          <span class="pie-glass-lbl">respondido(s)</span>
        </div>
      </footer>
    </div>

    <!-- Modal crear / editar (con eliminar) -->
    <Modal
      :model-value="modalRadicado"
      :titulo="radicadoEditando ? `Editar ${radicadoEditando.numeroRadicado}` : 'Nuevo radicado'"
      ancho="lg"
      @update:model-value="modalRadicado = $event"
    >
      <form class="formulario" novalidate @submit.prevent="guardarRadicado">
        <div class="campo">
          <label for="r-numero">Número de radicado</label>
          <input
            id="r-numero"
            v-model="form.numeroRadicado"
            type="text"
            maxlength="120"
            placeholder="Vacío = automático (RAD-AÑO-CONSECUTIVO)"
          />
          <p v-if="erroresCampos.numeroRadicado" class="campo-error" role="alert">{{ erroresCampos.numeroRadicado }}</p>
        </div>

        <div class="campo">
          <label for="r-asunto">Asunto *</label>
          <input id="r-asunto" v-model="form.asunto" type="text" maxlength="200" placeholder="De qué trata el radicado" />
          <p v-if="erroresCampos.asunto" class="campo-error" role="alert">{{ erroresCampos.asunto }}</p>
        </div>

        <div class="campo">
          <label for="r-remitente">Remitente *</label>
          <input id="r-remitente" v-model="form.remitente" type="text" maxlength="160" placeholder="Quién envía el radicado" />
          <p v-if="erroresCampos.remitente" class="campo-error" role="alert">{{ erroresCampos.remitente }}</p>
        </div>

        <div class="campo">
          <label for="r-tipo">Tipo *</label>
          <input id="r-tipo" v-model="form.tipo" type="text" maxlength="80" placeholder="Derecho de petición, queja, oficio…" />
          <p v-if="erroresCampos.tipo" class="campo-error" role="alert">{{ erroresCampos.tipo }}</p>
        </div>

        <div class="campo">
          <label for="r-categoria">Categoría</label>
          <input
            id="r-categoria"
            v-model="form.categoria"
            type="text"
            maxlength="80"
            list="lista-categorias"
            placeholder="General"
          />
          <datalist id="lista-categorias">
            <option v-for="c in categorias" :key="c" :value="c" />
          </datalist>
          <p v-if="erroresCampos.categoria" class="campo-error" role="alert">{{ erroresCampos.categoria }}</p>
        </div>

        <div class="campo">
          <label for="r-prioridad">Prioridad *</label>
          <select id="r-prioridad" v-model="form.prioridad">
            <option value="" disabled>Selecciona…</option>
            <option v-for="p in PRIORIDADES" :key="p.valor" :value="p.valor">{{ p.texto }}</option>
          </select>
          <p v-if="erroresCampos.prioridad" class="campo-error" role="alert">{{ erroresCampos.prioridad }}</p>
        </div>

        <div class="campo">
          <label for="r-fecha-rad">Fecha de radicación *</label>
          <input id="r-fecha-rad" v-model="form.fechaRadicacion" type="date" />
          <p v-if="erroresCampos.fechaRadicacion" class="campo-error" role="alert">{{ erroresCampos.fechaRadicacion }}</p>
        </div>

        <div class="campo">
          <label for="r-fecha">Fecha límite de respuesta *</label>
          <input id="r-fecha" v-model="form.fechaLimite" type="date" />
          <p v-if="erroresCampos.fechaLimite" class="campo-error" role="alert">{{ erroresCampos.fechaLimite }}</p>
          <p v-else-if="limiteFinDeSemana" class="nota-habil">Esa fecha cae {{ limiteFinDeSemana }}: es un día no hábil (las alertas D1/D3/D7 y los informes cortan por días hábiles). Considere llevar el plazo al siguiente día hábil.</p>
          <div class="plazo-habil" role="group" aria-label="Fijar el plazo en días hábiles">
            <span>Plazo en días hábiles desde la radicación:</span>
            <button
              v-for="n in PLAZOS_HABILES"
              :key="n"
              type="button"
              class="btn-plazo"
              :disabled="calculandoPlazo"
              @click="fijarPlazoHabil(n)"
            >{{ n }}</button>
          </div>
          <p v-if="!erroresCampos.fechaLimite && !limiteFinDeSemana" class="ayuda-campo">
            Los atajos saltan fines de semana, festivos de Colombia y días no laborales. La columna “Días” de la tabla cuenta días calendario.
          </p>
        </div>

        <div v-if="esLiderGeneral" class="campo">
          <label for="r-area">Área a la que se dirige *</label>
          <select id="r-area" v-model="form.areaId" @change="form.encargadoId = ''">
            <option value="" disabled>Selecciona un área…</option>
            <option v-for="a in areas" :key="a.id" :value="a.id">{{ a.codigo }} — {{ a.nombre }}</option>
          </select>
          <p v-if="erroresCampos.areaId" class="campo-error" role="alert">{{ erroresCampos.areaId }}</p>
        </div>

        <div class="campo">
          <label for="r-encargado">Encargado de responder *</label>
          <select id="r-encargado" v-model="form.encargadoId">
            <option value="" disabled>Selecciona al encargado…</option>
            <option v-for="m in equipoDelArea" :key="m.id" :value="m.id">{{ m.nombre }}</option>
          </select>
          <p v-if="erroresCampos.encargadoId" class="campo-error" role="alert">{{ erroresCampos.encargadoId }}</p>
        </div>

        <div class="campo campo--ancho">
          <label for="r-descripcion">Descripción (contexto para el encargado) *</label>
          <textarea id="r-descripcion" v-model="form.descripcion" rows="3" maxlength="2000" placeholder="Contexto que necesita el área para responder"></textarea>
          <p v-if="erroresCampos.descripcion" class="campo-error" role="alert">{{ erroresCampos.descripcion }}</p>
        </div>

        <div class="campo campo--ancho">
          <label for="r-instrucciones">Instrucciones de gerencia (opcional)</label>
          <textarea id="r-instrucciones" v-model="form.instrucciones" rows="2" maxlength="2000" placeholder="Indicaciones adicionales para el encargado"></textarea>
        </div>

        <div v-if="!radicadoEditando" class="campo campo--ancho">
          <span>PDF del radicado *</span>
          <label class="zona-archivo zona-archivo--pdf" :class="{ 'zona-cargando': guardando }">
            <input type="file" accept="application/pdf,.pdf" :disabled="guardando" @change="elegirPdfCrear" />
            <span v-if="pdfNuevo">{{ pdfNuevo.name }}<template v-if="pesoPdfNuevo"> · {{ pesoPdfNuevo }}</template></span>
            <span v-else class="c-muted">Adjunta el PDF del radicado (máx. 10 MB)…</span>
          </label>
          <p v-if="erroresCampos.pdf" class="campo-error" role="alert">{{ erroresCampos.pdf }}</p>
        </div>
        <p v-else class="nota-edicion">
          El PDF del radicado se cambia desde el detalle (Reemplazar PDF) cuando toca subir el oficial
          de una importación; al editar solo se corrigen los datos.
        </p>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
      </form>

      <template #acciones>
        <button
          v-if="radicadoEditando && esLiderGeneral"
          type="button"
          class="btn-peligro"
          :disabled="guardando"
          @click="pasoEliminar ? eliminarRadicado() : (pasoEliminar = true)"
        >
          {{ pasoEliminar ? '¿Confirmar eliminación?' : 'Eliminar' }}
        </button>
        <span class="espacio"></span>
        <button type="button" class="btn-secundario" @click="modalRadicado = false">Cancelar</button>
        <button type="button" class="btn-primario" :disabled="guardando" @click="guardarRadicado">
          {{ guardando ? 'Guardando…' : 'Guardar' }}
        </button>
      </template>
    </Modal>

    <!-- Modal ver radicado, respuesta y PDFs -->
    <Modal
      :model-value="modalVer"
      :titulo="radicadoVer ? `${radicadoVer.numeroRadicado} — información` : 'Información'"
      ancho="lg"
      @update:model-value="!$event && cerrarVer()"
    >
      <div v-if="radicadoVer" class="ver-contenido">
        <dl class="ver-grid">
          <div class="ver-campo">
            <dt>Radicado</dt>
            <dd>{{ radicadoVer.numeroRadicado }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Asunto</dt>
            <dd>{{ radicadoVer.asunto }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Remitente</dt>
            <dd>{{ radicadoVer.remitente || '—' }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Tipo · Prioridad</dt>
            <dd>{{ radicadoVer.tipo || '—' }} · {{ textoPrioridad[radicadoVer.prioridad] || '—' }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Categoría</dt>
            <dd>{{ radicadoVer.categoria || '—' }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Área</dt>
            <dd>{{ radicadoVer.area?.nombre || '—' }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Encargado</dt>
            <dd>{{ radicadoVer.encargado?.nombre || '—' }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Radicado el</dt>
            <dd>{{ fechaLarga(radicadoVer.fechaRadicacion) }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Fecha límite</dt>
            <dd>{{ fechaLarga(radicadoVer.fechaLimite) }}</dd>
          </div>
          <div class="ver-campo">
            <dt>Días restantes</dt>
            <dd v-if="radicadoVer.respondidoEn">—</dd>
            <dd v-else-if="radicadoVer.diasRestantes < 0">Vencido hace {{ -radicadoVer.diasRestantes }} día(s)</dd>
            <dd v-else>
              {{ textoDias(radicadoVer.diasRestantes) }}
              <template v-if="radicadoVer.diasRestantes > 0 && radicadoVer.diasHabilesRestantes != null">
                ({{ radicadoVer.diasHabilesRestantes }} hábiles)
              </template>
            </dd>
          </div>
          <div class="ver-campo">
            <dt>Estado</dt>
            <dd><RadicadoChip :estado="radicadoVer.estado" :resultado-respuesta="radicadoVer.resultadoRespuesta" :dias-restantes="radicadoVer.diasRestantes" /></dd>
          </div>
          <div class="ver-campo">
            <dt>Respuesta</dt>
            <dd v-if="radicadoVer.respondidoEn">
              {{ radicadoVer.respondidoPor?.nombre || '—' }} · {{ fechaLarga(radicadoVer.respondidoEn) }}
            </dd>
            <dd v-else class="c-muted">Sin respuesta</dd>
          </div>
          <div class="ver-campo ver-campo--ancho">
            <dt>Descripción</dt>
            <dd>{{ radicadoVer.descripcion || '—' }}</dd>
          </div>
          <div v-if="radicadoVer.instrucciones" class="ver-campo ver-campo--ancho">
            <dt>Instrucciones de gerencia</dt>
            <dd>{{ radicadoVer.instrucciones }}</dd>
          </div>
          <div v-if="radicadoVer.observacionesRespuesta" class="ver-campo ver-campo--ancho">
            <dt>Observaciones de la respuesta</dt>
            <dd>{{ radicadoVer.observacionesRespuesta }}<template v-if="radicadoVer.numeroOficioRespuesta"> · Oficio {{ radicadoVer.numeroOficioRespuesta }}</template></dd>
          </div>
        </dl>

        <!-- PDF de origen y de respuesta, lado a lado en pantallas anchas -->
        <div class="ver-pdfs">
          <div class="ver-pdf">
            <p class="ver-pdf-titulo">Radicado (documento de origen)</p>
            <PdfVisor
              :fuente="fuentePdfRadicado"
              :nombre="radicadoVer.adjuntoRadicado?.nombre || `${radicadoVer.numeroRadicado}.pdf`"
              :titulo="`Radicado ${radicadoVer.numeroRadicado}`"
            />
            <!-- Reemplazar el PDF de relleno de una importación (solo gerencia) -->
            <label
              v-if="esLiderGeneral && radicadoVer.puedeEditar"
              class="btn-secundario btn-cambiar-pdf"
              :class="{ 'btn-cargando': reemplazandoPdf }"
            >
              {{ reemplazandoPdf ? 'Reemplazando…' : 'Reemplazar PDF' }}
              <input type="file" accept="application/pdf,.pdf" :disabled="reemplazandoPdf" @change="elegirPdfReemplazo" />
            </label>
          </div>

          <div class="ver-pdf">
            <p class="ver-pdf-titulo">Respuesta del área</p>

            <PdfVisor
              v-if="radicadoVer.respondidoEn"
              :fuente="fuentePdfRespuesta"
              :nombre="radicadoVer.adjuntoRespuesta?.nombre || `respuesta-${radicadoVer.numeroRadicado}.pdf`"
              :titulo="`Respuesta de ${radicadoVer.numeroRadicado}`"
            />
            <p v-else class="ver-pdf-vacio">Todavía sin respuesta: el plazo sigue abierto.</p>
          </div>
        </div>

        <!-- Responder desde el detalle (R5): encargado asignado o líder del área -->
        <form
          v-if="radicadoVer.puedeResponder && !radicadoVer.respondidoEn"
          class="ver-responder"
          novalidate
          @submit.prevent="confirmarResponder"
        >
          <p class="ver-pdf-titulo">Responder radicado</p>
          <p class="responder-info">
            Adjunta el PDF de la respuesta. <strong>Al enviar se cierra el plazo y no podrás
            cambiar la respuesta</strong> (si gerencia necesita otra, reabrirá el radicado).
          </p>

          <label class="zona-archivo zona-archivo--pdf" :class="{ 'zona-cargando': respondiendo }">
            <input type="file" accept="application/pdf,.pdf" :disabled="respondiendo" @change="elegirPdfRespuesta" />
            <span v-if="pdfRespuesta">{{ pdfRespuesta.name }}<template v-if="pesoPdfRespuesta"> · {{ pesoPdfRespuesta }}</template></span>
            <span v-else class="c-muted">Adjunta el PDF de la respuesta (máx. 10 MB)…</span>
          </label>

          <div class="responder-extra">
            <div class="campo">
              <label for="resp-oficio">Número de oficio (opcional)</label>
              <input id="resp-oficio" v-model="respuestaOficio" type="text" maxlength="120" :disabled="respondiendo" placeholder="OF-2026-…" />
            </div>
            <div class="campo campo--ancho">
              <label for="resp-observaciones">Observaciones de la respuesta (opcional)</label>
              <textarea id="resp-observaciones" v-model="respuestaObservaciones" rows="2" maxlength="2000" :disabled="respondiendo" placeholder="Notas para gerencia sobre esta respuesta"></textarea>
            </div>
          </div>

          <p v-if="responderError" class="campo-error" role="alert">{{ responderError }}</p>

          <div class="ver-responder-acciones">
            <button type="submit" class="btn-primario" :disabled="respondiendo">
              {{ respondiendo ? 'Enviando…' : 'Enviar respuesta' }}
            </button>
          </div>
        </form>

        <!-- Sin permiso de respuesta (R5): aviso de quién es el encargado -->
        <p v-else-if="!esLiderGeneral && !radicadoVer.respondidoEn" class="aviso-encargado">
          La respuesta la envía el encargado:
          <strong>{{ radicadoVer.encargado?.nombre || '—' }}</strong> (o el líder del área).
        </p>

        <!-- Línea de tiempo: creación, asignaciones, plazos, respuesta, reabrir -->
        <div v-if="radicadoVer.eventos?.length" class="ver-tiempo">
          <p class="ver-pdf-titulo">Línea de tiempo</p>
          <ol class="tiempo">
            <li v-for="e in radicadoVer.eventos" :key="e.id" class="tiempo-item" :class="`tiempo-item--${e.tipo}`">
              <span class="tiempo-punto" aria-hidden="true"></span>
              <span class="tiempo-cuerpo">
                <strong>{{ ETIQUETA_EVENTO[e.tipo] || e.tipo }}</strong>
                <span v-if="e.usuario?.nombre"> — {{ e.usuario.nombre }}</span>
                <span class="tiempo-fecha"> · {{ fechaLarga(e.fecha) }}</span>
                <span v-if="e.detalle" class="tiempo-detalle">{{ e.detalle }}</span>
              </span>
            </li>
          </ol>
        </div>
      </div>

      <template #acciones>
        <button v-if="esLiderGeneral" type="button" class="btn-secundario" @click="editarDesdeVer">
          Editar plazo, área o encargado
        </button>
        <button
          v-if="esLiderGeneral && radicadoVer.respondidoEn"
          type="button"
          class="btn-secundario btn-reabrir"
          :disabled="reabriendo"
          @click="pedirMotivoReabrir"
        >
          {{ reabriendo ? 'Reabriendo…' : 'Reabrir respuesta' }}
        </button>
        <button type="button" class="btn-secundario" @click="cerrarVer">Cerrar</button>
      </template>
    </Modal>

    <!-- Modal reabrir (solo gerencia): un radicado respondido vuelve a pendiente -->
    <Modal
      :model-value="modalReabrir"
      :titulo="radicadoReabrir ? `Reabrir ${radicadoReabrir.numeroRadicado}` : 'Reabrir radicado'"
      ancho="md"
      @update:model-value="modalReabrir = $event"
    >
      <p v-if="radicadoReabrir" class="responder-info">
        Quedó respondido el <strong>{{ fechaLarga(radicadoReabrir.respondidoEn) }}</strong> por
        <strong>{{ radicadoReabrir.respondidoPor?.nombre || '—' }}</strong>. Al reabrirlo vuelve a
        <strong>pendiente</strong>: la respuesta anterior queda en el historial de adjuntos y el área deberá responder de nuevo.
      </p>

      <div class="campo">
        <label for="r-motivo">Motivo del reabrimiento *</label>
        <textarea
          id="r-motivo"
          v-model="motivoReabrir"
          rows="3"
          maxlength="500"
          :disabled="reabriendo"
          placeholder="Por qué se devuelve este radicado al área"
        ></textarea>
        <p v-if="reabrirError" class="campo-error" role="alert">{{ reabrirError }}</p>
      </div>

      <div class="campo">
        <label for="r-reabrir-limite">Nueva fecha límite (opcional — renueva el plazo al reabrir)</label>
        <input id="r-reabrir-limite" v-model="fechaLimiteReabrir" type="date" :disabled="reabriendo" />
        <p v-if="reabrirFinDeSemana" class="nota-habil">Esa fecha cae {{ reabrirFinDeSemana }}: es un día no hábil — las alertas y los informes cortan por días hábiles.</p>
      </div>

      <template #acciones>
        <button type="button" class="btn-secundario" :disabled="reabriendo" @click="modalReabrir = false">Cancelar</button>
        <button type="button" class="btn-primario" :disabled="reabriendo" @click="confirmarReabrir">
          {{ reabriendo ? 'Reabriendo…' : 'Reabrir radicado' }}
        </button>
      </template>
    </Modal>

    <!-- Modal renovar plazo (solo gerencia): atajos rápidos sobre la fecha límite.
         Respondido → reabrir con nuevo plazo; pendiente → solo mover la fecha -->
    <Modal
      :model-value="modalRenovar"
      :titulo="radicadoRenovar ? `Renovar plazo — ${radicadoRenovar.numeroRadicado}` : 'Renovar plazo'"
      ancho="sm"
      @update:model-value="modalRenovar = $event"
    >
      <p v-if="radicadoRenovar" class="renovar-info">
        <strong>{{ radicadoRenovar.asunto }}</strong><br />
        <template v-if="radicadoRenovar.respondidoEn">
          Está respondido: al renovar se <strong>reabre con el nuevo plazo</strong> y el área
          deberá responder de nuevo.
        </template>
        <template v-else>
          Vence el {{ fechaLarga(radicadoRenovar.fechaLimite) }}. Renovar cierra sus alertas
          pendientes y fija la nueva fecha límite.
        </template>
      </p>

      <div class="atajos">
        <button type="button" class="btn-atajo" @click="elegirAtajo(1)">+ 1 mes</button>
        <button type="button" class="btn-atajo" @click="elegirAtajo(3)">+ 3 meses</button>
        <button type="button" class="btn-atajo" @click="elegirAtajo(6)">+ 6 meses</button>
        <button type="button" class="btn-atajo" @click="elegirAtajo(12)">+ 1 año</button>
        <button type="button" class="btn-atajo" @click="elegirAtajo(24)">+ 2 años</button>
      </div>

      <label class="campo campo--solo">
        <span>Nueva fecha límite *</span>
        <input v-model="fechaNueva" type="date" :min="manana" />
        <p v-if="nuevaFinDeSemana" class="nota-habil">Esa fecha cae {{ nuevaFinDeSemana }}: es un día no hábil — las alertas y los informes cortan por días hábiles.</p>
      </label>

      <p v-if="renovarError" class="form-error" role="alert">{{ renovarError }}</p>

      <template #acciones>
        <button type="button" class="btn-secundario" :disabled="renovando" @click="modalRenovar = false">Cancelar</button>
        <button type="button" class="btn-primario" :disabled="renovando" @click="confirmarRenovar">
          {{ renovando ? 'Renovando…' : 'Renovar plazo' }}
        </button>
      </template>
    </Modal>

    <!-- Modal importar Excel (solo gerencia) -->
    <Modal :model-value="modalImportar" titulo="Importar radicados desde Excel" ancho="md" @update:model-value="modalImportar = $event">
      <template v-if="!resultadoImport">
        <p class="revision-intro">
          Carga un .xlsx con las columnas de la plantilla: una fila por radicado. El número vacío crea un
          radicado nuevo (consecutivo automático); un número existente lo actualiza. Una fila mala no
          detiene las demás. Los radicados importados nacen con un PDF de relleno que se reemplaza por
          el oficial desde el detalle.
        </p>

        <button type="button" class="btn-secundario btn-plantilla" @click="descargarPlantilla">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Descargar plantilla
        </button>

        <label class="zona-archivo">
          <input type="file" accept=".xlsx" @change="elegirExcel" />
          <span v-if="archivoExcel">{{ archivoExcel.name }}</span>
          <span v-else class="c-muted">Selecciona el archivo .xlsx…</span>
        </label>

        <p v-if="importError" class="form-error" role="alert">{{ importError }}</p>
      </template>

      <template v-else>
        <p class="revision-total">
          <strong>{{ resultadoImport.total }}</strong> fila(s) procesada(s) ·
          <strong>{{ resultadoImport.creados }}</strong> creado(s) ·
          <strong>{{ resultadoImport.actualizados }}</strong> actualizado(s) ·
          <strong>{{ resultadoImport.errores.length }}</strong> error(es)
        </p>

        <div v-if="resultadoImport.errores.length" class="lista-problemas">
          <p class="lista-titulo">Errores:</p>
          <ul>
            <li v-for="e in resultadoImport.errores" :key="`${e.fila}-${e.mensaje}`">
              <strong>Fila {{ e.fila }}:</strong> {{ e.mensaje }}
            </li>
          </ul>
        </div>
      </template>

      <template #acciones>
        <button type="button" class="btn-secundario" @click="modalImportar = false">Cerrar</button>
        <button
          v-if="!resultadoImport"
          type="button"
          class="btn-primario"
          :disabled="importando || !archivoExcel"
          @click="importar"
        >
          {{ importando ? 'Importando…' : 'Importar' }}
        </button>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AlertasAPI } from '@/api/alertas.js'
import { AreasAPI } from '@/api/areas.js'
import { CalendarioAPI } from '@/api/calendario.js'
import { RadicadosAPI } from '@/api/radicados.js'
import { useSesion } from '@/composables/useSesion.js'
import { useConteoAlertas } from '@/composables/useConteoAlertas.js'
import { useToast } from '@/composables/useToast.js'
import RadicadoChip from '@/components/RadicadoChip.vue'
import PdfVisor from '@/components/PdfVisor.vue'
import Modal from '@/components/Modal.vue'
import { fechaInput, fechaLarga, hoyISO, sumaDias, sumaMeses } from '@/utils/fechas.js'

const route = useRoute()
const router = useRouter()
const sesion = useSesion()
const toast = useToast()
const conteo = useConteoAlertas()

const esLiderGeneral = computed(() => sesion.esLiderGeneral.value)
// Gerencia ve Remitente, Categoría, Área y Respuesta; las áreas no las necesitan todas
const columnas = computed(() => (esLiderGeneral.value ? 11 : 9))

// ===== Datos =====
const filas = ref([])
const areas = ref([])
const cargando = ref(false)
const error = ref('')

// Categorías conocidas: unión de lo visto (para el filtro y el datalist)
const categorias = computed(() => {
  const vistas = new Set()
  for (const f of filas.value) if (f.categoria) vistas.add(f.categoria)
  if (filtroCategoria.value && !vistas.has(filtroCategoria.value)) vistas.add(filtroCategoria.value)
  return [...vistas].sort((a, b) => a.localeCompare(b))
})

// ===== Filtros (área en el query → servidor; estado, categoría y búsqueda en el cliente) =====
const filtroArea = ref('')
const filtroEstado = ref('')
const filtroCategoria = ref('')
const busqueda = ref('')

function desdeQuery() {
  const q = (k) => (typeof route.query[k] === 'string' ? route.query[k] : '')
  filtroArea.value = q('area')
  filtroEstado.value = q('estado')
  filtroCategoria.value = q('categoria')
  busqueda.value = q('q')
}

function paramsActuales() {
  const params = {}
  if (filtroArea.value) params.area = filtroArea.value
  return params
}

function aplicarQuery() {
  const query = { ...paramsActuales() }
  if (filtroEstado.value) query.estado = filtroEstado.value
  if (filtroCategoria.value) query.categoria = filtroCategoria.value
  if (busqueda.value.trim()) query.q = busqueda.value.trim()
  router.replace({ path: '/radicados', query })
}

const hayFiltros = computed(
  () => filtroArea.value !== '' || filtroEstado.value !== '' || filtroCategoria.value !== '' || busqueda.value.trim() !== '',
)

function limpiarFiltros() {
  filtroArea.value = ''
  filtroEstado.value = ''
  filtroCategoria.value = ''
  busqueda.value = ''
  aplicarQuery()
}

// Pestañas de las áreas (R5): Pendientes (no respondidos, por fecha límite) /
// Respondidos. Reutilizan filtroEstado: '' = pendientes, 'respondido' = respondidos
const pestannaActiva = computed(() =>
  ['respondido', 'a_tiempo', 'con_retraso'].includes(filtroEstado.value) ? 'respondidas' : 'pendientes',
)

function irAPestanna(estado) {
  filtroEstado.value = estado
  aplicarQuery()
}

const conteoPestannas = computed(() => {
  const r = { pendientes: 0, respondidas: 0 }
  for (const f of filas.value) {
    if (f.estado === 'respondido') r.respondidas++
    else r.pendientes++
  }
  return r
})

// ===== Orden por columnas =====
const ORDEN_ESTADO = { vencido: 0, por_vencer: 1, sano: 2, respondido: 3 }
const ACCESO = {
  numero: (f) => f.numeroRadicado.toLowerCase(),
  categoria: (f) => (f.categoria || '').toLowerCase(),
  area: (f) => f.area?.codigo || '',
  encargado: (f) => f.encargado?.nombre?.toLowerCase() || '~~~',
  limite: (f) => f.fechaLimite,
  dias: (f) => (f.estado === 'respondido' ? 9999 : f.diasRestantes),
  estado: (f) => ORDEN_ESTADO[f.estado] ?? 9,
  respuesta: (f) => (f.respondidoEn ? new Date(f.respondidoEn).getTime() : 0),
}

const orden = ref({ campo: 'limite', dir: 'desc' })

function alternarOrden(campo) {
  orden.value = orden.value.campo === campo
    ? { campo, dir: orden.value.dir === 'desc' ? 'asc' : 'desc' }
    : { campo, dir: campo === 'limite' ? 'desc' : 'asc' }
}

function claseOrden(campo) {
  return ['ordenable', { activo: orden.value.campo === campo, desc: orden.value.campo === campo && orden.value.dir === 'desc' }]
}

// Búsqueda en el cliente, normalizada (sin tildes) sobre los campos visibles
const normalizar = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function coincideBusqueda(f) {
  const termino = normalizar(busqueda.value.trim())
  if (!termino) return true
  const monton = normalizar(
    [f.numeroRadicado, f.asunto, f.remitente, f.tipo, f.categoria, f.encargado?.nombre, f.area?.codigo, f.area?.nombre].join(' '),
  )
  return monton.includes(termino)
}

// El filtro de estado es del cliente: la API solo filtra por área. Los dos
// valores extra (a_tiempo / con_retraso) afinan los respondidos por resultado
function coincideEstado(f) {
  const e = filtroEstado.value
  if (!e) return true
  if (e === 'a_tiempo') return f.estado === 'respondido' && f.resultadoRespuesta !== 'con_retraso'
  if (e === 'con_retraso') return f.estado === 'respondido' && f.resultadoRespuesta === 'con_retraso'
  return f.estado === e
}

function coincideCategoria(f) {
  return !filtroCategoria.value || f.categoria === filtroCategoria.value
}

// El filtro de estado y categoría es del cliente: la API solo filtra por área
const filasVisibles = computed(() => {
  const accesos = ACCESO[orden.value.campo] || ACCESO.limite
  const dir = orden.value.dir === 'desc' ? -1 : 1
  return filas.value
    .filter((f) => coincideEstado(f) && coincideCategoria(f) && coincideBusqueda(f))
    .sort((a, b) => {
      const va = accesos(a)
      const vb = accesos(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return a.numeroRadicado.localeCompare(b.numeroRadicado)
    })
})

const resumenVisibles = computed(() => {
  const r = { total: filasVisibles.value.length, vencidos: 0, porVencer: 0, enTiempo: 0, respondidos: 0 }
  for (const f of filasVisibles.value) {
    if (f.estado === 'vencido') r.vencidos++
    else if (f.estado === 'por_vencer') r.porVencer++
    else if (f.estado === 'sano') r.enTiempo++
    else r.respondidos++
  }
  return r
})

// ===== Carga =====
async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    filas.value = await RadicadosAPI.listar(paramsActuales())
  } catch (e) {
    error.value = e.message
    filas.value = []
  } finally {
    cargando.value = false
  }
}

// Solo el área viaja al servidor: cambiarla recarga. La búsqueda, el estado y
// la categoría filtran en el cliente con los datos ya cargados. El query
// completo se observa para que un deep-link que solo cambia ?q= (link desde
// alertas con la página ya abierta) también se refleje.
watch(
  () => route.query,
  (nueva, vieja) => {
    const cambioArea = (nueva?.area || '') !== (vieja?.area || '')
    desdeQuery()
    if (vieja === undefined || cambioArea) cargar()
  },
  { immediate: true },
)

// La búsqueda se refleja en la URL (deep-links desde alertas) sin recargar
watch(busqueda, (valor) => {
  const query = { ...route.query }
  const limpio = valor.trim()
  if (limpio) query.q = limpio
  else delete query.q
  router.replace({ path: '/radicados', query })
})

onMounted(() => {
  AreasAPI.listar()
    .then((data) => { areas.value = data })
    .catch(() => {}) // sin áreas el filtro queda vacío; la vista sigue operativa
})

function textoDias(dias) {
  return dias === 0 ? 'Hoy' : String(dias)
}

// Atajos de plazo legal en días hábiles (p. ej. 15 para un derecho de
// petición): el backend suma saltando fines de semana, festivos y no laborales
const PLAZOS_HABILES = [5, 10, 15, 30]
const calculandoPlazo = ref(false)
async function fijarPlazoHabil(n) {
  calculandoPlazo.value = true
  try {
    const r = await CalendarioAPI.sumarHabiles(form.fechaRadicacion || hoyISO(), n)
    form.fechaLimite = r.fecha
    erroresCampos.fechaLimite = ''
  } catch (e) {
    toast.error(e.message)
  } finally {
    calculandoPlazo.value = false
  }
}

// Prioridades del radicado (dominio del backend: baja | media | alta)
const PRIORIDADES = [
  { valor: 'baja', texto: 'Baja' },
  { valor: 'media', texto: 'Media' },
  { valor: 'alta', texto: 'Alta' },
]
const textoPrioridad = Object.fromEntries(PRIORIDADES.map((p) => [p.valor, p.texto]))

// ===== Validación de PDFs (cliente; el servidor vuelve a revisar) =====
const LIMITE_PDF = 10 * 1024 * 1024

function pesoLegible(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// El input se limpia para que elegir el mismo archivo dos veces dispare change
function leerPdf(evento) {
  const input = evento.target
  const archivo = input?.files?.[0]
  input.value = ''
  if (!archivo) return null
  if (!archivo.name.toLowerCase().endsWith('.pdf') || archivo.type !== 'application/pdf') {
    toast.error('El documento debe ser un archivo PDF.')
    return null
  }
  if (archivo.size > LIMITE_PDF) {
    toast.error('El PDF supera el límite de 10 MB.')
    return null
  }
  return archivo
}

// ===== Modal crear / editar =====
const modalRadicado = ref(false)
const radicadoEditando = ref(null)
const guardando = ref(false)
const formError = ref('')
const pdfNuevo = ref(null)
const pasoEliminar = ref(false)

// Errores JUNTO AL CAMPO: los de validación de cliente y los mensajes del
// servidor que se pueden atribuir a un campo (p. ej. número duplicado)
const erroresCampos = reactive({})

function ponerError(campo, mensaje) {
  erroresCampos[campo] = mensaje
}

function limpiarErrores() {
  for (const clave of Object.keys(erroresCampos)) delete erroresCampos[clave]
}

// Pistas para adivinar el campo desde el texto del error del servidor; lo que
// no encaja cae en el error general del formulario
const CAMPO_POR_PISTA = [
  ['numeroRadicado', ['número de radicado', 'numeroradicado', 'ya existe', 'duplicad']],
  ['asunto', ['asunto']],
  ['remitente', ['remitente']],
  ['tipo', ['tipo']],
  ['categoria', ['categoría', 'categoria']],
  ['prioridad', ['prioridad']],
  ['fechaRadicacion', ['fecha de radicación', 'fecharadicacion']],
  ['fechaLimite', ['fecha límite', 'fechalimite', 'plazo']],
  ['encargadoId', ['encargado']],
  ['areaId', ['área', 'area']],
  ['descripcion', ['descripción']],
  ['pdf', ['pdf', 'archivo']],
]

function repartirErrorServidor(mensaje) {
  const texto = (mensaje || '').toLowerCase()
  for (const [campo, pistas] of CAMPO_POR_PISTA) {
    if (pistas.some((p) => texto.includes(p))) return ponerError(campo, mensaje)
  }
  formError.value = mensaje
}

// Aviso de calendario hábil en los formularios de fecha (informativo, no
// bloquea): solo fin de semana detectable sin llamada; los festivos los
// cubre la nota general del campo.
const finDeSemanaDe = (f) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) return null
  const d = new Date(`${f}T00:00:00.000Z`).getUTCDay()
  if (d === 6) return 'en sábado'
  if (d === 0) return 'en domingo'
  return null
}
const limiteFinDeSemana = computed(() => finDeSemanaDe(form.fechaLimite))
const reabrirFinDeSemana = computed(() => finDeSemanaDe(fechaLimiteReabrir.value))
const nuevaFinDeSemana = computed(() => finDeSemanaDe(fechaNueva.value))

const form = reactive({
  numeroRadicado: '',
  asunto: '',
  remitente: '',
  tipo: '',
  categoria: '',
  prioridad: '',
  fechaRadicacion: '',
  fechaLimite: '',
  areaId: '',
  encargadoId: '',
  descripcion: '',
  instrucciones: '',
})

const FORM_VACIO = { ...form }

// Equipo del área elegida: líder + miembros (encargados posibles)
const equipoDelArea = computed(() => {
  const area = areas.value.find((a) => a.id === form.areaId)
  if (!area) return []
  return [...(area.lider ? [area.lider] : []), ...area.miembros]
})

const pesoPdfNuevo = computed(() => pesoLegible(pdfNuevo.value?.size))

function abrirCrear() {
  radicadoEditando.value = null
  formError.value = ''
  limpiarErrores()
  pdfNuevo.value = null
  pasoEliminar.value = false
  Object.assign(form, FORM_VACIO)
  modalRadicado.value = true
}

function abrirEditar(f) {
  radicadoEditando.value = f
  formError.value = ''
  limpiarErrores()
  pdfNuevo.value = null
  pasoEliminar.value = false
  Object.assign(form, {
    numeroRadicado: f.numeroRadicado,
    asunto: f.asunto || '',
    remitente: f.remitente || '',
    tipo: f.tipo || '',
    categoria: f.categoria || '',
    prioridad: f.prioridad || '',
    fechaRadicacion: fechaInput(f.fechaRadicacion),
    fechaLimite: fechaInput(f.fechaLimite),
    areaId: f.area?.id || '',
    encargadoId: f.encargado?.id || '',
    descripcion: f.descripcion || '',
    instrucciones: f.instrucciones || '',
  })
  modalRadicado.value = true
}

function elegirPdfCrear(evento) {
  const archivo = leerPdf(evento)
  if (archivo) pdfNuevo.value = archivo
}

async function guardarRadicado() {
  formError.value = ''
  limpiarErrores()
  const numeroRadicado = form.numeroRadicado.trim()
  const asunto = form.asunto.trim()
  const remitente = form.remitente.trim()
  const tipo = form.tipo.trim()
  const descripcion = form.descripcion.trim()
  // El número es OPCIONAL: vacío genera el consecutivo RAD-AÑO-#### en el servidor
  if (!asunto) return ponerError('asunto', 'El asunto es obligatorio.')
  if (!remitente) return ponerError('remitente', 'El remitente es obligatorio.')
  if (!tipo) return ponerError('tipo', 'El tipo es obligatorio.')
  if (!form.prioridad) return ponerError('prioridad', 'Selecciona la prioridad.')
  if (!form.fechaRadicacion) return ponerError('fechaRadicacion', 'La fecha de radicación es obligatoria.')
  if (!form.areaId) return ponerError('areaId', 'Selecciona el área a la que se dirige.')
  if (!form.encargadoId) return ponerError('encargadoId', 'Selecciona al encargado de responder.')
  if (!form.fechaLimite) return ponerError('fechaLimite', 'La fecha límite de respuesta es obligatoria.')
  if (form.fechaRadicacion && form.fechaLimite && form.fechaLimite < form.fechaRadicacion) {
    return ponerError('fechaLimite', 'La fecha límite no puede ser anterior a la de radicación.')
  }
  if (!descripcion) return ponerError('descripcion', 'La descripción le da contexto al encargado: es obligatoria.')
  if (!radicadoEditando.value && !pdfNuevo.value) {
    return ponerError('pdf', 'Adjunta el PDF del radicado.')
  }

  guardando.value = true
  try {
    if (radicadoEditando.value) {
      await RadicadosAPI.actualizar(radicadoEditando.value.id, {
        numeroRadicado,
        asunto,
        remitente,
        tipo,
        categoria: form.categoria.trim(),
        prioridad: form.prioridad,
        fechaRadicacion: form.fechaRadicacion,
        instrucciones: form.instrucciones.trim(),
        areaId: form.areaId,
        encargadoId: form.encargadoId,
        fechaLimite: form.fechaLimite,
        descripcion,
      })
      toast.exito(`Radicado ${numeroRadicado} actualizado.`)
    } else {
      const datos = await RadicadosAPI.crear(
        {
          numeroRadicado,
          asunto,
          remitente,
          tipo,
          categoria: form.categoria.trim(),
          prioridad: form.prioridad,
          fechaRadicacion: form.fechaRadicacion,
          instrucciones: form.instrucciones.trim(),
          areaId: form.areaId,
          encargadoId: form.encargadoId,
          fechaLimite: form.fechaLimite,
          descripcion,
        },
        pdfNuevo.value,
      )
      toast.exito(`Radicado ${datos.numeroRadicado} creado.`)
    }
    modalRadicado.value = false
    await cargar()
  } catch (e) {
    repartirErrorServidor(e.message)
  } finally {
    guardando.value = false
  }
}

// Eliminar pide dos clics (solo gerencia): borra el radicado y todo lo derivado
async function eliminarRadicado() {
  guardando.value = true
  try {
    const datos = await RadicadosAPI.eliminar(radicadoEditando.value.id)
    toast.exito(`Radicado ${datos.numeroRadicado} eliminado.`)
    modalRadicado.value = false
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    toast.error(e.message)
    pasoEliminar.value = false
  } finally {
    guardando.value = false
  }
}

// ===== Renovar plazo (solo gerencia): atajos sobre la fecha límite =====
const modalRenovar = ref(false)
const radicadoRenovar = ref(null)
const fechaNueva = ref('')
const renovando = ref(false)
const renovarError = ref('')
const baseRenovar = ref('')
const manana = sumaDias(hoyISO(), 1)

function abrirRenovar(f) {
  radicadoRenovar.value = f
  renovarError.value = ''
  // Los atajos suman sobre la fecha límite si aún corre el plazo; si ya
  // respondió o venció, suman sobre hoy (empezar de cero)
  baseRenovar.value = f.estado === 'respondido' || f.diasRestantes < 0 ? hoyISO() : fechaInput(f.fechaLimite)
  fechaNueva.value = sumaMeses(baseRenovar.value, 1) // sugerencia: +1 mes
  modalRenovar.value = true
}

function elegirAtajo(meses) {
  fechaNueva.value = sumaMeses(baseRenovar.value, meses)
}

async function confirmarRenovar() {
  renovarError.value = ''
  if (!fechaNueva.value) return (renovarError.value = 'Selecciona la nueva fecha límite.')
  if (fechaNueva.value <= hoyISO()) return (renovarError.value = 'La nueva fecha límite debe ser posterior a hoy.')

  const f = radicadoRenovar.value
  renovando.value = true
  try {
    if (f.respondidoEn) {
      // Respondido: reabrir + nuevo plazo en un solo paso
      await RadicadosAPI.reabrir(f.id, { motivo: 'Renovación de plazo', fechaLimite: fechaNueva.value })
      toast.exito(`${f.numeroRadicado} reabierto con nuevo plazo hasta ${fechaLarga(fechaNueva.value)}.`)
    } else {
      await RadicadosAPI.actualizar(f.id, { fechaLimite: fechaNueva.value })
      toast.exito(`Plazo de ${f.numeroRadicado} renovado hasta ${fechaLarga(fechaNueva.value)}.`)
    }
    modalRenovar.value = false
    await refrescar(f.id)
  } catch (e) {
    renovarError.value = e.message
  } finally {
    renovando.value = false
  }
}

// Tras un cambio de plazo refresca la tabla, el conteo de alertas y —si sigue
// abierto— el detalle del modal ver
async function refrescar(id) {
  await Promise.allSettled([cargar(), conteo.cargar()])
  if (radicadoVer.value?.id === id) {
    RadicadosAPI.obtener(id)
      .then((detalle) => { radicadoVer.value = detalle })
      .catch(() => {})
  }
}

// ===== Excel (solo gerencia) =====
const exportando = ref(false)

function guardarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function exportar() {
  exportando.value = true
  try {
    const { blob, nombre } = await RadicadosAPI.exportar()
    guardarBlob(blob, nombre)
    toast.exito('Exportación generada.')
  } catch (e) {
    toast.error(e.message)
  } finally {
    exportando.value = false
  }
}

const modalImportar = ref(false)
const archivoExcel = ref(null)
const importando = ref(false)
const importError = ref('')
const resultadoImport = ref(null)

function abrirImportar() {
  archivoExcel.value = null
  importError.value = ''
  resultadoImport.value = null
  modalImportar.value = true
}

function elegirExcel(evento) {
  archivoExcel.value = evento.target?.files?.[0] || null
}

async function descargarPlantilla() {
  try {
    const { blob, nombre } = await RadicadosAPI.plantilla()
    guardarBlob(blob, nombre)
  } catch (e) {
    toast.error(e.message)
  }
}

async function importar() {
  importError.value = ''
  importando.value = true
  try {
    resultadoImport.value = await RadicadosAPI.importar(archivoExcel.value)
    toast.exito(
      `Importación lista: ${resultadoImport.value.creados} creado(s), ${resultadoImport.value.actualizados} actualizado(s).`,
    )
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    importError.value = e.message
  } finally {
    importando.value = false
  }
}

// ===== Revisión manual de alertas (solo gerencia; motor único /api/alertas) =====
const revisando = ref(false)

async function revisarAlertas() {
  revisando.value = true
  try {
    const resultado = await AlertasAPI.ejecutar({})
    toast.exito(`Revisión lista: ${resultado.nuevas} alerta(s) nueva(s), ${resultado.reenviadas} reenviada(s).`)
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    toast.error(e.message)
  } finally {
    revisando.value = false
  }
}

// ===== Responder (R5: el formulario vive dentro del detalle) =====
const pdfRespuesta = ref(null)
const respondiendo = ref(false)
const responderError = ref('')
const respuestaOficio = ref('')
const respuestaObservaciones = ref('')

const pesoPdfRespuesta = computed(() => pesoLegible(pdfRespuesta.value?.size))

function elegirPdfRespuesta(evento) {
  const archivo = leerPdf(evento)
  if (archivo) pdfRespuesta.value = archivo
}

async function confirmarResponder() {
  responderError.value = ''
  if (!pdfRespuesta.value) return (responderError.value = 'Adjunta el PDF de la respuesta.')

  respondiendo.value = true
  try {
    const datos = await RadicadosAPI.responder(radicadoVer.value.id, pdfRespuesta.value, {
      numeroOficioRespuesta: respuestaOficio.value.trim(),
      observacionesRespuesta: respuestaObservaciones.value.trim(),
    })
    toast.exito(
      `Respuesta del radicado ${datos.numeroRadicado} ${datos.resultadoRespuesta === 'con_retraso' ? 'entregada con retraso.' : 'entregada correctamente.'}`,
    )
    // El detalle pasa a Respondidos al instante (chip + PDF de la respuesta)
    radicadoVer.value = { ...radicadoVer.value, ...datos }
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    responderError.value = e.message
  } finally {
    respondiendo.value = false
  }
}

// ===== Reemplazar el PDF del radicado (p. ej. el relleno de una importación) =====
const reemplazandoPdf = ref(false)

function elegirPdfReemplazo(evento) {
  const archivo = leerPdf(evento)
  if (archivo) reemplazarPdf(archivo)
}

async function reemplazarPdf(archivo) {
  reemplazandoPdf.value = true
  try {
    await RadicadosAPI.reemplazarPdf(radicadoVer.value.id, archivo)
    toast.exito('PDF del radicado reemplazado.')
    // El visor recarga solo: su fuente es una función por radicado/timestamp
    radicadoVer.value = { ...radicadoVer.value, selloPdf: Date.now() }
    await cargar()
  } catch (e) {
    toast.error(e.message)
  } finally {
    reemplazandoPdf.value = false
  }
}

// ===== Modal ver: información + ambos PDFs (visores reutilizables) =====
const modalVer = ref(false)
const radicadoVer = ref(null)

// La fuente es una función nueva por radicado: PdfVisor recarga al cambiar de
// radicado y él mismo revoca sus URLs al recargar o desmontarse. El sello del
// reemplazo cambia el objeto y con él la identidad de la función → recarga.
const fuentePdfRadicado = computed(
  () => () => RadicadosAPI.verPdf(radicadoVer.value?.id, 'radicado'),
)
const fuentePdfRespuesta = computed(() => () => RadicadosAPI.verPdf(radicadoVer.value?.id, 'respuesta'))

// Etiquetas de la línea de tiempo (tipos ya traducidos por el backend)
const ETIQUETA_EVENTO = {
  creado: 'Radicado creado',
  asignado: 'Asignación',
  plazo_cambiado: 'Cambio de plazo',
  respondido: 'Respuesta enviada',
  reabierto: 'Reabierto por gerencia',
}

function abrirVer(f) {
  // La fila renderiza al instante; el detalle trae la línea de tiempo y el
  // historial de adjuntos (si falla, los datos básicos ya están en pantalla)
  radicadoVer.value = f
  modalVer.value = true
  // El formulario de respuesta arranca limpio en cada radicado
  pdfRespuesta.value = null
  respuestaOficio.value = ''
  respuestaObservaciones.value = ''
  responderError.value = ''
  RadicadosAPI.obtener(f.id)
    .then((detalle) => {
      if (radicadoVer.value?.id === f.id) radicadoVer.value = detalle
    })
    .catch(() => {})
}

function cerrarVer() {
  radicadoVer.value = null
  modalVer.value = false
}

// Gerencia edita plazo, área o encargado sin perder el contexto del detalle
function editarDesdeVer() {
  const f = radicadoVer.value
  if (!f) return
  cerrarVer()
  abrirEditar(f)
}

// ===== Reabrir (solo gerencia): un radicado respondido vuelve a pendiente =====
const modalReabrir = ref(false)
const radicadoReabrir = ref(null)
const motivoReabrir = ref('')
const fechaLimiteReabrir = ref('')
const reabriendo = ref(false)
const reabrirError = ref('')

function pedirMotivoReabrir() {
  radicadoReabrir.value = radicadoVer.value
  motivoReabrir.value = ''
  fechaLimiteReabrir.value = ''
  reabrirError.value = ''
  modalReabrir.value = true
}

async function confirmarReabrir() {
  reabrirError.value = ''
  const motivo = motivoReabrir.value.trim()
  if (!motivo) return (reabrirError.value = 'El motivo es obligatorio para reabrir.')

  reabriendo.value = true
  try {
    const datos = await RadicadosAPI.reabrir(radicadoReabrir.value.id, {
      motivo,
      ...(fechaLimiteReabrir.value ? { fechaLimite: fechaLimiteReabrir.value } : {}),
    })
    toast.exito(
      fechaLimiteReabrir.value
        ? `Radicado ${datos.numeroRadicado} reabierto con nuevo plazo.`
        : `Radicado ${datos.numeroRadicado} reabierto: vuelve a pendiente.`,
    )
    modalReabrir.value = false
    // Si el detalle sigue abierto, se refresca con el radicado reabierto
    if (radicadoVer.value?.id === datos.id) radicadoVer.value = { ...radicadoVer.value, ...datos }
    await Promise.allSettled([cargar(), conteo.cargar()])
  } catch (e) {
    reabrirError.value = e.message
  } finally {
    reabriendo.value = false
  }
}
</script>

<style scoped>
.cabecera-vista {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.cabecera-vista h2 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 2px;
}

.vista-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin: 0;
}

.cabecera-acciones {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-secundario,
.btn-primario {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
}

.btn-secundario:hover:not(:disabled) {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
}

/* Reabrir es una acción de retorno: se distingue en rojo suave */
.btn-reabrir:hover:not(:disabled) {
  color: var(--acuasan-red-dark, #b91c1c);
  border-color: #fca5a5;
  background: var(--acuasan-red-light, #fef2f2);
}

.btn-secundario:disabled,
.btn-primario:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primario {
  background: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  color: #ffffff;
}

.btn-primario:hover:not(:disabled) {
  background: var(--acuasan-blue-dark);
  border-color: var(--acuasan-blue-dark);
}

/* Eliminar (doble confirmación en el modal de edición) */
.btn-peligro {
  border: 1px solid #fca5a5;
  background: var(--acuasan-red-light, #fef2f2);
  color: var(--acuasan-red-dark, #b91c1c);
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-peligro:hover:not(:disabled) {
  background: var(--acuasan-red, #dc2626);
  border-color: var(--acuasan-red, #dc2626);
  color: #ffffff;
}

.espacio {
  flex: 1;
}

.vista-error {
  background: var(--acuasan-red-light, #fef2f2);
  border: 1px solid #fca5a5;
  border-left: 4px solid var(--acuasan-red, #dc2626);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 12px;
}

/* ===== Barra de filtros ===== */
.barra-filtros {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.barra-filtros select {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-main);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 8px;
  cursor: pointer;
  max-width: 210px;
}

.barra-filtros select:focus {
  outline: none;
  border-color: var(--acuasan-blue);
}

.filtro-busqueda {
  flex: 1;
  min-width: 180px;
  max-width: 340px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-main);
  font-size: 0.74rem;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.filtro-busqueda:focus {
  border-color: var(--acuasan-blue);
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

/* Pestañas Pendientes / Respondidos de las áreas */
.pestanas-radicados {
  display: inline-flex;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  overflow: hidden;
}

.pestana {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: var(--card-bg);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pestana + .pestana {
  border-left: 1px solid var(--border-color);
}

.pestana:hover {
  color: var(--acuasan-blue);
}

.pestana--activa {
  background: var(--acuasan-blue);
  color: #ffffff;
}

.pestana-num {
  background: rgba(255, 255, 255, 0.55);
  color: var(--text-main);
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 800;
  padding: 1px 7px;
  font-variant-numeric: tabular-nums;
}

.pestana--activa .pestana-num {
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
}

.btn-limpiar {
  margin-left: auto;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 7px 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-limpiar:hover {
  color: var(--acuasan-red-dark, #b91c1c);
  border-color: #fca5a5;
}

/* ===== Hoja de cálculo ===== */
.hoja-calculo {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0;
  box-shadow: 0 4px 14px rgba(2, 31, 58, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tabla-scroll {
  overflow: auto;
  max-height: calc(100vh - 245px);
  /* El cuadro llega hasta el final de la pantalla inferior */
  min-height: max(220px, calc(100vh - 245px));
}

.tabla-radicados {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.69rem;
  table-layout: auto;
}

.tabla-radicados thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #4a90d9; /* azul cálido */
  color: #ffffff;
  font-weight: 700;
  font-size: 0.64rem;
  text-align: center;
  padding: 6px 5px;
  white-space: nowrap;
  user-select: none;
  border-bottom: 2px solid #2f6fad;
  border-right: 1px solid rgba(255, 255, 255, 0.22);
}

.tabla-radicados thead th:last-child {
  border-right: none;
}

th.ordenable {
  cursor: pointer;
}

th.ordenable:hover {
  background: #2f6fad;
}

th.activo::after {
  content: ' ▲';
  font-size: 0.55rem;
}

th.activo.desc::after {
  content: ' ▼';
}

/* Cuadrículas: bordes completos en cada celda más compactos */
.tabla-radicados tbody td {
  padding: 4px 5px;
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  vertical-align: middle;
  color: var(--text-main);
  font-size: 0.68rem;
}

.tabla-radicados tbody td:last-child {
  border-right: none;
}

.tabla-radicados tbody tr:nth-child(even) {
  background: #f8fafc;
}

.tabla-radicados tbody tr:hover {
  background: #e0f2fe;
}

.th-centro {
  text-align: center !important;
}

/* Lo ya respondido queda al fondo visualmente: el plazo está cerrado */
.tabla-radicados tbody tr.fila-respondida td {
  color: var(--text-muted);
}

.c-num {
  color: var(--text-muted);
  text-align: center;
  width: 28px;
  min-width: 28px;
  font-size: 0.64rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 4px 2px !important;
}

thead .c-num {
  text-align: center;
  color: #cfe6f7;
}

.c-codigo {
  font-weight: 800;
  color: var(--acuasan-blue);
  white-space: nowrap;
  max-width: 130px;
  text-align: center;
}

.enlace-codigo {
  font-size: 0.70rem;
  font-weight: 800;
  color: var(--acuasan-blue);
  display: inline-flex;
  justify-content: center;
}

.c-area,
.c-encargado,
.c-remitente,
.c-categoria,
.c-respuesta {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.c-remitente {
  max-width: 110px;
  font-size: 0.67rem;
}

.c-categoria {
  max-width: 85px;
  font-size: 0.67rem;
}

.c-encargado {
  max-width: 105px;
  font-size: 0.67rem;
}

.c-respuesta {
  max-width: 105px;
  font-size: 0.64rem;
}

.c-area {
  text-align: center;
  white-space: nowrap;
  width: 58px;
}

.chip-area {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.63rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #1e293b;
}

.chip-area--adm {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
}

.chip-area--com {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.chip-area--jur {
  background: #faf5ff;
  border-color: #e9d5ff;
  color: #7e22ce;
}

.chip-area--ope,
.chip-area--aire-libre {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.chip-area--ger {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #c2410c;
}

.c-limite {
  white-space: nowrap;
  text-align: center;
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
  width: 72px;
}

.c-dias {
  font-weight: 800;
  text-align: center;
  font-size: 0.67rem;
  font-variant-numeric: tabular-nums;
  width: 32px;
}

.c-dias--vencido {
  color: var(--acuasan-red-dark, #b91c1c);
}

.c-estado-celda {
  text-align: center;
  padding: 3px 4px;
}

.estado-celda {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  justify-content: center;
}

.c-estado-celda :deep(.radicado-chip) {
  font-size: 0.58rem;
  padding: 1px 5px;
  gap: 3px;
  line-height: 1.2;
}

.c-estado-celda :deep(.radicado-chip svg) {
  width: 9px;
  height: 9px;
}

.campana {
  color: var(--acuasan-red-dark, #b91c1c);
  flex-shrink: 0;
  width: 10px;
  height: 10px;
}

.respuesta-quien {
  font-weight: 600;
}

.respuesta-fecha {
  color: var(--text-muted);
}

.c-acciones {
  white-space: nowrap;
  text-align: center;
  width: 52px;
  padding: 3px 2px !important;
}

.c-muted {
  color: var(--text-muted);
}

.c-estado {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.74rem;
  padding: 16px 8px !important;
}

.enlace-limpiar {
  background: none;
  border: none;
  color: var(--acuasan-blue);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.72rem;
  padding: 0;
  margin-left: 6px;
  text-decoration: underline;
}

.btn-accion {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-muted);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  margin: 0 1px;
  vertical-align: middle;
}

.btn-accion svg {
  width: 11px;
  height: 11px;
}

.btn-accion:hover {
  color: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  background: var(--acuasan-blue-light);
}

.btn-accion--responder:hover {
  color: var(--acuasan-green-text, #166534);
  border-color: var(--acuasan-green);
  background: var(--acuasan-green-light);
}

.btn-accion--renovar:hover {
  color: var(--acuasan-green-text, #166534);
  border-color: var(--acuasan-green);
  background: var(--acuasan-green-light);
}

.pie-hoja {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  background: linear-gradient(135deg, #0f3963 0%, #174b7d 50%, #205c96 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
  font-size: 0.7rem;
  user-select: none;
  box-shadow: 0 -2px 10px rgba(15, 57, 99, 0.18);
}

.pie-glass-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  color: #f8fafc;
  font-size: 0.67rem;
  font-weight: 500;
  white-space: nowrap;
  transition: transform 0.15s ease, background 0.15s ease;
}

.pie-glass-card:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.38);
}

.pie-glass-val {
  font-weight: 800;
  font-size: 0.74rem;
  color: #ffffff;
}

.pie-glass-lbl {
  color: rgba(255, 255, 255, 0.92);
}

.pie-glass-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pie-glass-card--vencidos {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(248, 113, 113, 0.38);
}
.pie-glass-card--vencidos .pie-glass-dot {
  background: #f87171;
  box-shadow: 0 0 6px rgba(248, 113, 113, 0.85);
}
.pie-glass-card--vencidos .pie-glass-val {
  color: #fecaca;
}

.pie-glass-card--por-vencer {
  background: rgba(245, 158, 11, 0.18);
  border-color: rgba(251, 191, 36, 0.38);
}
.pie-glass-card--por-vencer .pie-glass-dot {
  background: #fbbf24;
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.85);
}
.pie-glass-card--por-vencer .pie-glass-val {
  color: #fef08a;
}

.pie-glass-card--en-tiempo {
  background: rgba(34, 197, 94, 0.18);
  border-color: rgba(74, 222, 128, 0.38);
}
.pie-glass-card--en-tiempo .pie-glass-dot {
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.85);
}
.pie-glass-card--en-tiempo .pie-glass-val {
  color: #bbf7d0;
}

.pie-glass-card--respondidos {
  background: rgba(56, 189, 248, 0.18);
  border-color: rgba(125, 211, 252, 0.38);
}
.pie-glass-card--respondidos .pie-glass-dot {
  background: #38bdf8;
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.85);
}
.pie-glass-card--respondidos .pie-glass-val {
  color: #bae6fd;
}

/* ===== Formulario del modal crear / editar ===== */
.formulario {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campo--ancho {
  grid-column: 1 / -1;
}

.campo label,
.campo > span {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-main);
}

.campo input,
.campo select,
.campo textarea {
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  font-size: 0.8rem;
  color: var(--text-main);
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
  width: 100%;
}

.campo input:focus,
.campo select:focus,
.campo textarea:focus {
  border-color: var(--acuasan-blue);
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

.campo textarea {
  resize: vertical;
  min-height: 54px;
}

/* Error mostrado JUNTO AL CAMPO que lo causó */
.campo-error {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--acuasan-red-dark, #b91c1c);
}

/* Nota de calendario hábil bajo la fecha límite */
.nota-habil {
  margin: 2px 0 0;
  font-size: 0.66rem;
  font-weight: 700;
  color: #b45309;
  background: rgba(217, 119, 6, 0.1);
  border-radius: 6px;
  padding: 5px 8px;
}

.c-dias-habiles {
  display: block;
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.1;
}

.plazo-habil {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 0.64rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.btn-plazo {
  border: 1px solid var(--border-color);
  background: #fff;
  border-radius: 6px;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--acuasan-blue);
  padding: 2px 8px;
  cursor: pointer;
}

.btn-plazo:hover:not(:disabled) {
  background: var(--acuasan-blue-light);
  border-color: var(--acuasan-blue);
}

.ayuda-campo {
  margin: 2px 0 0;
  font-size: 0.64rem;
  color: var(--text-muted);
}

/* Campos opcionales del modal responder (oficio + observaciones) */
.responder-extra {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 10px;
  margin-top: 10px;
}

/* Asunto debajo del número en la celda del radicado */
.c-asunto {
  display: block;
  max-width: 135px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.62rem;
  color: var(--text-soft, #64748b);
  line-height: 1.2;
  text-align: center;
  margin: 1px auto 0;
}

.ver-campo--ancho {
  grid-column: 1 / -1;
}

.form-error {
  grid-column: 1 / -1;
  background: var(--acuasan-red-light, #fef2f2);
  border: 1px solid #fca5a5;
  border-left: 4px solid var(--acuasan-red, #dc2626);
  border-radius: 8px;
  color: var(--acuasan-red-dark, #b91c1c);
  font-size: 0.74rem;
  font-weight: 600;
  padding: 8px 10px;
  margin: 0;
}

.nota-edicion {
  grid-column: 1 / -1;
  font-size: 0.72rem;
  color: var(--text-muted);
  margin: 0;
}

.zona-archivo {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1.5px dashed #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.76rem;
  cursor: pointer;
}

.zona-archivo input {
  font-size: 0.72rem;
  max-width: 220px;
}

.zona-archivo--pdf {
  justify-content: center;
}

.zona-cargando {
  cursor: progress;
  opacity: 0.7;
}

/* ===== Responder ===== */
.responder-info {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0 0 12px;
}

.responder-info strong {
  color: var(--text-main);
}

/* Formulario de respuesta dentro del detalle (R5) */
.ver-responder {
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ver-responder .responder-info {
  margin: 0;
}

.ver-responder-acciones {
  display: flex;
  justify-content: flex-end;
}

/* Aviso para quien no puede responder: quién es el encargado */
.aviso-encargado {
  margin: 0;
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.aviso-encargado strong {
  color: var(--text-main);
}

/* ===== Renovar plazo ===== */
.renovar-info {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0 0 12px;
}

.renovar-info strong {
  color: var(--text-main);
}

.atajos {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.btn-atajo {
  flex: 1;
  border: 1px solid #bae6fd;
  background: var(--acuasan-blue-light);
  color: var(--acuasan-blue);
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 8px 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-atajo:hover {
  background: var(--acuasan-blue);
  border-color: var(--acuasan-blue);
  color: #ffffff;
}

.campo--solo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
}

.campo--solo > span {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-main);
}

.campo--solo input,
.campo--solo textarea {
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  font-size: 0.8rem;
  color: var(--text-main);
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-family: inherit;
  width: 100%;
}

.campo--solo input:focus,
.campo--solo textarea:focus {
  border-color: var(--acuasan-blue);
  box-shadow: 0 0 0 3px rgba(0, 72, 132, 0.12);
}

/* ===== Importar Excel ===== */
.btn-plantilla {
  margin-bottom: 10px;
}

.revision-intro {
  font-size: 0.78rem;
  line-height: 1.55;
  margin: 0 0 10px;
}

.revision-total {
  font-size: 0.8rem;
  margin: 0 0 10px;
  padding: 9px 11px;
  background: var(--acuasan-blue-light);
  border: 1px solid #bae6fd;
  border-radius: 8px;
}

.lista-problemas {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.lista-titulo {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-muted);
  margin: 0 0 4px;
}

.lista-problemas ul {
  margin: 0;
  padding-left: 16px;
  font-size: 0.72rem;
  color: var(--text-main);
}

.lista-problemas li {
  margin-bottom: 2px;
}

/* ===== Ver información + PDFs ===== */
.enlace-codigo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-weight: 800;
  color: var(--acuasan-blue);
  cursor: pointer;
}

.enlace-codigo:hover {
  text-decoration: underline;
}

.ver-contenido {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ver-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin: 0;
}

.ver-campo dt {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ver-campo dd {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--text-main);
  overflow-wrap: anywhere;
}

.ver-pdf {
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Origen y respuesta lado a lado en pantallas anchas */
.ver-pdfs {
  display: grid;
  gap: 10px;
}

@media (min-width: 980px) {
  .ver-pdfs {
    grid-template-columns: 1fr 1fr;
  }
}

/* Reemplazar PDF del radicado (relleno de importación) */
.btn-cambiar-pdf {
  position: relative;
  overflow: hidden;
  align-self: flex-start;
  cursor: pointer;
}

.btn-cambiar-pdf input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.btn-cargando {
  cursor: progress;
  opacity: 0.7;
}

/* ===== Línea de tiempo ===== */
.ver-tiempo {
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tiempo {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.tiempo-item {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  font-size: 0.74rem;
}

.tiempo-punto {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--acuasan-blue);
  flex-shrink: 0;
  margin-top: 4px;
  box-shadow: 0 0 0 3px var(--acuasan-blue-light);
}

.tiempo-item--respondido .tiempo-punto {
  background: var(--acuasan-green);
  box-shadow: 0 0 0 3px var(--acuasan-green-light);
}

.tiempo-item--reabierto .tiempo-punto {
  background: var(--acuasan-red, #dc2626);
  box-shadow: 0 0 0 3px var(--acuasan-red-light, #fef2f2);
}

.tiempo-cuerpo {
  min-width: 0;
}

.tiempo-fecha {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.tiempo-detalle {
  display: block;
  color: var(--text-muted);
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}

.ver-pdf-titulo {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--acuasan-blue);
}

.ver-pdf-vacio {
  margin: 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

@media (max-width: 700px) {
  .formulario {
    grid-template-columns: 1fr;
  }

  .responder-extra {
    grid-template-columns: 1fr;
  }

  .atajos {
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .ver-grid {
    grid-template-columns: 1fr;
  }

  .filtro-busqueda {
    max-width: none;
  }
}
</style>
