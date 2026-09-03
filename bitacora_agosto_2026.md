# 📋 BITÁCORA TÉCNICA DE DESARROLLO — GESTIÓN OPERATIVA ACUASAN E.S.P.
**Periodo:** 03 de Agosto de 2026 – 31 de Agosto de 2026  
**Jornada Laboral:** Lunes a Viernes (Días Hábiles)  
*Días no laborados (Fines de semana): 08, 09, 15, 16, 22, 23, 29 y 30 de Agosto.*  
**Stack Tecnológico:** Vue 3, Vite, Node.js, Express, Prisma ORM, MongoDB Atlas, Vercel Serverless.

---

## 🗓️ SEMANA 1 (Lunes 03 – Viernes 07 Agosto): Kickoff, Recolección de Datos y Diseño

| Fecha | Actividades Desarrolladas | Entregable / Evidencia | 📸 Foto / Captura a Tomar |
| :--- | :--- | :--- | :--- |
| **Lunes 03/08/2026** | • **Reunión de Kickoff del Proyecto** con líderes de área de Acuasan E.S.P.<br>• Diagnóstico de problemáticas operativas por el manejo de planillas físicas y papel.<br>• Definición del alcance de los 4 módulos: Permisos, Horas Extras, Radicados y PQR. | • Acta de reunión inicial del proyecto.<br>• Documento de alcance y objetivos. | **Foto:** Archivo [README.md](file:///c:/Escritorio/Codigo%20Aquasan/README.md) en sección *"Arquitectura y Módulos de Acuasan"*. |
| **Martes 04/08/2026** | • **Aplicación del Instrumento de Recolección de Datos** con funcionarios y encargados de ventanilla.<br>• Recopilación y digitalización de muestras físicas: cartas con sellos de radicación, solicitudes de permisos médicos y formatos de reporte PQR. | • Carpeta de muestras físicas digitalizadas.<br>• Formato de recolección de requerimientos de campo. | **Foto:** Archivo de tests [test_lectura_pdf.mjs](file:///c:/Escritorio/Codigo%20Aquasan/acusan/frontend/tests/test_lectura_pdf.mjs) mostrando las muestras reales (`sello-clasico`, `peticionario-bloque`). |
| **Miércoles 05/08/2026** | • **Evaluación y Análisis de Formatos Institucionales**:<br>  - Formato de Permisos Laborales (justificaciones, tiempos, soportes médicos).<br>  - Planilla de Horas Extras y Recargos (diurnas, nocturnas, festivas).<br>  - Libro físico de Radicación de Ventanilla.<br>  - Formato 2 Único de PQR regulado por la SSPD. | • Matriz de equivalencia de campos físicos vs. campos digitales.<br>• Diagnóstico de campos requeridos para OCR. | **Foto:** Archivo [schema.prisma](file:///c:/Escritorio/Codigo%20Aquasan/acusan/backend/prisma/schema.prisma) mostrando los modelos de `Permiso`, `HoraExtra` y `Radicado`. |
| **Jueves 06/08/2026** | • **Entrega de Evidencias de la Fase de Diagnóstico**.<br>• Diseño conceptual de las interfaces de usuario (UI/UX) que sustituyen el papel por formularios web.<br>• Elaboración de wireframes para la vista de Login y paneles operativos. | • Prototipo de interfaz de usuario en Vue 3.<br>• Guía de estilo y paleta corporativa de Acuasan. | **Foto:** En el navegador `http://localhost:5173/login` mostrando la pantalla corporativa de Acuasan. |
| **Viernes 07/08/2026** | • **Sesión de Validación Técnica con Gerencia** de los formatos digitales propuestos.<br>• Configuración del clúster de base de datos en la nube (**MongoDB Atlas**) para garantizar persistencia 24/7.<br>• Formalización de roles y perfiles (RBAC) y definición del esquema de seguridad JWT. | • Cluster configurado en MongoDB Atlas (`acuasan_db`).<br>• Matriz de Roles (RBAC) y archivo `.env`. | **Foto:** Panel de MongoDB Atlas en el navegador o archivo [.env](file:///c:/Escritorio/Codigo%20Aquasan/acusan/backend/.env). |

> *08/08/2026 y 09/08/2026 — Fin de semana (No laboral)*

---

## 🗓️ SEMANA 2 (Lunes 10 – Viernes 14 Agosto): Cimientos del Backend y Primeros Módulos

| Fecha | Actividades Desarrolladas | Entregable / Evidencia | 📸 Foto / Captura a Tomar |
| :--- | :--- | :--- | :--- |
| **Lunes 10/08/2026** | • Inicialización del repositorio Git local y estructura de directorios (`acusan/backend`, `acusan/frontend`).<br>• Configuración de dependencias base en `package.json` (`vue`, `express`, `prisma`). | Estructura base de carpetas y configuración inicial del proyecto. | **Foto:** Árbol de carpetas en el explorador de VS Code y [package.json](file:///c:/Escritorio/Codigo%20Aquasan/package.json). |
| **Martes 11/08/2026** | • Configuración inicial del servidor Express con middlewares de CORS, JSON parser y logger.<br>• Configuración de scripts de arranque en desarrollo. | Archivo base `src/app.js` y scripts de inicialización. | **Foto:** Archivo [app.js](file:///c:/Escritorio/Codigo%20Aquasan/acusan/backend/src/app.js). |
| **Miércoles 12/08/2026** | • **Primeros Commits Oficiales del Proyecto**:<br>• Creación y conexión a MongoDB Atlas mediante Prisma Client (`5670a11`).<br>• Modularización del Backend y Frontend (`1f0fa7e`, `39f4203`).<br>• Implementación de lectura básica de documentos PDF e historial de fechas (`043292e`). | Commits: `3bc4e2b`, `2deb1b9`, `1f0fa7e`, `39f4203`, `5670a11`, `043292e`. | **Foto:** Terminal de comandos ejecutando `git log --oneline -n 6`. |
| **Jueves 13/08/2026** | • Creación del módulo de Autenticación (`f9260de`): login seguro con hash de contraseñas (`bcryptjs`) y emisión de tokens JWT.<br>• Estandarización de la página y servicios de Permisos para el Encargado (`73fdb32`). | Commit `f9260de`, `73fdb32`, componente `VistaLogin.vue` y `authService.js`. | **Foto:** Pantalla de Login en el navegador ingresando con credenciales institucionales. |
| **Viernes 14/08/2026** | • Creación del módulo de Radicaciones (`52dc7a4`): estructura de rutas y controladores para registro de correspondencia.<br>• Pruebas de persistencia de sesión (`localStorage`) y formulario de registro de Permisos. | Commit `52dc7a4`, endpoints `/api/radicados` y componente `VistaEncargado.vue`. | **Foto:** Consola F12 ➔ *Application* ➔ *Local Storage* o formulario de registro de Permisos. |

> *15/08/2026 y 16/08/2026 — Fin de semana (No laboral)*

---

## 🗓️ SEMANA 3 (Lunes 17 – Viernes 21 Agosto): Despliegue en Vercel, OCR y Persistencia Real

| Fecha | Actividades Desarrolladas | Entregable / Evidencia | 📸 Foto / Captura a Tomar |
| :--- | :--- | :--- | :--- |
| **Lunes 17/08/2026** | • Diseño del algoritmo de extracción de texto estructurado de PDFs mediante análisis de coordenadas espaciales ($X, Y$).<br>• Pruebas preliminares con `pdfjs-dist` para lectura de sellos y encabezados. | Prototipo de parsing espacial en `ocrRadicados.js`. | **Foto:** Función `extraerTextoPagina` en [ocrRadicados.js](file:///c:/Escritorio/Codigo%20Aquasan/acusan/frontend/src/modules/radicados/services/ocrRadicados.js). |
| **Martes 18/08/2026** | • **Gran Jornada de Despliegue e Integración**:<br>• Backend Express adaptado como Vercel Serverless Function (`7dc940a`, `api/index.js`).<br>• Implementación del motor de extracción OCR en dos etapas (`a1b03ad`, `408c6e5`).<br>• Rediseño corporativo de Radicados para Gerencia con KPIs y SLA de términos (`2eb079f`, `2c2e666`).<br>• Eliminación total de datos simulados/quemados; operación 100% con persistencia real (`879b999`, `38c1127`, `16453a7`). | Commits: `4cd968d`, `7dc940a`, `ee77c3c`, `2eb079f`, `2c2e666`, `879b999`, `a1b03ad`. | **Foto:** Vista de Gerencia `http://localhost:5173/gerencia/radicados` con los KPIs y [vercel.json](file:///c:/Escritorio/Codigo%20Aquasan/vercel.json). |
| **Miércoles 19/08/2026** | • Ajuste de límites de carga a **50 MB** en Express para soporte de archivos pesados (`51204f7`).<br>• Persistencia directa de PDFs en Base64 en MongoDB Atlas.<br>• Botón de sincronización bidireccional en el panel de Gerencia (`3f7adca`). | Commits: `51204f7`, `3f7adca`, `2c181aa`, `212223c` y servicio `sincronizacionService.js`. | **Foto:** Archivo [sincronizacionService.js](file:///c:/Escritorio/Codigo%20Aquasan/acusan/frontend/src/services/sincronizacionService.js) o botón de sincronizar en pantalla. |
| **Jueves 20/08/2026** | • Refactorización y estabilización estructural del Backend y conexiones de red (`3b6ca7b`, `434e21d`).<br>• Organización de controladores y rutas modulares en `src/modules/`. | Estructura modular consolidada en `backend/src/modules/`. | **Foto:** Árbol de carpetas de módulos del backend (`auth`, `permisos`, `radicados`, `pqr`, etc.). |
| **Viernes 21/08/2026** | • Implementación del módulo de Administración de Personal y Usuarios (`ed9a216`): creación de cuentas, activación/desactivación y auditoría de accesos.<br>• Pruebas de carga y normalización de caracteres (UTF-8) en MongoDB Atlas (`84a0f82`). | Commit `ed9a216`, componente `VistaAdminUsuarios.vue` y `admin.controller.js`. | **Foto:** Panel de Administración en `http://localhost:5173/admin/usuarios`. |

> *22/08/2026 y 23/08/2026 — Fin de semana (No laboral)*

---

## 🗓️ SEMANA 4 (Lunes 24 – Viernes 28 Agosto): Visores PDF, Tablas Excel y Modelado PQR

| Fecha | Actividades Desarrolladas | Entregable / Evidencia | 📸 Foto / Captura a Tomar |
| :--- | :--- | :--- | :--- |
| **Lunes 24/08/2026** | • **Hito de Estabilización y Visor de Documentos**:<br>• Integración de visor PDF interactivo inline (iframe/modal) dentro de los expedientes (`99c0d57`, `cbd3e08`).<br>• Endpoint de eliminación (`DELETE /api/radicados/:id`) con control de roles (`ade64bf`, `ae68736`).<br>• Menú dinámico con RBAC en el Sidebar (`b3532d3`).<br>• Lazy-loading de librerías pesadas en Vercel Serverless (`917c751`). | Commits: `e4cf759`, `a4aab55`, `917c751`, `de1adda`, `b3532d3`, `99c0d57`, `ae68736`. | **Foto:** Modal del expediente con el **visor PDF embebido** abierto en pantalla. |
| **Martes 25/08/2026** | • Pruebas de compatibilidad con diferentes formatos de sellos de radicación (sellos clásicos, stickers y texto de ventanilla).<br>• Calibración del set de pruebas automatizadas. | Set de pruebas de layouts en `radicados.service.js` y `test_lectura_pdf.mjs`. | **Foto:** Archivo de tests [test_lectura_pdf.mjs](file:///c:/Escritorio/Codigo%20Aquasan/acusan/frontend/tests/test_lectura_pdf.mjs). |
| **Miércoles 26/08/2026** | • Integración del pipeline optimizado de lectura de correspondencia y extracción de fechas de vencimiento (`722330c`).<br>• Cálculo automático de términos legales (3, 5, 10, 15 días). | Commit `722330c` y visualización de badges de vencimiento SLA. | **Foto:** Badges de colores en columna SLA (*"10 días restantes"*, *"15 días restantes"*). |
| **Jueves 27/08/2026** | • Calibración de expresiones regulares para captura precisa de remitentes, dependencias y asuntos (`4d25543`, `677daf6`).<br>• Normalización de nombres de peticionarios y destinatarios. | Commits `4d25543`, `677daf6` y función `extraerCampos()`. | **Foto:** Terminal con salida de extracción de campos al procesar un PDF. |
| **Viernes 28/08/2026** | • **Depuración Integral, Aceleración y Modelado PQR**:<br>• Limpieza de carpetas huérfanas y configuraciones duplicadas (`28f9f1f`).<br>• **Optimización OCR (300x más rápido)**: De 15 s a **0.04 s** omitiendo Tesseract en PDFs con texto digital legible.<br>• Corrección de colisión de índice en MongoDB Atlas (`radicados_idLocal_key`).<br>• Scrollbars responsivos estilo Excel con *sticky headers* (`min-width: 1220px`).<br>• **Fase 1 PQR (Formato 2 SSPD)**: Modelos `Usuario`, `PQR`, `HistorialEstado`, `Evidencia` y `RegistroAcceso` sincronizados en MongoDB Atlas (`npx prisma db push`). | Commits: `28f9f1f`, `a92c52a`, archivos [ocrRadicados.js](file:///c:/Escritorio/Codigo%20Aquasan/acusan/frontend/src/modules/radicados/services/ocrRadicados.js), [schema.prisma](file:///c:/Escritorio/Codigo%20Aquasan/acusan/backend/prisma/schema.prisma), [VistaRadicados.vue](file:///c:/Escritorio/Codigo%20Aquasan/acusan/frontend/src/modules/radicados/views/VistaRadicados.vue) y [VistaGerenciaRadicados.vue](file:///c:/Escritorio/Codigo%20Aquasan/acusan/frontend/src/modules/radicados/views/VistaGerenciaRadicados.vue). | **Foto:** 1) Tabla Excel con barra de fórmulas `fx =RESUMEN_RADICADOS()` y barra de scroll inferior. 2) Código de `schema.prisma`. |

> *29/08/2026 y 30/08/2026 — Fin de semana (No laboral)*

---

## 🗓️ SEMANA 5 (Lunes 31 Agosto): Cierre y Consolidación Mensual

| Fecha | Actividades Desarrolladas | Entregable / Evidencia | 📸 Foto / Captura a Tomar |
| :--- | :--- | :--- | :--- |
| **Lunes 31/08/2026** | • Consolidación y generación de la bitácora técnica mensual de desarrollo.<br>• Depuración y corrección del módulo de Autenticación / Login y del motor de lectura/extracción de PDFs (`6a1869e`).<br>• Auditoría de endpoints de salud (`/api/health`), estabilidad de servidores en desarrollo y preparación de la Fase 2 del módulo PQR (controladores y validadores). | Documento oficial de bitácora técnica de desarrollo mensual, commit `6a1869e` y sistema 100% operativo. | **Foto:** Documento [bitacora_agosto_2026.md](file:///c:/Escritorio/Codigo%20Aquasan/bitacora_agosto_2026.md) en tu editor y ventana del sistema en el navegador. |
