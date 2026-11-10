# Acuusan — Radicados y control de vencimientos

Sistema de gestión de radicados para Acuusan E.S.P. (backend Node/Express +
Prisma/MongoDB Atlas, frontend Vue 3 + Vite).

Un **radicado** es un documento que llega de afuera (derecho de petición,
queja, oficio, contrato) y que un área debe responder antes de una fecha
límite. El módulo unifica lo que antes eran dos módulos separados
(*Archivos* y *Radicados*): el control de vencimientos con categorías y
Excel, y el flujo de respuesta con PDFs y timeline.

## ⚡ Inicio rápido (para revisar el proyecto)

Solo necesitas **Node 22.12 o superior** ([nodejs.org](https://nodejs.org), versión LTS)
y una base **MongoDB Atlas gratuita** propia. El script te explica cómo crearla.

```bash
git clone https://github.com/SantiagoCIS046/Gestion-Operativa-Acusan-.git
cd Gestion-Operativa-Acusan-/acusan
npm run preparar   # instala, crea backend/.env (pide la cadena de Atlas) y carga datos de prueba
npm run dev        # abre http://localhost:5173
```

Entra con **`gerencia@acuasan.com`** (líder general, ve todo) o
**`lider.operativo@acuasan.com`** (líder de área). La contraseña de todos los
usuarios de prueba es la que imprime `npm run preparar` al terminar.

> `npm run preparar` nunca modifica un `backend/.env` que ya exista, y antes
> de cargar los datos de prueba pide confirmación, porque **borra lo que haya
> en esa base**. Usa una base vacía, nunca la de producción.

## Puesta en marcha (desde `acusan/`)

Requisitos: Node ≥ 22.12 (lo exige Vite 8) y una base MongoDB Atlas.

1. `npm install` — instala dependencias (el postinstall instala también
   `backend/` y `frontend/`).
2. Crear `backend/.env` a partir de `backend/.env.example`: define al menos
   `DATABASE_URL` (cadena de Atlas) y `JWT_SECRET` (genera uno fuerte; el
   ejemplo muestra cómo). Opcional: `CRON_SECRET` para las alertas diarias.
   Obligatorio también `CLAVE_MAESTRA_DATOS` (llave del cifrado): desde
   `backend/` corre `npm run claves:generar -- --guardar` **una sola vez** y
   lee la sección [🔐 Cifrado de datos](#-cifrado-de-datos).
3. `npm run db:push` — aplica el esquema de Prisma a Atlas.
   **⚠️ Destructivo**: elimina lo que no esté en el esquema — incluida la
   colección `archivos` del modelo anterior (la fusión la retiró; sus datos
   no se migran, el seed resiembra radicados de prueba).
4. `npm run db:seed` — resiembra áreas, 13 usuarios y ~36 radicados de
   prueba (sanos, por vencer, vencidos y respondidos). Crea un usuario por
   rol (el listado está en `backend/prisma/seed.mjs`); todos nacen con la
   misma contraseña inicial, que el comando imprime al terminar. Cámbialas
   antes de usar el sistema en real.
5. `npm run dev` — arranca la API en `http://localhost:3000` y la web en
   `http://localhost:5173` juntas (Vite proxya `/api` al backend).

## Comandos (desde `acusan/`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Entorno de desarrollo |
| `npm run db:push` | Aplica el esquema de Prisma a Atlas (`prisma db push`) |
| `npm run db:seed` | Resiembra áreas, usuarios y radicados de prueba |
| `npm test` | Suite de pruebas del backend (corre desde `backend/`) |
| `npm run alertas:diarias` | Revisión de alertas sin usuario (ver abajo) |
| `npm run claves:generar` (en `backend/`) | Genera la llave del cifrado (una sola vez) |
| `npm run datos:cifrar` (en `backend/`) | Cifra los datos que ya existían (`-- --simular` primero) |

## 📨 Radicados (módulo unificado)

### Roles y sus vistas

Cada rol entra a un inicio distinto y ve un menú distinto; el backend
recorta todos los listados al área del token (un líder de área no puede ver
los radicados de otra área ni pidiéndolos por URL).

| Vista | Gerencia (`LIDER_GENERAL`) | Líder de área (`LIDER_AREA`) | Usuario (`USUARIO`) |
|---|---|---|---|
| **Resumen** (inicio) | Global: KPIs, ventanas, ranking por área con «Alertar» | **Panel de su área**: KPIs de lo que recibe/entrega y **Mi equipo** (rendimiento por encargado) | — (entra a Radicados) |
| **Radicados** | Todas las áreas: registra, dirige, edita, reabre, renueva, Excel | **Solo su área**, pestañas *Por responder* / *Entregados*; responde con PDF | Solo su área; responde únicamente los radicados que tiene asignados |
| **Informes** | Global o por área (`?areaId=`); genera y sincroniza cierres | **Siempre su área** (el servidor la fuerza): cumplimiento por encargado | — |
| **Alertas** | De todas las áreas + últimas ejecuciones del motor | **Solo las de su área**; puede atenderlas | Solo las de su área (no atiende) |
| **Calendario / Estructura** | Sí | — | — |

### Quién hace qué

- **Registra**: solo gerencia (`LIDER_GENERAL`), desde *Radicados →
  Nuevo radicado*. Sube el PDF de llegada y define área, encargado, fecha de
  radicación, **fecha límite** de la respuesta y **categoría** (libre, con
  sugerencias de las ya usadas). El **n.° de radicado es opcional**: vacío →
  el backend genera `RAD-<año>-<consecutivo>`.
- **Responde**: el **encargado asignado** o el **líder del área**
  (`LIDER_AREA`). Responden desde el detalle: **PDF de respuesta
  obligatorio** + observaciones y n.° de oficio opcionales. Al enviar, el
  plazo se cierra y la respuesta no se puede cambiar.
- **Reabre / renueva**: gerencia puede **reabrir** un radicado respondido
  (motivo obligatorio) y vuelve a quedar pendiente. El botón **Renovar
  plazo** hace las dos cosas en un paso: reabre y fija la nueva fecha límite
  (atajos +1 m, +3 m, +6 m, +1 a, +2 a). En un radicado pendiente, renovar
  solo cambia la fecha límite.
- **Elimina**: solo gerencia, desde *Editar* (doble clic de confirmación).
  Borra en cascada adjuntos, eventos, alertas y el radicado.
- **Excel**: solo gerencia. *Exportar* (todo el universo visible), 
  *Plantilla* (hoja de instrucciones incluida) e *Importar* (xlsx ≤ 5 MB):
  fila sin n.° de radicado → crea con número automático y PDF placeholder
  (reemplazable luego con *Reemplazar PDF*); fila con n.° existente →
  actualiza. El modal de resultado reporta creados, actualizados y errores
  por fila.

### Estados

| Estado | Cuándo |
|---|---|
| En tiempo | Pendiente y faltan más de 7 días para la fecha límite |
| Por vencer | Pendiente y faltan ≤ 7 días |
| Vencido | Pendiente y la fecha límite ya pasó |
| Entregado correctamente | Respondido a tiempo (en o antes de la fecha límite, hora de Bogotá) |
| Entregado con retraso | Respondido después de la fecha límite |

Responder (con PDF) es la **única** forma de cerrar un radicado: no hay
recepción ni cierre administrativo aparte.

### PDFs

**Solo PDF y máximo 10 MB**, tanto para el radicado como para la respuesta
(validado en el navegador y de nuevo en el servidor). El listado y el
detalle nunca viajan con el contenido de los PDFs: se descargan por
endpoints autenticados. Gerencia puede **reemplazar el PDF de radicado**
(p. ej. el placeholder que dejó un import de Excel).

## 🔐 Cifrado de datos

Los datos sensibles se guardan **cifrados en MongoDB** (AES-256-GCM). Quien
obtenga una copia de la base — un respaldo filtrado, la cadena de conexión
expuesta, un acceso indebido a Atlas — solo ve texto ilegible:

| Colección | Campos cifrados |
|---|---|
| `radicados_v2` | número, asunto, descripción, remitente, instrucciones, observaciones y oficio de respuesta |
| `adjuntos` | el PDF completo y su nombre |
| `alertas` | mensaje (repite número y área) |
| `radicado_eventos` | detalle (repite número y asunto) |
| `informes` | lista de radicados críticos |

Las **contraseñas no se cifran: se guardan con hash bcrypt** (costo 12), que
no se puede revertir ni con la llave. Los hashes antiguos (costo 10) se
actualizan solos en el siguiente inicio de sesión del usuario.

**Cómo funciona por dentro** (`backend/src/lib/cifrado.js` y
`extensionCifrado.js`): una extensión de Prisma cifra al escribir y descifra
al leer, así que el resto del código y el frontend no cambian. Para buscar un
radicado por número se guarda además `numeroRadicadoIndice`, una huella HMAC
del número normalizado (sin espacios, en mayúsculas): la búsqueda exacta y la
unicidad funcionan sin descifrar nada. La búsqueda libre (parte del número,
del asunto o del remitente) descifra y filtra en el servidor. El consecutivo
`RAD-<año>-####` sale de la colección `contadores`.

**Barrido automático** (`backend/src/services/barridoCifrado.js`): lo que
entre a la base POR FUERA de la aplicación (un documento creado a mano en
Atlas, un script con el cliente sin cifrado, una importación directa) se
cifra solo, con la misma llave:

- en cada revisión diaria del cron (`/api/cron/alertas`; la respuesta trae
  `cifrado.cambiados` y el log avisa si encontró algo);
- al arrancar el servidor (`npm run dev` / `npm start`);
- a mano cuando quieras: `npm run datos:cifrar` en `backend/`.

Solo descarga los documentos que tengan algo sin cifrar (filtros de MongoDB
sobre el prefijo `enc:v1:` y la firma `ENC1` de los PDFs), así que cuando
todo está cifrado no cuesta nada. Entre la inserción manual y el siguiente
barrido ese documento queda en claro: si metes datos a mano, corre
`npm run datos:cifrar` al terminar.

**La llave (`CLAVE_MAESTRA_DATOS`)**

- Solo el programador la tiene: vive en `backend/.env` (que no se sube al
  repo) y en Vercel → Settings → Environment Variables. Nunca en la base.
- Sin ella el backend no arranca.
- **No se cambia ni se pierde**: lo cifrado con una llave solo se lee con esa
  llave. Guarda una copia en un gestor de contraseñas.

**Activarlo sobre una base que ya tiene datos** (una sola vez, desde `backend/`):

1. Respaldo de la base (Atlas → *Backup*, o `mongodump`).
2. `npm run claves:generar -- --guardar` y copia la llave en Vercel.
3. `npx prisma generate`
4. `npm run datos:cifrar -- --simular` — cuenta lo que va a cifrar, sin escribir.
5. `npm run datos:cifrar` — cifra (idempotente: si se corta, se vuelve a correr).
6. `npm run db:push` desde `acusan/` — crea el índice único del número.
7. `npm test` — incluye `tests/cifrado-bd.test.mjs`, que comprueba que lo
   guardado en la base de verdad está cifrado.

Opciones de `npm run datos:cifrar`: `-- --simular` (solo cuenta),
`-- --todo` (revisa documento por documento) y `-- --revertir` (plan B:
descifra todo de vuelta, con la misma llave).

## ⏰ Alertas (motor único)

Un solo motor revisa los radicados **pendientes** que vencen en ≤ 30 días
(incluidos los ya vencidos) y crea una alerta por cada `(radicado, nivel,
fecha límite)` sin duplicar. Niveles acumulativos: **D30, D15, D7, D3,
D1 y Vencido** (los niveles de días solo se disparan si el plazo total del
radicado los alcanza a ver). Las recibe el encargado y el líder del área;
las **vencidas escalan a gerencia**. Responder o eliminar el radicado
cierra sus alertas pendientes y actualiza la campana del encabezado.

Gerencia puede correr la revisión en vivo desde *Radicados* o *Resumen →
Alertar* (por área, con reenvío forzado).

### Alertas diarias (revisión programada)

Correr la revisión una vez al día es responsabilidad de un programador
externo: **el backend no asume dónde corre**, así que hay tres formas de
lograrlo. Todas usan el mismo secreto `CRON_SECRET` definido en
`backend/.env` (en Vercel: variable de entorno — recuerda que cambiarla
exige un redeploy). La misma corrida también **sincroniza los informes**
de periodo (ver la sección Informes).

#### Opción 1 — Endpoint HTTP protegido (cron del sistema, GitHub Actions, cualquier host)

```
POST https://<host>/api/cron/alertas
Headers: x-cron-secret: <CRON_SECRET>       (o Authorization: Bearer <CRON_SECRET>)
```

- Sin secreto o con secreto equivocado → `401`. Sin `CRON_SECRET` configurado → `503`.
- Ejemplo con `curl` en un crontab de Linux (`0 12 * * *`, mediodía):

  ```cron
  0 12 * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://acuusan.vercel.app/api/cron/alertas
  ```

- Ejemplo con GitHub Actions (`.github/workflows/alertas.yml` en el repo, secreto
  `CRON_SECRET` guardado en Settings → Secrets → Actions; UTC solamente):

  ```yaml
  name: Alertas diarias
  on:
    schedule:
      - cron: '0 17 * * *'   # 17:00 UTC = mediodía de Bogotá
  jobs:
    revisar:
      runs-on: ubuntu-latest
      steps:
        - run: curl -fsS -X POST -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" https://acuusan.vercel.app/api/cron/alertas
  ```

- En Windows local: Programador de tareas → tarea diaria que ejecute
  `curl -fsS -X POST -H "x-cron-secret: ..." http://localhost:3000/api/cron/alertas`.

#### Opción 2 — Vercel Cron (configurada en `vercel.json`)

`vercel.json` ya trae el cron: todos los días a las **11:00 UTC (6:00 a. m.
de Bogotá)** Vercel llama `GET /api/cron/alertas`. Si la variable
`CRON_SECRET` está definida en Vercel, Vercel la envía sola como
`Authorization: Bearer <CRON_SECRET>`, y el endpoint la acepta: el secreto no
va en el repositorio. La misma llamada corre la revisión de alertas, el
cierre de informes y el **barrido de cifrado**.

```json
"crons": [{ "path": "/api/cron/alertas", "schedule": "0 11 * * *" }]
```

La función serverless ya tiene `maxDuration: 300`, de sobra para la revisión.
En el plan Hobby los cron corren una vez al día y el `schedule` va en UTC.

#### Opción 3 — Script local sin HTTP

```bash
npm run alertas:diarias          # desde acusan/
node scripts/alertas-diarias.mjs # desde backend/
```

Útil para probar en desarrollo o si el backend corre en una máquina propia
(crontab/Programador de tareas apuntando directo al script).

### Notificaciones

Por ahora no se envían correos: todo pasa por `enviarNotificacion(alerta, destinatarios)`
en `backend/src/modules/alertas/notificaciones.js` — ese es el único punto donde
se conectará el correo real más adelante.

## 📅 Calendario hábil

Los plazos, alertas e informes cuentan **días hábiles**: lunes a sábado no —
lunes a viernes, sin festivos. Los 18 festivos oficiales de Colombia se
calculan para cualquier año (fijos, Ley Emiliani y los móviles de Pascua) en
`backend/src/lib/calendarioCO.js`, sin tablas ni APIs externas.

- **Tira "Hoy"** (todos los roles): en el encabezado muestra la fecha, si el
  día es hábil/fin de semana/festivo y el próximo festivo con días restantes.
  En gerencia, un clic abre el calendario.
- **Vista Calendario** (gerencia, `/calendario`): mes completo con festivos,
  fines de semana, vencimientos por día (badge rojo con la cantidad) y el
  detalle del día seleccionado (radicados que vencen, con área y encargado).
  Navegable con teclado (flechas, RePág/AvPág, Inicio/Fin).
- **Días no laborales extra** (gerencia): ferias, paros o cierres registrados
  en la misma vista; se descuentan como festivo en todo el sistema. La API es
  `GET/POST/DELETE /api/calendario/no-laborales` (solo `LIDER_GENERAL`).
- **API de lectura** (todos los roles, con scope por rol): `GET /api/calendario/hoy`,
  `GET /api/calendario?anio=&mes=`, `GET /api/calendario/festivos?anio=`,
  `GET /api/calendario/dia?fecha=`.

## 📊 Informes periódicos (gerencia)

Foto semanal y mensual del movimiento de radicados, con **corte por días
hábiles**: cada periodo cierra al final de su último día hábil y lo que pasa
después (fin de semana o festivo tras el corte) entra al periodo siguiente.
Los números de un informe guardado **no cambian** aunque después se editen o
respondan radicados — se regeneran solo a pedido o al cerrar.

- **Cierre automático**: la corrida diaria de alertas también sincroniza
  informes (idempotente): crea el informe de cada periodo cerrado que falte y
  reemplaza los parciales que ya cerraron, hasta 24 periodos hacia atrás.
  Cada cierre genera un **aviso de gerencia** con el resumen del periodo.
- **Vista Informes** (`/informes`): pestañas Semanales/Mensuales, gráfica de
  tendencia (a tiempo vs con retraso), tabla comparativa, detalle con
  indicadores y diferencia contra el periodo anterior, desglose por área,
  radicados críticos (enlace a Radicados) y franja día por día.
- **Revisar / Regenerar / Exportar**: marcar revisado atiende el aviso del
  periodo (sin perderse al regenerar); exportar descarga el Excel de 3 hojas
  (Resumen, Por área, Críticos).
- **Generar a mano**: `POST /api/informes/generar` acepta un periodo pasado o
  el actual (queda como *parcial* hasta el cierre).
- Recalcular histórico conservando marcas de revisado:
  `npm run informes:recalcular` (desde `backend/`, con `--dry-run` para ver
  qué haría sin escribir).

## 👥 Usuarios (administración de cuentas)

Vista **Usuarios** (`/usuarios`): gerencia administra todas las áreas; el
líder de área administra los usuarios de la suya (el backend vuelve a
validar cada permiso).

- **Crear cuenta**: nombre, correo, rol y área (el líder crea solo
  usuarios de su área). Contraseña inicial opcional: vacío = **contraseña
  temporal** generada por el sistema que la persona **debe cambiar al
  entrar** (modal obligatorio, no cerrable). Con correo configurado se envía
  además una invitación con enlace.
- **Editar / cambiar de área**: si el cambio deja radicados pendientes
  atrás, el backend responde `TIENE_PENDIENTES` y se abre la **reasignación**
  (quién del área los recibe; queda registrado en cada radicado).
- **Desactivar**: cierra sus sesiones abiertas de inmediato (middleware
  `cuentaVigente`) y no puede entrar; si tiene pendientes, se reasignan al
  desactivar. El historial se conserva.
- **Restablecer contraseña**: genera una temporal (cierra las demás
  sesiones); con SMTP la persona recibe un enlace para crear una nueva.
- **Autorregistro**: desde el login («Crear Nuevo Usuario») la solicitud
  queda **pendiente de aprobación**; gerencia la aprueba asignando área y
  rol, o la rechaza.
- **Bloqueo por intentos**: 5 contraseñas erradas bloquean la cuenta 15
  minutos. Desactivar, cambiar el rol o restablecer contraseña afecta las
  sesiones abiertas al instante.

## 📧 Correo (SMTP)

`backend/src/services/correo.js` centraliza el envío: resumen de alertas por
persona, aviso de radicado asignado, invitación y recuperación de
contraseña. **Sin SMTP configurado no falla nada**: los envíos solo quedan
registrados en el log del servidor y las temporales se entregan en persona.

Variables (en `backend/.env` y Vercel):

| Variable | Qué es |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Servidor de correo (`SECURE=true` para puerto 465) |
| `SMTP_USER` / `SMTP_PASS` | Credenciales de la cuenta que envía |
| `CORREO_REMITENTE` | Dirección que aparece como remitente |
| `APP_URL` | URL pública de la app (arma los enlaces de invitación/recuperación) |

La recuperación («¿Olvidó su contraseña?») ofrece el enlace por correo solo
con SMTP activo; sin SMTP guía a pedírsela a gerencia o al líder desde
*Usuarios*.

## 🗄️ PDFs fuera de la base (opcional)

Los PDF siempre viajan y reposan **cifrados**. Dónde viven los bytes lo
decide `ALMACEN_PDF` (en `backend/.env` / Vercel):

| Valor | Dónde quedan | Variables extra |
|---|---|---|
| `mongo` (default) | Colección `adjuntos` | — |
| `blob` | Vercel Blob | `BLOB_READ_WRITE_TOKEN` |
| `disco` | Carpeta del servidor | `ALMACEN_PDF_DIR` |

Para mudar los existentes: `npm run pdfs:mover -- --simular` (revisa y
cuenta), `npm run pdfs:mover` (mueve) y `--revertir` (vuelve atrás si algo
queda mal). En Vercel: Storage → Blob → copiar el token a las variables.

## Qué queda pendiente

- Configurar en Vercel las variables nuevas (SMTP, `APP_URL`, Blob si se
  usa) y correr `npm run db:push` contra la base real **antes** de publicar
  (solo agrega el índice de usuarios; hacer respaldo antes).
- Probar en navegador el flujo de recuperación **con SMTP real** (el
  recorrido sin SMTP ya está verificado).
