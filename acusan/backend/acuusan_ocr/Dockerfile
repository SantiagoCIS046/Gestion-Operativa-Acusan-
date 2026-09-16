FROM python:3.11-slim

# Instalar Tesseract OCR, idioma español y librerías del sistema requeridas por OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del servicio OCR
COPY . .

ENV PORT=10000
EXPOSE 10000

CMD ["python", "server.py"]
