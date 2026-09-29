"""
BGE-M3 Embedding Microservice
==============================
A lightweight FastAPI sidecar that loads the BAAI/bge-m3 model
and exposes HTTP endpoints for generating 1024-dimensional dense embeddings.

Usage:
    python main.py
    # or
    uvicorn main:app --host 0.0.0.0 --port 8100 --reload

Environment Variables:
    BGE_MODEL_NAME  - HuggingFace model name (default: BAAI/bge-m3)
    BGE_PORT        - Server port (default: 8100)
    BGE_MAX_LENGTH  - Max token length for encoding (default: 8192)
    BGE_BATCH_SIZE  - Internal batch size for the model (default: 64)
"""

import asyncio
import os
import time
import logging
from contextlib import asynccontextmanager
from functools import partial
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MODEL_NAME = os.getenv("BGE_MODEL_NAME", "BAAI/bge-m3")
PORT = int(os.getenv("BGE_PORT", "8100"))
MAX_LENGTH = int(os.getenv("BGE_MAX_LENGTH", "512"))   # 512 tokens is plenty for ~800-char legal chunks
BATCH_SIZE = int(os.getenv("BGE_BATCH_SIZE", "16"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("bge-m3-service")

# ---------------------------------------------------------------------------
# Global model reference
# ---------------------------------------------------------------------------

model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, release on shutdown."""
    global model
    logger.info(f"Loading BGE-M3 model: {MODEL_NAME} ...")
    start = time.time()

    try:
        from FlagEmbedding import BGEM3FlagModel

        model = BGEM3FlagModel(
            MODEL_NAME,
            use_fp16=True,  # Half-precision for speed; safe on both CPU & GPU
        )
        elapsed = round(time.time() - start, 2)
        logger.info(f"Model loaded successfully in {elapsed}s")
    except Exception as exc:
        logger.error(f"Failed to load model: {exc}")
        raise RuntimeError(f"Could not load BGE-M3 model: {exc}") from exc

    yield  # Application runs here

    logger.info("Shutting down BGE-M3 service …")
    model = None


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="BGE-M3 Embedding Service",
    description="Generates 1024-dim dense embeddings using BAAI/bge-m3",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to embed")
    max_length: Optional[int] = Field(
        None, description="Override max token length for this request"
    )


class EmbedBatchRequest(BaseModel):
    texts: list[str] = Field(
        ..., min_length=1, max_length=256, description="Texts to embed (max 256)"
    )
    max_length: Optional[int] = Field(
        None, description="Override max token length for this batch"
    )


class EmbedResponse(BaseModel):
    embedding: list[float]
    dimension: int
    model: str


class EmbedBatchResponse(BaseModel):
    embeddings: list[list[float]]
    count: int
    dimension: int
    model: str


class HealthResponse(BaseModel):
    status: str
    model: str
    dimension: int
    max_length: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check — confirms model is loaded and ready."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return HealthResponse(
        status="healthy",
        model=MODEL_NAME,
        dimension=1024,
        max_length=MAX_LENGTH,
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed_single(req: EmbedRequest):
    """Generate a single 1024-dim dense embedding."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        max_len = req.max_length or MAX_LENGTH
        loop = asyncio.get_event_loop()
        output = await loop.run_in_executor(
            None,
            partial(
                model.encode,
                [req.text],
                batch_size=1,
                max_length=max_len,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            ),
        )
        vector = output["dense_vecs"][0]

        # Normalize to unit length
        norm = float(np.linalg.norm(vector))
        if norm > 0:
            vector = vector / norm

        return EmbedResponse(
            embedding=vector.tolist(),
            dimension=len(vector),
            model=MODEL_NAME,
        )
    except Exception as exc:
        logger.error(f"Embedding failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/embed-batch", response_model=EmbedBatchResponse)
async def embed_batch(req: EmbedBatchRequest):
    """Generate dense embeddings for a batch of texts (max 256)."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        max_len = req.max_length or MAX_LENGTH
        loop = asyncio.get_event_loop()
        output = await loop.run_in_executor(
            None,
            partial(
                model.encode,
                req.texts,
                batch_size=min(BATCH_SIZE, len(req.texts)),
                max_length=max_len,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            ),
        )
        dense_vecs = output["dense_vecs"]

        # Normalize each vector
        embeddings = []
        for vec in dense_vecs:
            norm = float(np.linalg.norm(vec))
            if norm > 0:
                vec = vec / norm
            embeddings.append(vec.tolist())

        return EmbedBatchResponse(
            embeddings=embeddings,
            count=len(embeddings),
            dimension=len(embeddings[0]) if embeddings else 0,
            model=MODEL_NAME,
        )
    except Exception as exc:
        logger.error(f"Batch embedding failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting BGE-M3 Embedding Service on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
