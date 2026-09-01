# 🔒 Protección del módulo Permisos — SOLO LECTURA

**Fecha de congelamiento:** 2026-09-01 · **Tag git:** `permisos-estable-v1`

El módulo de Permisos (laborales) se declaró **terminado y estable**. Queda
congelado: no se edita, no se refactoriza, no se "mejora" sin aprobación
explícita. Esta protección existe porque cambios no coordinados (humanos o
de IAs) ya han roto el sistema entero antes.

## Qué está congelado

Todo el contenido de estos dos directorios (cada archivo, incluidos nuevos
archivos que aparezcan dentro):

| Capa | Directorio |
|---|---|
| Frontend | `acusan/frontend/src/modules/permisos/` (vistas, componentes, servicio) |
| Backend | `acusan/backend/src/modules/permisos/` (rutas, controlador, servicio) |

## Cómo funciona la protección

1. **`scripts/proteccion/permisos.lock.json`** — foto congelada: hash SHA-256
   de cada archivo (normalizado CRLF→LF para no depender de `core.autocrlf`).
2. **`scripts/proteccion/verificar-permisos.mjs`** — compara el estado actual
   (disco o index de git) contra el lock. Detecta modificaciones, archivos
   nuevos y eliminaciones.
3. **Hook `pre-commit` de git** — un commit que toque los directorios
   protegidos con contenido distinto al lock **se rechaza automáticamente**.
   (El hook vive en `.git/hooks/pre-commit`; es local a esta máquina.)
4. **`npm run dev`** — al arrancar, avisa con cartel rojo si el módulo derivó.
5. **Marcadores `PROTEGIDO-LEER.md`** dentro de cada directorio congelado.

## Si el verificador se dispara

- **Fue un accidente / otra IA tocó algo:** restaurar el estado estable:
  ```
  git checkout permisos-estable-v1 -- acusan/frontend/src/modules/permisos acusan/backend/src/modules/permisos
  ```
- **El cambio es intencional y aprobado por el propietario:**
  ```
  # 1. Hacer los cambios en el módulo
  # 2. Regenerar la foto (requiere la llave explícita):
  PERMISOS_DESBLOQUEAR=1 node scripts/proteccion/verificar-permisos.mjs --generar
  # (PowerShell: $env:PERMISOS_DESBLOQUEAR='1'; node scripts/proteccion/verificar-permisos.mjs --generar)
  # 3. Commitar juntos el cambio + el lock actualizado, con la llave AÚN ACTIVA
  #    (PowerShell: mantener $env:PERMISOS_DESBLOQUEAR='1' durante el commit)
  ```

## Diseño de confianza (tras revisión adversarial 2026-09-01)

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

## Qué puerta bloquea qué

| Operación | Puerta | Estado |
|---|---|---|
| `git commit` que toca Permisos o `scripts/proteccion/` | pre-commit | ✅ bloquea |
| `git merge` / `git pull` (con merge) | pre-merge-commit | ✅ bloquea |
| `git push` con deriva local | pre-push | ⚠️ avisa |
| `npm run dev` con deriva | cartel de arranque | ⚠️ avisa |
| `git cherry-pick` / `git rebase` | — | ❌ sin puerta (el disco lo detecta después) |
| `git commit --no-verify` | — | ❌ salta todo — **no usar** |
| Otro clon / GitHub web | hooks son locales | ❌ reinstalar hooks + el disco avisa |

## Puntos de contacto externos (NO congelados; editarlos cambia Permisos)

- `acusan/backend/src/app.js` — montaje de `/api/permisos` y middlewares
- `acusan/backend/src/middlewares/*` — auth y auditoría que lo envuelven
- `acusan/backend/src/config/prisma.js` y `logger.js` — cliente BD y logs que
  el módulo importa en runtime
- `acusan/backend/prisma/schema.prisma` — modelos Permiso/EstadoPermiso
- `acusan/frontend/src/modules/auth/services/authService.js` — contrato
  `getAuthHeader()`/`logout()` que permisosService usa en cada request
- `acusan/frontend/src/services/sincronizacionService.js` — **IMPORTA**
  permisosService y dispara `sincronizarPendientes()` al arrancar/login/online
- `acusan/frontend/src/components/PageHeader.vue` — componente compartido por
  ambas vistas congeladas
- Router y menús del frontend (rutas hacia las vistas de Permisos)
- `acusan/frontend/src/services/*` compartidos que Permisos importa

## Límites honestos de la protección

- Los hooks viven en `.git/hooks/` → **locales a esta máquina**. Un clon nuevo
  u otra máquina debe reinstalarlos (este archivo es la referencia; también
  `git config core.hooksPath` los anula: no tocar).
- Un atacante determinado con derechos locales siempre puede desactivar la
  protección (borrar hooks, `--no-verify`). El objetivo es frenar ediciones
  accidentales y cambios no coordinados, no defenderse del dueño.
- Un despliegue de Vercel construye desde git: mientras nadie commitar cambios
  en los directorios protegidos, producción queda intacta.
