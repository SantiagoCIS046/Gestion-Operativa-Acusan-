# 🔒 Protección del módulo Radicados — SOLO LECTURA

**Fecha de congelamiento:** 2026-09-03 · **Tag git:** `radicados-estable-v1`

El módulo de Radicados (ventanilla + oficios de respuesta + expedientes) se
declaró **terminado y estable**. Queda congelado: no se edita, no se
refactoriza, no se "mejora" sin aprobación explícita. Esta protección es la
misma del módulo Permisos y existe porque cambios no coordinados (humanos o
de IAs) ya han roto el sistema entero antes.

## Qué está congelado

Todo el contenido de estos dos directorios (cada archivo, incluidos nuevos
archivos que aparezcan dentro):

| Capa | Directorio |
|---|---|
| Frontend | `acusan/frontend/src/modules/radicados/` (vistas, componentes, servicios: radicados, respuestas, OCR, compresor) |
| Backend | `acusan/backend/src/modules/radicados/` (rutas, controlador, servicio) |

## Cómo funciona la protección

1. **`scripts/proteccion/radicados.lock.json`** — foto congelada: hash SHA-256
   de cada archivo (normalizado CRLF→LF para no depender de `core.autocrlf`).
2. **`scripts/proteccion/verificar-radicados.mjs`** — compara el estado actual
   (disco o index de git) contra el lock. Detecta modificaciones, archivos
   nuevos y eliminaciones.
3. **Hook `pre-commit` de git** — un commit que toque los directorios
   protegidos (o `scripts/proteccion/`) con contenido distinto al lock
   **se rechaza automáticamente**. (El hook vive en `.git/hooks/pre-commit`;
   es local a esta máquina.)
4. **`npm run dev`** — al arrancar, avisa con cartel rojo si el módulo derivó.
5. **Marcadores `PROTEGIDO-LEER.md`** dentro de cada directorio congelado.

## Si el verificador se dispara

- **Fue un accidente / otra IA tocó algo:** restaurar el estado estable:
  ```
  git checkout radicados-estable-v1 -- acusan/frontend/src/modules/radicados acusan/backend/src/modules/radicados
  ```
- **El cambio es intencional y aprobado por el propietario:**
  ```
  # 1. Hacer los cambios en el módulo
  # 2. Regenerar la foto (requiere la llave explícita):
  RADICADOS_DESBLOQUEAR=1 node scripts/proteccion/verificar-radicados.mjs --generar
  # (PowerShell: $env:RADICADOS_DESBLOQUEAR='1'; node scripts/proteccion/verificar-radicados.mjs --generar)
  # 3. Commitar juntos el cambio + el lock actualizado, con la llave AÚN ACTIVA
  #    (PowerShell: mantener $env:RADICADOS_DESBLOQUEAR='1' durante el commit)
  ```

## Diseño de confianza (idéntico al de Permisos, revisión adversarial 2026-09-01)

- El modo `--staged` toma el lock de **HEAD** (`git show HEAD:...`), nunca del
  disco: editar el hash dentro del lock a mano **no legitima** un cambio.
- El modo disco reporta un lock local que difiera del de HEAD como
  **LOCK MANIPULADO**.
- Los hooks ejecutan el verificador **extraído de HEAD**, no el del disco:
  manipular `scripts/proteccion/` en disco no ciega la puerta del commit.
- `--staged` compara el conjunto completo del index (`git ls-files -z`)
  contra el lock: inmune a renombrados (`git mv`) y a paths con ñ/acentos.
- Ante cualquier fallo de git el verificador aborta con exit 1 (fail-closed):
  nunca imprime "íntegro" sin haber comparado.
- La llave de cada módulo (`PERMISOS_DESBLOQUEAR` / `RADICADOS_DESBLOQUEAR`)
  solo abre su propia puerta: desbloquear Radicados no habilita tocar Permisos.

## Qué puerta bloquea qué

| Operación | Puerta | Estado |
|---|---|---|
| `git commit` que toca Radicados, Permisos o `scripts/proteccion/` | pre-commit | ✅ bloquea |
| `git merge` / `git pull` (con merge) | pre-merge-commit | ✅ bloquea |
| `git push` con deriva local | pre-push | ⚠️ avisa |
| `npm run dev` con deriva | cartel de arranque | ⚠️ avisa |
| `git cherry-pick` / `git rebase` | — | ❌ sin puerta (el disco lo detecta después) |
| `git commit --no-verify` | — | ❌ salta todo — **no usar** |
| Otro clon / GitHub web | hooks son locales | ❌ reinstalar hooks + el disco avisa |

## Puntos de contacto externos (NO congelados; editarlos cambia Radicados)

- `acusan/backend/src/app.js` — montaje de `/api/radicados` y middlewares
- `acusan/backend/src/middlewares/*` — auth y auditoría que lo envuelven
- `acusan/backend/src/config/prisma.js` y `logger.js` — cliente BD y logs que
  el módulo importa en runtime
- `acusan/backend/prisma/schema.prisma` — modelos `Radicado` / `RespuestaRadicado`
- `acusan/frontend/src/modules/auth/services/authService.js` — contrato
  `getAuthHeader()`/`logout()` que radicadosService y respuestasService usan
  en cada request
- `acusan/frontend/src/components/PageHeader.vue` — componente compartido por
  vistas congeladas de Radicados
- Router (`acusan/frontend/src/router/index.js`), `App.vue` y menús del
  frontend (rutas hacia las vistas de Radicados)

## Límites honestos de la protección

- Los hooks viven en `.git/hooks/` → **locales a esta máquina**. Un clon nuevo
  u otra máquina debe reinstalarlos (este archivo es la referencia; también
  `git config core.hooksPath` los anula: no tocar).
- Un atacante determinado con derechos locales siempre puede desactivar la
  protección (borrar hooks, `--no-verify`). El objetivo es frenar ediciones
  accidentales y cambios no coordinados, no defenderse del dueño.
- Un despliegue de Vercel construye desde git: mientras nadie commitar cambios
  en los directorios protegidos, producción queda intacta.
