"""
Direct Python seeder — no HTTP, no NestJS, no timeouts.
Loads BGE-M3 in-process, chunks PDFs, uploads to Qdrant.

Run from server/:
    python seed_direct.py

Requirements:
    pip install qdrant-client FlagEmbedding pdfminer.six numpy python-dotenv
"""

import os, re, uuid, hashlib, time, sys
from pathlib import Path
from dotenv import load_dotenv

# Force UTF-8 on Windows terminals
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

load_dotenv(Path(__file__).parent / ".env")

QDRANT_URL     = os.environ["QDRANT_URL"]
QDRANT_API_KEY = os.environ["QDRANT_API_KEY"]

CORPUS = Path(__file__).parent / "corpus-data"

ACTS = [
    {
        "pdf":        CORPUS / "bns"  / "BNS2023.pdf",
        "collection": "bns_bge",
        "act":        "BNS",
        "title":      "Bharatiya Nyaya Sanhita, 2023",
    },
    {
        "pdf":        CORPUS / "bnss" / "250884_2_english_01042024.pdf",
        "collection": "bnss_bge",
        "act":        "BNSS",
        "title":      "Bharatiya Nagarik Suraksha Sanhita, 2023",
    },
]

CHUNK_SIZE    = 800   # characters
CHUNK_OVERLAP = 150
BATCH_SIZE    = 16    # vectors per Qdrant upsert call
EMBED_BATCH   = 8     # chunks per BGE-M3 encode call

# ── helpers ──────────────────────────────────────────────────────────────────

def extract_text(pdf_path: Path) -> str:
    from pdfminer.high_level import extract_text as pm_extract
    print(f"  📄 Extracting text from {pdf_path.name} …")
    text = pm_extract(str(pdf_path))
    print(f"     {len(text):,} characters extracted")
    return text


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += size - overlap
    return chunks


def extract_section_id(text: str) -> str | None:
    m = re.search(r'\bSection\s+(\d+[A-Za-z]?)\b', text)
    return m.group(1) if m else None


def stable_id(act: str, chunk_idx: int) -> str:
    raw = f"{act}-chunk-{chunk_idx}"
    return str(uuid.UUID(hashlib.md5(raw.encode()).hexdigest()))


def normalize(vec):
    import numpy as np
    v = np.array(vec, dtype=float)
    n = float(np.linalg.norm(v))
    return (v / n).tolist() if n > 0 else v.tolist()


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n╔══════════════════════════════════════════════╗")
    print("║  LEGATRIXON — Direct Python Seeder          ║")
    print("╚══════════════════════════════════════════════╝\n")

    # Load model once
    print("🔧 Loading BGE-M3 model (may take 1-3 min on first run) …")
    t0 = time.time()
    from FlagEmbedding import BGEM3FlagModel
    model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
    print(f"   ✅ Model loaded in {time.time()-t0:.1f}s\n")

    # Connect to Qdrant
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct, PayloadSchemaType
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60)
    print("✅ Connected to Qdrant\n")

    total_chunks = 0
    total_vectors = 0

    for act_cfg in ACTS:
        pdf  = act_cfg["pdf"]
        coll = act_cfg["collection"]
        act  = act_cfg["act"]
        title = act_cfg["title"]

        print(f"📚 Ingesting {act}  →  collection: {coll}")
        print("─" * 55)

        if not pdf.exists():
            print(f"   ❌ PDF not found: {pdf}\n")
            continue

        # Ensure collection exists (1024-dim Cosine)
        existing = [c.name for c in client.get_collections().collections]
        if coll not in existing:
            client.create_collection(
                collection_name=coll,
                vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
            )
            print(f"   🆕 Created collection {coll}")
        else:
            print(f"   ✔  Collection {coll} already exists")

        # Extract + chunk
        text   = extract_text(pdf)
        chunks = chunk_text(text)
        print(f"   📝 {len(chunks)} chunks generated\n")
        total_chunks += len(chunks)

        # Embed + upsert in batches
        points_buf = []
        upserted   = 0

        for i in range(0, len(chunks), EMBED_BATCH):
            batch_texts = chunks[i : i + EMBED_BATCH]
            out = model.encode(
                batch_texts,
                batch_size=EMBED_BATCH,
                max_length=512,
                return_dense=True,
                return_sparse=False,
                return_colbert_vecs=False,
            )
            vecs = out["dense_vecs"]

            for j, (chunk_text_val, vec) in enumerate(zip(batch_texts, vecs)):
                idx = i + j
                points_buf.append(PointStruct(
                    id=stable_id(act, idx),
                    vector=normalize(vec),
                    payload={
                        "text":        chunk_text_val,
                        "act":         act,
                        "title":       title,
                        "chunk_index": idx,
                        "section_id":  extract_section_id(chunk_text_val),
                        "documentType": act.lower(),
                    },
                ))

            # Upsert when buffer is full
            if len(points_buf) >= BATCH_SIZE:
                client.upsert(collection_name=coll, points=points_buf)
                upserted += len(points_buf)
                print(f"   ⬆  Upserted {upserted}/{len(chunks)} vectors …", end="\r")
                points_buf = []

        # Flush remaining
        if points_buf:
            client.upsert(collection_name=coll, points=points_buf)
            upserted += len(points_buf)
            points_buf = []

        total_vectors += upserted
        print(f"\n   ✅ {act} done — {upserted} vectors stored in {coll}\n")

    print("╔══════════════════════════════════════════════╗")
    print(f"║  DONE — {total_chunks} chunks, {total_vectors} vectors stored")
    print("╚══════════════════════════════════════════════╝\n")


if __name__ == "__main__":
    main()
