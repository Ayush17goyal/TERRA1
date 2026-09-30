# TERRA1 FINAL MEMORIAL DROP-IN

Copy the contents of this folder into the ROOT of your current TERRA1 / LEGATRIXON project.

Example project root:
C:\Users\goyal\OneDrive\Documents\LEGATRIXON-3\

After copying, the paths must be:

src/modules/moot-court/MemorialArchitect.tsx
src/modules/moot-court/memorialWorkflow.ts

server/src/app.module.ts
server/src/modules/research/research.controller.ts

server/src/modules/memorial/
  argument-engine.service.ts
  authority-engine.service.ts
  case-graph.service.ts
  issue-engine.service.ts
  memorial-ai.service.ts
  memorial-authority-catalog.ts
  memorial-compiler.service.ts
  memorial-judge.service.ts
  memorial-prompts.ts
  memorial-workflow.controller.ts
  memorial-workflow.module.ts
  memorial-workflow.service.ts
  memorial.types.ts
  proposition-intelligence.service.ts
  proposition-preservation.service.ts

WHAT THIS DOES
--------------
1. Replaces the mock Memorial Architect frontend with the functional upload/API version.
2. Adds the full memorial generation backend module.
3. Registers MemorialWorkflowModule in the current AppModule.
4. Fixes /api/v1/research/upload so stale query IDs do not crash SQLite with a foreign-key error.

DO NOT COPY ANY OLD .env FILE.
Keep your current environment configuration.

Frontend:
VITE_API_BASE_URL=http://localhost:4000/api/v1
(or use the actual port printed by your backend if it is 4001)

Backend AI:
OPENROUTER_API_KEY=your_current_key

Optional but important for vector research:
QDRANT_URL=...
QDRANT_API_KEY=...

AFTER COPYING
-------------
1. Stop frontend/backend.
2. Start backend again from server:
   npm run start:dev
3. Confirm the startup log contains:
   MemorialWorkflowController {/api/v1/memorial-workflow}
   Mapped {/api/v1/memorial-workflow/run, POST}
4. Start frontend.
5. Go to Legal Research -> Command Center -> Moot Memorial / Memorial Architect.
6. Upload a PDF/DOCX/TXT moot proposition.

IMPORTANT
---------
The frontend has a local fallback. A memorial appearing on screen does not by itself prove the backend worked.
For a real backend generation, there should be no backend-fallback error message and the server should receive:
POST /api/v1/memorial-workflow/run
