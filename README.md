# 💧 Sistema de Gestión Operativa — ACUASAN E.S.P.

Proyecto empresarial para la administración, digitalización OCR, supervisión gerencial y automatización de procesos operativos, gestión documental de radicados, permisos laborales, horas extras y atención de PQRs para la **Empresa de Acueducto, Alcantarillado y Aseo de San Gil (ACUASAN E.I.C.E. - E.S.P.)**.

---

## 🏛️ Arquitectura del Proyecto

El proyecto está unificado y estructurado dentro de la carpeta principal `acusan/`, manteniendo una separación clara entre el **Frontend (SPA en Vue 3 + Vite + Bootstrap 5)** y el **Backend (API REST en Node.js + Express + Prisma ORM + MongoDB Atlas)**.

```text
Codigo Aquasan/
├── package.json                       # Configuración raíz para despliegue automatizado en Vercel
├── vercel.json                        # Reglas de enrutamiento SPA y build para Vercel
├── vite.config.js                     # Configuración de compilación Vite raíz
├── README.md                          # Documentación oficial del sistema
└── acusan/                            # Núcleo del sistema empresarial
    ├── backend/                       # API REST & Servicios Backend
    │   ├── prisma/
    │   │   └── schema.prisma          # Modelos Prisma ORM (Usuario, Permiso, Radicado, HorasExtras, PQR)
    │   ├── src/
    │   │   ├── app.js                 # Servidor Express, middlewares y CORS
    │   │   ├── config/                # Instancia de Prisma y conexión a base de datos
    │   │   └── modules/               # Módulos del servidor
    │   │       ├── auth/              # Autenticación JWT, tokens y roles de usuario
    │   │       ├── radicados/         # Control documental, OCR y numeración secuencial
    │   │       ├── permisos/          # Procesamiento OCR, dictamen gerencial y control de asistencia
    │   │       ├── horas-extras/      # Cálculo de recargos nocturnos/festivos y aprobación
    │   │       └── pqr/               # Peticiones, quejas, recursos y términos legales
    │   └── package.json
    │
    └── frontend/                      # SPA Cliente Vue 3 + Vite
        ├── src/
        │   ├── main.js                # Inicializador Vue y carga de Bootstrap 5
        │   ├── App.vue                # Layout corporativo con Sidebar, Avatar y botón Cerrar Sesión
        │   ├── style.css              # Sistema de diseño y variables corporativas Acuasan
        │   ├── router/
        │   │   └── index.js           # Enrutador dinámico con protección de sesión y roles
        │   └── modules/
        │       ├── auth/              # Inicio de Sesión y Control de Acceso
        │       │   ├── views/VistaLogin.vue
        │       │   └── services/authService.js
        │       ├── radicados/         # Módulo Oficial de Radicaciones Documentales
        │       │   ├── views/
        │       │   │   ├── VistaRadicados.vue         # Ventanilla Única, OCR y Gestión Operativa
        │       │   │   └── VistaGerenciaRadicados.vue # Supervisión Gerencial & Alertas de Subidas
        │       │   └── services/radicadosService.js
        │       ├── permisos/          # Gestión y Consulta de Permisos Laborales
        │       │   ├── views/
        │       │   │   ├── VistaEncargado.vue         # Digitalización OCR, Visor de PDF y Radicación
        │       │   │   └── VistaGerenciaPermisos.vue  # Tablero Gerencial en 4 Módulos Organizados
        │       │   ├── components/
        │       │   │   ├── VisorPDF.vue
        │       │   │   └── FormularioValidacionOCR.vue
        │       │   └── services/permisosService.js
        │       ├── horas-extras/      # Control Presupuestal de Horas Extras
        │       │   ├── views/VistaGerenciaHoras.vue
        │       │   └── components/TablaHorasExtras.vue
        │       └── pqr/               # Atención al Usuario & Cuadrillas
        │           ├── views/VistaGestionPQR.vue
        │           └── components/PanelAtencionPQR.vue
        ├── package.json
        └── vite.config.js
```

---

## ⚙️ Módulos Integrados del Sistema

