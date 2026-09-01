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
  # 3. Commitar juntos el cambio + el lock actualizado → nueva foto estable
  ```

## Límites honestos de la protección

- `git commit --no-verify` salta el hook (queda el aviso de `npm run dev`
  y el lock como detector). **No usen --no-verify** en este repo.
- Archivos FUERA de los dos directorios no están congelados. El módulo
  Permisos depende de estos puntos de contacto externos (editarlos puede
  cambiar el comportamiento de Permisos igualmente):
  - `acusan/backend/src/app.js` — montaje de `/api/permisos` y middlewares
  - `acusan/backend/src/middlewares/*` — auth y auditoría que lo envuelven
  - `acusan/backend/prisma/schema.prisma` — modelos Permiso/EstadoPermiso
  - Router y menús del frontend (rutas hacia las vistas de Permisos)
  - `acusan/frontend/src/services/*` compartidos que Permisos importa
- Un despliegue de Vercel construye desde git: mientras nadie commitar cambios
  en los directorios protegidos, producción queda intacta.
