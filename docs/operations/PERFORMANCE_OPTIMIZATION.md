# LEGATRIXON Bare Act Mentor Performance Optimization Notes

## Frontend

- The Vite build now uses route-level lazy loading for the heavy LEGATRIXON modules and Bare Act Mentor feature surfaces.
- Vendor code is split into stable chunks for React, icons, TanStack Query, auth, Supabase, charts, PDF tooling, export tooling, and feature-specific code.
- Chat streaming text updates are batched with `requestAnimationFrame` to avoid rendering on every SSE text delta.
- The production build reduced the root JavaScript chunk from the previous multi-megabyte bundle to roughly 624 KB minified, with Bare Act chat/drafting/learning/document/admin surfaces loaded on demand.

## Backend/API

- API responses now use compression for responses larger than 1 KB.
- Express strong ETags are enabled for cacheable responses.
- Existing request timeout, graceful shutdown, security, logging, and metrics middleware remain in front of the application pipeline.

## AI and Retrieval

- Knowledge retrieval executes retriever plans in bounded parallel batches.
- Identical vector-query text within a retrieval pass reuses the same embedding promise.
- Retrieval cache now records hit/miss/set/eviction statistics for operational tuning.
- Prompt assembly has a bounded LRU cache keyed on prompt-shaping inputs to avoid rebuilding identical prompt fragments.

## Jobs

- Background workers now support configurable concurrency with conservative defaults:
  - Embedding queue: 4
  - Document index queue: 3 per indexing worker
  - Analytics queue: 2
  - Telemetry queue: 2
- Queue semantics remain unchanged; only local worker throughput changes.

## Database and pgvector

- A defensive Supabase migration adds composite indexes for student history, mastery, weaknesses, drafts, prompt logs, audit logs, document metadata, and knowledge/document chunks.
- Trigram indexes improve text search where title/content columns exist.
- HNSW cosine indexes are added for pgvector embedding columns when present.

## Monitoring

Grafana now includes p95/p99 API latency, workflow latency, retrieval latency, prompt assembly latency, validation latency, LLM latency, token usage, estimated cost, cache events, queue depth/failures, embedding latency, indexing events, security events, and slow operation counters.

## Load testing

Use the Node load harness:

```bash
LOAD_TEST_BASE_URL=https://api.example.com LOAD_TEST_AUTH_TOKEN=... npm run perf:load -- students100
LOAD_TEST_BASE_URL=https://api.example.com LOAD_TEST_AUTH_TOKEN=... npm run perf:load -- students500
LOAD_TEST_BASE_URL=https://api.example.com LOAD_TEST_AUTH_TOKEN=... npm run perf:load -- students1000
LOAD_TEST_BASE_URL=https://api.example.com LOAD_TEST_AUTH_TOKEN=... npm run perf:load -- streaming
LOAD_TEST_BASE_URL=https://api.example.com LOAD_TEST_AUTH_TOKEN=... npm run perf:load -- uploads
```

The harness reports throughput, p50/p95/p99/max latency, failure rate, and status distribution.

## Trade-offs preserved

- The legacy moot-court feature remains a large lazy-loaded chunk because its root module statically imports many heavy submodules. It is no longer part of the initial root payload, but deeper per-tab lazy loading inside that legacy feature is a separate refactor.
- The `pdfjs-dist` eval warning remains from upstream PDF.js packaging. The PDF code is isolated into a vendor PDF chunk, but the dependency still emits the warning.
- Vite still warns that `.env` contains `NODE_ENV=production`; that is an environment hygiene issue outside bundling logic.