### 1. 🪪 Autenticación & Control de Acceso (`auth`)
- Inicio de sesión seguro mediante tokens **JWT** con credenciales institucionales.
- Sistema de roles empresariales con permisos estrictos:
  - `GERENCIA`: Acceso a consulta y supervisión de permisos, horas extras, PQRs y radicaciones con alertas.
  - `RADICADOS` / `ENCARGADO`: Acceso a ventanilla de radicación, extracción OCR y recepción física de documentos.
- Botón **Cerrar Sesión** corporativo ubicado en el pie del Sidebar con modal de confirmación.

### 2. 📑 Control y Gestión de Radicados (`radicados`)
- **Ventanilla Única Operativa (`/radicados/gestion`):**
  - Registro documental oficial con numeración automática secuencial (`#RAD-XXXX`).
  - Motor de extracción automática de metadatos (peticionario, asunto, dependencia, destinatario).
  - 4 KPI Cards interactivas (Total, Pendientes, Próximos a Vencer, Resueltos).
  - Barra de semáforo SLA de términos de vencimiento calculados en tiempo real.
- **Supervisión Gerencial (`/radicados/gerencia`):**
  - Vista exclusiva para Gerencia con tabla de monitoreo institucional.
  - **🔔 Botón de Alertas de Subidas:** Panel interactivo cronológico con la **fecha y hora exacta** de cada radicado ingresado por los encargados (**Eliana** y **Román**).
  - Filtros dinámicos por responsable (`Eliana`, `Román`, `Todos`), estado y términos SLA.
  - Visor de expediente digital con sello oficial institucional de Acuasan E.S.P.

### 3. 📄 Permisos Laborales & Digitalización OCR (`permisos`)
- **Vista Encargado (`/permisos/encargado`):** Carga física del documento escaneado, visor de PDF integrado, rectificación asistida de datos y radicación con formato de 24 horas (`HH:mm`).
- **Vista Gerencia (`/permisos/gerencia` - 4 Módulos Organizados):**
  - 📊 **Módulo 1: Matriz Excel:** Tabla estructurada estilo `.xlsx` con radicados, horarios 24h, tipo de permiso y estado.
  - 📅 **Módulo 2: Calendario Mensual:** Cuadrícula mensual con badges interactivos por día de entrega.
  - 👥 **Módulo 3: Acumulados por Empleado:** Control de recurrencia y horas acumuladas por funcionario.
  - 📁 **Módulo 4: Expedientes & Soportes:** Visualización del documento escaneado original.

### 4. ⏱️ Control de Horas Extras (`horas-extras`)
- Consolidado presupuestal de recargos nocturnos, festivos y diurnos por cuadrilla operativa.
- Aprobación / Rechazo gerencial directo con notificaciones instantáneas.

### 5. 📋 Atención al Usuario & PQR (`pqr`)
- Peticiones, Quejas, Reclamos y Recursos con seguimiento de vencimientos.
- Asignación directa a cuadrillas técnicas operativas para visitas de campo y resolución.

---

## 💾 Gestión de Datos 100% Real y Persistente

- **Cero Datos de Muestra:** El sistema opera de forma concisa y limpia, mostrando **únicamente la información real ingresada al sistema**.
- **Persistencia Transaccional:** Cada nuevo radicado, permiso laboral, hora extra o PQR se almacena de forma persistente y no se pierde al recargar o reiniciar el navegador.
- **Sincronización Reactiva en Tiempo Real:** Implementación del evento `storage` del navegador para que cualquier cambio o subida realizada por los encargados se refleje al instante en la pantalla de Gerencia entre pestañas.

---

## 🌐 Despliegue en la Nube (Vercel)

El proyecto cuenta con integración continua para compilación y despliegue automático en **Vercel**:

- **URL de Producción:** `https://gestion-operativa-acusan.vercel.app`
- **Build Pipeline:** `vite build` automatizado en raíz.
- **Salida:** `dist`

---

## 🚀 Puesta en Marcha Local

### 1. Servidor Backend API
```bash
cd acusan/backend
npm install
npx prisma generate
npm run dev
```
- API Backend escuchando en: `http://localhost:3000`

### 2. Aplicación Cliente Frontend
```bash
cd acusan/frontend
npm install
npm run dev
```
- Aplicación Frontend escuchando en: `http://localhost:5173`
- Compilación de producción: `npm run build` o `npx vite build` (desde la raíz)
