# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight Backend — Production Dockerfile
# Python 3.11 + FastAPI + uvicorn (4 workers)
# ═══════════════════════════════════════════════════════════════════════════════

FROM python:3.11-slim

# Dépendances système :
# - ffmpeg : yt-dlp audio extraction
# - gcc + libpq-dev : compilation psycopg2, asyncpg
# - curl : healthcheck
# - weasyprint deps : libpango, libcairo, libgdk-pixbuf, libffi
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    gcc \
    libpq-dev \
    curl \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libglib2.0-0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

WORKDIR /app/src

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:8080/health || exit 1

# 4 workers pour 8 vCPU (I/O bound async → 1 worker / 2 vCPU)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", \
     "--timeout-keep-alive", "300", "--limit-concurrency", "200", \
     "--workers", "4"]
