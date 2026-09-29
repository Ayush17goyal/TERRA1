# LEGATRIXON Production Hardening

## Startup controls

The backend validates runtime configuration before binding a port. Production mode refuses to start unless it has client origins, PostgreSQL, Clerk authentication, and an LLM provider key. Development-only auth bypass is blocked in production.

## Security controls

- Helmet secure headers and CSP are applied at the Nest layer and repeated at Nginx.
- CORS is explicit in staging and production.
- Correlation IDs are accepted only in a safe character set or regenerated.
- Rate limits are applied per caller and route group: general API, auth/session paths, and LLM-heavy mentor paths.
- Upload requests are rejected on dangerous filenames, unsupported MIME types, and configured size limits.
- Prompt injection signals are detected and logged as security events before request processing.
- Virus scanning is configurable through `VIRUS_SCAN_MODE` and `VIRUS_SCAN_COMMAND`. Use `clamscan --no-summary` for ClamAV-compatible deployments.
- Audit events are persisted to the Supabase `audit_logs` table when Supabase is configured; failures remain visible in structured logs.

## Secrets management

Store production secrets only in the deployment secret store or encrypted CI variables. Do not commit `.env.production`. Rotate these secrets at minimum every 90 days or immediately after staff access changes:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `GRAFANA_ADMIN_PASSWORD`
- database credentials

## Logging

Pino emits structured JSON with redaction for authorization headers, cookies, API keys, tokens, passwords, and service-role credentials. The auth guard no longer writes local debug files or serializes full user objects.

## Monitoring

The backend exposes:

- `/health/live` for process liveness
- `/health/ready` for dependency readiness
- `/metrics` for Prometheus

Metrics cover API, workflow, retrieval, LLM, validation, queue, embedding, indexing, cache, security, interaction, and mastery signals.

## Reliability

The application has request timeouts, graceful shutdown, reusable retry/backoff helpers, and a reusable circuit breaker. Long-running workers should call the same shutdown hooks and stop accepting new work before closing active jobs.