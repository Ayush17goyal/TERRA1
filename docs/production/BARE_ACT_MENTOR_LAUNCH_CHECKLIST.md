# LEGATRIXON Bare Act Drafting Mentor Launch Checklist

## Infrastructure
- [ ] Production Docker images build from a clean git commit.
- [ ] `docker-compose.production.yml` or platform deployment config uses production environment only.
- [ ] Nginx production config is deployed and security headers are active.
- [ ] Health, readiness, and liveness endpoints pass against real dependencies.

## Security
- [ ] Release branch passes secret scan.
- [ ] `.env` files are not committed or exposed in build artifacts.
- [ ] `NODE_ENV=production` startup passes environment validation.
- [ ] `VIRUS_SCAN_MODE=required` and `VIRUS_SCAN_COMMAND` are configured.
- [ ] No admin/session authorization shortcut is accepted in production.
- [ ] Server-side RBAC is verified for admin, instructor, student, and system routes.
- [ ] Prompt-injection and prompt-extraction attempts are blocked or constrained.

## Database
- [ ] Production TypeORM `synchronize` is false.
- [ ] Production migrations run successfully at startup or deployment time.
- [ ] Migration validation script passes.
- [ ] Required indexes exist for interactions, documents, chunks, embeddings, mastery, weaknesses, and prompt logs.
- [ ] Foreign keys and ownership constraints are verified.
- [ ] Backup and restore drill completed.

## Authentication And Authorization
- [ ] Supabase/Clerk auth configuration is valid in production.
- [ ] Student routes require authenticated student context.
- [ ] Instructor routes require instructor/admin role.
- [ ] Admin routes require admin role server-side.
- [ ] Cross-user access attempts are denied.

## Supabase RLS And Storage
- [ ] RLS verifier passes against staging Supabase test users.
- [ ] Student A cannot read Student B rows.
- [ ] Teacher access is limited to permitted instructional records.
- [ ] Admin access is audited.
- [ ] Storage bucket policies prevent cross-user listing/download.

## AI Runtime
- [ ] Runtime path is Authentication -> Student State -> Runtime Decision -> Retrieval -> Prompt Assembly -> LLM -> Validator -> Persistence -> Progress -> Events -> Telemetry.
- [ ] No production API path bypasses the educational validator.
- [ ] High-risk streaming modes buffer until validator approval.
- [ ] Ghostwriting, assessment-answer, legal-advice, and full Bare Act generation requests are blocked or redirected.
- [ ] Retrieved context is treated as untrusted knowledge only.

## Retrieval And Prompt Assembly
- [ ] Retrieval returns minimum required context for each intent.
- [ ] Prompt modules include current curriculum, student state, lesson, safety, and output requirements.
- [ ] Prompt version is recorded for each LLM execution.
- [ ] Token budgets are enforced.

## LLM And Validator
- [ ] OpenAI Responses API key is configured.
- [ ] LLM retries/timeouts/rate limits are active.
- [ ] Structured outputs validate with Zod.
- [ ] Validator blocks unsafe or non-educational output before delivery.
- [ ] Cost and token usage are recorded.

## Upload Pipeline
- [ ] Uploaded files are virus-scanned before storage or indexing.
- [ ] File type and size validation are active.
- [ ] Duplicate detection works.
- [ ] Parsing, chunking, embeddings, indexing, and completion telemetry are recorded.

## Observability
- [ ] Logs include request ID and correlation ID.
- [ ] Logs redact tokens, API keys, passwords, cookies, and auth headers.
- [ ] Metrics cover API, workflow, retrieval, LLM, validation, queues, cache, embeddings, and indexing.
- [ ] Alerts fire for queue failure, LLM failure, validation blocks spike, auth failures, and high latency.

## Testing
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Unit, integration, AI, security, performance, and E2E tests pass.
- [ ] Backend tests pass.
- [ ] Coverage report reviewed.
- [ ] Dependency audit passes for production dependencies.

## Deployment
- [ ] CI production-hardening workflow passes on clean branch.
- [ ] Docker build passes.
- [ ] Staging deployment smoke test passes.
- [ ] Rollback has been tested.
- [ ] Queue workers shut down gracefully.
- [ ] Dead-letter queue recovery tested.

## Release Gate
- [ ] `npm run verify:release` passes on the release commit.
- [ ] No dirty working tree.
- [ ] No missing production dependencies.
- [ ] No failed tests, typecheck, build, Docker build, or migration validation.