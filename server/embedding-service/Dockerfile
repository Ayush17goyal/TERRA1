# ===========================================================================
# BGE-M3 Embedding Service — Dockerfile
# ===========================================================================
# Builds the Python FastAPI sidecar that loads BAAI/bge-m3 and exposes
# HTTP endpoints for generating 1024-dimensional dense embeddings.
#
# Build:
#   docker build -t legatrixon-bge-m3 ./server/embedding-service
#
# Run:
#   docker run -p 8100:8100 legatrixon-bge-m3
# ===========================================================================

FROM python:3.11-slim AS base

# System dependencies for numpy/scipy wheels
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the model at build time for fast cold starts
RUN python -c "from FlagEmbedding import BGEM3FlagModel; BGEM3FlagModel('BAAI/bge-m3', use_fp16=True)"

# Copy application code
COPY main.py .

# Runtime config
ENV BGE_MODEL_NAME=BAAI/bge-m3
ENV BGE_PORT=8100
ENV BGE_MAX_LENGTH=8192
ENV BGE_BATCH_SIZE=64

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
