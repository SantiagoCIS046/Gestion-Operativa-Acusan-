# 💧 Sistema de Gestión Operativa — ACUASAN E.S.P.

Proyecto empresarial para la administración, digitalización OCR y automatización de procesos operativos, gestión documental de radicados, permisos laborales, horas extras y atención de PQRs para la **Empresa de Acueducto, Alcantarillado y Aseo de San Gil (ACUASAN E.S.P.)**.

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
    │   │   ├── config/                # Instancia de Prisma y conexión a MongoDB Atlas
    │   │   └── modules/               # Módulos del servidor
    │   │       ├── auth/              # Autenticación JWT, tokens y roles de usuario
    │   │       ├── radicados/         # Control documental, OCR y numeración secuencial
    │   │       ├── permisos/          # Procesamiento OCR, dictamen gerencial y semillas semanales
    │   │       ├── horas-extras/      # Cálculo de recargos nocturnos/festivos y aprobación
    │   │       └── pqr/               # Peticiones, quejas, recursos y términos legales
    │   └── package.json
    │
    └── frontend/                      # SPA Cliente Vue 3 + Vite
        ├── src/
        │   ├── main.js                # Inicializador Vue y carga de Bootstrap 5
        │   ├── App.vue                # Layout empresarial con Sidebar, Avatar y Modal de Cierre de Sesión
        │   ├── style.css              # Sistema de diseño y variables corporativas Acuasan
        │   ├── router/
        │   │   └── index.js           # Enrutador dinámico con protección de sesión y roles
        │   └── modules/
        │       ├── auth/              # Inicio de Sesión y Control de Acceso
        │       │   ├── views/VistaLogin.vue
        │       │   └── services/authService.js
        │       ├── radicados/         # Módulo Oficial de Radicaciones Documentales
        │       │   ├── views/VistaRadicados.vue
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
- Inicio de sesión seguro mediante tokens **JWT**.
- Sistema de roles empresariales: `ADMIN`, `ENCARGADO`, `GERENCIA`, `OPERATIVO`, `RADICADOS`.
- Componentes UI de cierre de sesión con **Modales Bootstrap 5** compactos y profesionales.

### 2. 📑 Control y Gestión de Radicados (`radicados`)
- Registro documental oficial con numeración secuencial (`#RAD-2026-XXXX`).
- Motor OCR para extracción automática de datos en archivos escaneados (PDF e imágenes).
- Control de fechas límite de vencimiento con alertas visuales de color.
- Historial y búsqueda en tiempo real por radicado, remitente o asunto.

### 3. 📄 Permisos Laborales & OCR (`permisos`)
- **Vista Encargado:** Carga física del documento escaneado, visor de PDF integrado, rectificación OCR al 99% y radicación directa.
- **Vista Gerencia (4 Módulos Organizados):**
  - 📊 **Módulo 1: Matriz Excel:** Tabla estructurada estilo `.xlsx` con radicados, horarios (24h), tipo de permiso y % de confianza OCR.
  - 📅 **Módulo 2: Calendario Mensual:** Distribución interactiva de permisos de Lunes a Domingo con badges de entregas por día.
  - 👥 **Módulo 3: Acumulados por Empleado:** Control de recurrencia mensual y horas acumuladas por funcionario.
  - 📁 **Módulo 4: Expedientes & Soportes Reales:** Galería de expedientes con la Solicitud Oficial Acuasan (Página 1) y Evidencia/Excusa adjunta (Página 2).

### 4. ⏱️ Control de Horas Extras (`horas-extras`)
- Consolidado presupuestal de recargos nocturnos, festivos y diurnos por cuadrilla.
- Aprobación/Rechazo gerencial con notificaciones Bootstrap.

### 5. 📋 Atención al Usuario & PQR (`pqr`)
- Peticiones, Quejas, Reclamos y Recursos con seguimiento de vencimientos.
- Asignación directa a cuadrillas técnicas operativas para visitas en campo.

---

## 🌐 Despliegue en la Nube (Vercel & MongoDB Atlas)

El proyecto está preparado para compilación y despliegue automático en **Vercel**:

- **URL de Producción Vercel:** `https://gestion-operativa-acusan.vercel.app`
- **Build Command:** `vite build` (Configurado automáticamente mediante `vite.config.js` y `package.json` raíz).
- **Output Directory:** `dist`

---

## 🚀 Puesta en Marcha Local

### 1. Servidor Backend API
```bash
cd acusan/backend
npm install
# Configurar las variables de entorno en el archivo .env (DATABASE_URL, JWT_SECRET)
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
- Compilación de producción: `npm run build`
