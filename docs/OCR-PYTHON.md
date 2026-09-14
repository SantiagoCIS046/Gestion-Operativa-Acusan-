# Motor OCR Python — Guía técnica

Motor de escaneo de PDFs/imágenes de Acuusan, escrito en Python. Es el **motor
principal** de extracción para las páginas de **Permisos** (VistaEncargado) y
**Radicados** (VistaRadicados + PanelRespuestas). Si el motor no está
disponible, el sistema degrada en silencio al OCR del navegador
(tesseract.js) en Radicados, o a diligencio manual en Permisos — el usuario
nunca ve un error.

> **Regla de oro**: el dato sale del documento o el campo queda vacío. El
> pipeline solo compite y selecciona texto entre pases de OCR; ninguna etapa
> genera o inventa contenido. Ningún OCR garantiza el 100% de acierto en
> documentos arbitrarios borrosos — el diseño maximiza la extracción.

## Arquitectura (3 capas + fallback)

```
[Vue Permisos/Radicados]
   │  POST /api/ocr/escanear  (JWT + rol RADICADOS/ENCARGADO/ADMIN)
   │  payload: { archivoBase64 (ORIGINAL, data URL), nombreArchivo, mimeType, dominio }
   ▼
[Node Express — src/modules/ocr]   ← puente: valida tamaño (413 >40MB), reenvía
   │  fetch + AbortController (OCR_PY_TIMEOUT_MS, 90s)
   │  caído → 503 · timeout → 504 · error Python → 502
   ▼
[Flask 127.0.0.1:5001 — acusan/backend/acuusan_ocr/server.py]
   │  extraction.py: PDF digital por página (PyMuPDF) → raster 300dpi gris
   │  → preprocesado OpenCV (A: borroso · B: contraste) → multi-pase
   │  Tesseract 'spa' (PSM 6/3/11) → gana el pase con mejor confianza
   │  → pase extra del sello (40% superior pág. 1, se CONCATENA)
   ▼
{ success, metodo, paginas, texto, tipo?, campos, confianza?, faltantes? }
```

- La decisión digital/escaneado es **por página** (los PDFs híbridos
  existen): `metodo` ∈ `pdf-digital | ocr-tesseract | hibrido | imagen-ocr`.
- Al OCR viaja el archivo **original**; la compresión (para guardar en BD)
  sigue su curso en paralelo — la fidelidad del OCR no se sacrifica.

## Puesta en marcha local

1. **Tesseract OCR** (una sola vez): instalador UB-Mannheim
   (`winget install UB-Mannheim.TesseractOCR`). El idioma **español NO hace
   falta instalarlo con el instalador**: el repo trae su propio
   `acuusan_ocr/tessdata/spa.traineddata`. Si el PATH queda roto:
   `OCR_TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe`.
2. **Dependencias Python** (Python 3.10+):
   ```
   .venv\Scripts\python -m pip install -r acusan/backend/acuusan_ocr/requirements.txt
   ```
3. **Arrancar todo**: `npm run dev` (levanta API + WEB + OCR-PY). El proceso
   OCR-PY es opcional: si falla, avisa una vez y el resto sigue.

Verificación rápida:
```
curl http://127.0.0.1:5001/api/health
# → { "status": "online", ..., "tesseract_disponible": true, "spa_disponible": true }
```

## Variables de entorno

| Variable | Dónde | Default | Qué hace |
|---|---|---|---|
| `OCR_PY_URL` | Node (.env backend) | `http://127.0.0.1:5001` | Dónde vive el servicio Python |
| `OCR_PY_TIMEOUT_MS` | Node (.env backend) | `90000` | Timeout del puente al Python |
| `PORT_OCR` | Python | `5001` | Puerto del Flask |
| `OCR_MAX_PAGINAS` | Python | `6` | Tope de páginas procesadas por documento |
| `OCR_DPI` | Python | `300` | Resolución del rasterizado |
| `OCR_TIMEOUT_TESS` | Python | `20` | Timeout (s) por pase de Tesseract |
| `OCR_TESSDATA_DIR` | Python | `acuusan_ocr/tessdata` | Directorio de traineddata |
| `OCR_TESSERACT_CMD` | Python | autodetección (PATH → rutas Windows) | Binario de Tesseract |

## Pruebas

```
# Parsers + pipeline + servidor (Python)
.venv\Scripts\python -m pytest acusan/backend/tests/ocr -q

# Puente Node contra un stub del servicio Python
node acusan/backend/tests/ocrBridge.test.mjs

# Parser JS (fallback del navegador — tocar un parser obliga a correr ambos)
node acusan/backend/tests/radicadosParser.test.mjs
```

## Deriva de parsers (nota de mantenimiento)

Hay DOS parsers de radicados vivos: el JS del backend (fallback del
navegador) y el Python (motor principal, porte 1:1 pero ya divergió en la
detección documental: Python tiene la regla `Respuesta a Radicado No.: +60`).
**Regla**: cuando Python responde, su `tipo` y `campos` son la verdad. Al
modificar cualquiera de los dos parsers, correr ambos corpora de pruebas
para mantener la paridad de la regla de oro.

## Fase 2 — producción (Vercel), AÚN NO IMPLEMENTADA

Hoy Vercel solo ejecuta la función Node (`api/index.js`): sin servicio
Python, `/api/ocr/escanear` devuelve 503 en milisegundos y el frontend cae
al OCR del navegador — todo sigue funcionando. Para activar Python en
producción:

1. Desplegar el servicio en un host con procesos persistentes
   (Railway / Render / Fly.io): mismo código, `PORT_OCR` al puerto del host.
2. Configurar en Vercel: `OCR_PY_URL=https://<host-ocr>` (+ timeout ajustado).
3. Añadir autenticación propia al servicio si deja de ser localhost
   (hoy la seguridad vive en el puente Node: JWT + rol).

**No se recomienda** migrar el motor a funciones Python de Vercel: sin
binario Tesseract en ese runtime, 30 s de duración máxima y 1024 MB —
hostiles al multi-pase. Nota de licencia: PyMuPDF es AGPL — uso interno
sin problema; revisar al exponer el servicio públicamente.
