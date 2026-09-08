# 🔒 Protección del módulo PQR — SOLO LECTURA (congelado por conflicto)

**Fecha de congelamiento:** 2026-09-08 · **Tag git:** `pqr-congelado-v1`

A diferencia de Permisos y Radicados (congelados por estar terminados y
estables), el módulo PQR está congelado **temporalmente mientras se resuelve
un conflicto en curso sobre su desarrollo**. El estado congelado incluye
trabajo sin revisar (instantánea del commit `wip d0168a6`): es una foto de
"no tocar nada hasta que se resuelva", no un sello de calidad.

Además del congelamiento de código, **la página está bloqueada para los
usuarios**: toda navegación a `/pqr/*` redirige a una pantalla de "módulo no
disponible" (bandera `PQR_BLOQUEADO` en `acusan/frontend/src/router/index.js`).

## Qué está congelado

Todo el contenido de estos dos directorios (cada archivo, incluidos nuevos
archivos que aparezcan dentro):

| Capa | Directorio |
|---|---|
| Frontend | `acusan/frontend/src/modules/pqr/` (vistas, componentes, servicios) |
| Backend | `acusan/backend/src/modules/pqr/` (rutas, controladores, servicio, worker de WhatsApp) |

Quedan FUERA del congelamiento (y siguen siendo editables): el router, la
bandera de bloqueo `PQR_BLOQUEADO`, `socket.service.js`, `pqrStore.js`,
`schema.prisma` y la infraestructura compartida.

## Cómo funciona la protección

1. **`scripts/proteccion/pqr.lock.json`** — foto congelada: hash SHA-256
   de cada archivo (normalizado CRLF→LF para no depender de `core.autocrlf`).
2. **`scripts/proteccion/verificar-pqr.mjs`** — compara el estado actual
   (disco o index de git) contra el lock. Detecta modificaciones, archivos
   nuevos y eliminaciones.
3. **Hook `pre-commit` de git** — un commit que toque los directorios
   protegidos (o `scripts/proteccion/`) con contenido distinto al lock
   **se rechaza automáticamente**. (El hook vive en `.git/hooks/pre-commit`;
   es local a esta máquina.)
4. **Hook `pre-merge-commit`** — un merge/pull que traiga cambios en PQR
   se aborta.
5. **Hook `pre-push` + `npm run dev`** — avisan con cartel si el módulo derivó.
6. **Marcadores `PROTEGIDO-LEER.md`** dentro de cada directorio congelado.

## Si el verificador se dispara

- **Fue un accidente / otra IA tocó algo:** restaurar el estado congelado:
  ```
  git checkout pqr-congelado-v1 -- acusan/frontend/src/modules/pqr acusan/backend/src/modules/pqr
  ```
- **El conflicto ya fue resuelto y el cambio es intencional y aprobado:**
  ```
  # 1. Hacer los cambios en el módulo
  # 2. Regenerar la foto (requiere la llave explícita):
  PQR_DESBLOQUEAR=1 node scripts/proteccion/verificar-pqr.mjs --generar
  # (PowerShell: $env:PQR_DESBLOQUEAR='1'; node scripts/proteccion/verificar-pqr.mjs --generar)
  # 3. Commitar juntos el cambio + el lock actualizado, con la llave AÚN ACTIVA
  #    (PowerShell: mantener $env:PQR_DESBLOQUEAR='1' durante el commit)
  ```

## Descongelar por completo (fin del conflicto)

1. `PQR_BLOQUEADO = false` en `acusan/frontend/src/router/index.js`
   (o eliminar los tres puntos marcados `[BLOQUEO-PQR]`: bandera, guard
   y ruta).
2. Decidir si el congelamiento de código sigue (convertirlo en permanente
   como Radicados) o se retira: borrar la sección PQR de los tres hooks
   (`.git/hooks/pre-commit`, `pre-merge-commit`, `pre-push`), la entrada en
   `AVISOS_PROTECCION` de `scripts/dev.mjs`, y archivar `pqr.lock.json`
   y `verificar-pqr.mjs`.

## Diseño de confianza (idéntico al de Permisos/Radicados)

- El modo `--staged` toma el lock de **HEAD** (`git show HEAD:...`), nunca del
  disco: editar el hash dentro del lock a mano **no legitima** un cambio.
- El modo disco reporta un lock local que difiera del de HEAD como
  **LOCK MANIPULADO**.
- Los hooks ejecutan el verificador **extraído de HEAD**, no el del disco:
  manipular `scripts/proteccion/` en disco no ciega la puerta del commit.
- `--staged` compara el conjunto completo del index (`git ls-files -z`)
  contra el lock: inmune a renombrados (`git mv`) y a paths con ñ/acentos.
- Cada llave (`PQR_DESBLOQUEAR`) solo abre la puerta de PQR; Permisos y
  Radicados siguen verificados en el mismo commit.
