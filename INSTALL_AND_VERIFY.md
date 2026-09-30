# TERRA1 Moot Memorial Functionality Overlay

This overlay was extracted from the uploaded older LEGATRIXON project after comparing it with the current TERRA1 repository.

## What is missing in current TERRA1

The current `src/modules/moot-court/MemorialArchitect.tsx` contains the UI, but its upload handler only starts a timed simulation and its outputs are hard-coded sample memorials.

The old implementation contains the real workflow:
1. Upload PDF/DOCX/TXT proposition.
2. POST multipart form data to `/api/v1/memorial-workflow/run`.
3. Preserve and classify the proposition.
4. Build a proposition blueprint/case graph.
5. Generate issues.
6. Retrieve/verify authorities.
7. Generate arguments for both sides.
8. Compile petitioner/respondent memorials.
9. Score/validate the memorial.
10. Return generated memorial text and structured output to the existing UI.

## Files in this overlay

Frontend:
- `src/modules/moot-court/MemorialArchitect.tsx` — functional version of the existing UI.
- `src/modules/moot-court/memorialWorkflow.ts` — frontend workflow/result adapter and local fallback.

Backend:
- all 15 files under `server/src/modules/memorial/`.

## ONE manual edit required in current TERRA1

Open `server/src/app.module.ts`.

Add this import with the other module imports:

```ts
import { MemorialWorkflowModule } from './modules/memorial/memorial-workflow.module';
```

Then add this inside the `imports: []` array:

```ts
MemorialWorkflowModule,
```

Do NOT replace the whole current `app.module.ts` with the old one. The current project has newer modules that must remain.

## Environment

Frontend must point at the NestJS backend:

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

For production, use the deployed NestJS URL ending in `/api/v1`.

Backend memorial AI uses the existing OpenRouter provider. Configure at least the AI provider expected by the current server, normally:

```env
OPENROUTER_API_KEY=...
```

Qdrant is used by the authority retrieval path when configured:

```env
QDRANT_URL=...
QDRANT_API_KEY=...
```

The workflow has curated/fallback authority logic, but production-quality retrieval should have the legal corpus/vector database available.

## Existing dependencies

The current TERRA1 server already contains the dependencies used by this subsystem, including NestJS platform-express, `pdf-parse`, `adm-zip`, OpenRouter/OpenAI plumbing, and Qdrant support. The frontend already has Clerk and export libraries.

## Install

From the TERRA1 project root, copy the `src/` and `server/` directories from this overlay over the matching directories.

Then make the `server/src/app.module.ts` edit described above.

Do not copy `.env.local` from the old ZIP. It may contain old/private credentials.

## Run locally

Backend:

```bash
cd server
npm install
npm run start:dev
```

Frontend in another terminal:

```bash
npm install
npm run dev
```

## Endpoint smoke test

Once the backend starts, the memorial endpoint should exist at:

`POST /api/v1/memorial-workflow/run`

It expects multipart form-data:
- `file`: proposition PDF/DOCX/TXT
- `sourceName`: filename
- `side`: `both`

The frontend functional `MemorialArchitect.tsx` already performs this request and includes the Clerk bearer token when signed in.

## Important behavior

If the backend call fails, the migrated frontend deliberately falls back to a local template/workspace and displays an error explaining that backend generation failed. Therefore, seeing a memorial on screen is not by itself proof that the backend worked. Verify that there is no fallback/error banner and inspect backend logs.

## Recommended first verification

Use a clean moot proposition PDF containing:
- meaningful case facts,
- parties,
- at least two legal issues or enough facts to infer them,
- competition rules/clarifications if available.

The backend intentionally rejects very short/partial propositions and low-quality extracted blueprints rather than generating a misleading memorial.
