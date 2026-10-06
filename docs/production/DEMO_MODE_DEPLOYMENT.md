# LEGATRIXON demo-mode production runbook

## Actual application architecture

- Frontend: React 19 + TypeScript + Vite 8, deployed by the current `vercel.json` as a static SPA with `/api/v1/*` rewrites.
- Backend: NestJS 10 + TypeORM, built from `server/` and currently described by `render.yaml`.
- Production database: PostgreSQL is mandatory. The intended deployment can use the Supabase Postgres connection string through `DATABASE_URL`/`POSTGRES_URL`. SQLite remains development-only.
- Authentication: Clerk protects NestJS user routes. Admin API operations require Clerk plus `AdminRoleGuard` (`ADMIN_EMAILS` or an admin-class Clerk role). The legacy founder portal uses a scrypt password hash followed by email approval; it no longer contains source-code passwords or security answers.
- Data/services: Supabase REST/Storage, Qdrant, Redis, SMTP/FCM, Google Calendar OAuth, Razorpay, and optional Sentry/OpenTelemetry.

## Paid/external API inventory

The protected route inventory is `server/src/modules/settings/api-usage-protection.interceptor.ts`. It covers user-triggered calls to:

- OpenRouter/OpenAI-compatible chat used by LexMentor, legal intelligence, notebook, research, judgments, drafting review, academic/model-answer generation, and memorial workflows.
- Direct OpenAI chat, embeddings, and audio transcription in exam, retrieval, and GuideBot flows.
- Gemini/DeepSeek/OpenRouter fallbacks used by learning-workspace and Vercel compatibility handlers.
- Qdrant vector search/upsert and BGE-M3/embedding processing reached by uploads, reprocessing, notebook, research, and learning workspace routes.
- OCR/document extraction and analysis routes (Tesseract/PDF/Office processing).
- Google Calendar API calls. OAuth/token-management endpoints are not counted as AI demo use.
- Razorpay order/payment verification is intentionally not subject to demo feature credits; payment security remains signature/amount/order based.

Admin provider-health tests and offline ingestion scripts are administrator/operations tasks rather than end-user demo features. Protect them with admin RBAC and provider-side quotas.

## Demo-mode behavior

- `demo_mode_settings.id = 'global'` is the database source of truth. The migration seeds it ON with 4 uses per feature per India calendar day.
- Counters are keyed by user, feature, and period. Period keys use the `Asia/Kolkata` date.
- The atomic PostgreSQL/SQLite upsert increments only when the existing value is below the limit, so concurrent tabs cannot exceed the allowance.
- A reservation happens before a protected operation. Any validation, cancellation propagated as an error, provider 429, provider 5xx, timeout, or invalid provider response refunds the reservation.
- Demo Mode OFF immediately uses the existing Free/Starter/Pro/Pro Max entitlement matrix. It never changes `user_subscriptions`.
- User status is available at `GET /api/v1/settings/demo-usage?feature=<feature>`; the admin overview/toggle is under Admin Portal → API Safety.
- Browser code cannot mutate settings or counters. Admin writes require a valid Clerk admin token and every change is recorded in `demo_mode_audit_logs`.

## Database deployment

Apply `supabase/migrations/202610060001_subscription_feature_entitlements.sql` to the same PostgreSQL database used by NestJS. It creates:

- `feature_usage_counters`
- `demo_mode_settings`
- `demo_mode_audit_logs`
- `api_usage_errors`
- supporting indexes and RLS policies

Verify before backend deployment:

```sql
select id, enabled, limit_per_feature_per_day, timezone
from public.demo_mode_settings where id = 'global';
```

Expected: `global | true | 4 | Asia/Kolkata`.

## Production environment

Backend-required/core values:

- `NODE_ENV=production`, `PORT`, `PUBLIC_BACKEND_URL`
- `DATABASE_URL` (or `POSTGRES_URL`), `POSTGRES_SSL=true`
- `CLIENT_ORIGINS` and `CLIENT_ORIGIN` with exact HTTPS frontend origins, no wildcards
- `CLERK_SECRET_KEY`, `ADMIN_EMAILS`, `ADMIN_PORTAL_ID`, `ADMIN_PORTAL_PASSWORD_HASH`
- at least one of `OPENAI_API_KEY` or `OPENROUTER_API_KEY`; configure production `GEMINI_API_KEY`/`DEEPSEEK_API_KEY` where those fallbacks are enabled
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `QDRANT_URL`, `QDRANT_API_KEY`, `REDIS_URL`
- `BYOK_ENCRYPTION_KEY` and/or `PROVIDER_KEY_ENCRYPTION_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SECURITY_EMAIL_FROM`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`; set `RAZORPAY_WEBHOOK_SECRET` in Supabase Edge Function secrets
- `VIRUS_SCAN_MODE=required`, `VIRUS_SCAN_COMMAND`
- optional: `SENTRY_DSN`, OTEL variables, FCM/ElevenLabs/Groq/xAI/AI-ML keys used by enabled features
- bootstrap fallback: `DEMO_LIMIT_PER_FEATURE_PER_DAY=4` (the database setting becomes authoritative)

Frontend/Vercel values:

- `VITE_API_URL=https://<backend-domain>/api/v1`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY` when Turnstile is enabled

Never put service-role, provider-secret, Clerk-secret, SMTP, database, encryption, or Razorpay-secret values in `VITE_*` variables.

## Admin account and secure recovery

There are two relevant mechanisms:

1. Server admin authorization uses Clerk identity plus `ADMIN_EMAILS` or a Clerk metadata role such as `admin`, `super_admin`, or `founder`. Reset that user's password through Clerk's normal password-reset/account-recovery flow, then ensure its email/role is authorized.
2. The founder portal ID is `ADMIN_PORTAL_ID`; its password is stored only as `ADMIN_PORTAL_PASSWORD_HASH` in the deployment secret store. Passwords are one-way and cannot be recovered.

To reset the founder portal password safely:

1. Run `cd server` and `npm run admin:hash-secret` in an interactive terminal.
2. Enter a new password-manager-generated secret twice. The command hides input and prints only a scrypt hash.
3. Replace `ADMIN_PORTAL_PASSWORD_HASH` in Render's secret environment settings.
4. Redeploy/restart the backend and complete the email approval step.
5. Do not paste the plaintext password into source, chat, logs, `render.yaml`, or the browser bundle.

There are no seeded/default production credentials. Any earlier development defaults and hard-coded challenge answers were removed.

## Exact deployment sequence

1. Rotate every credential previously committed in `render.yaml`: Supabase service-role, Clerk secret, OpenAI, OpenRouter, Gemini, DeepSeek, Qdrant, Google OAuth secret, SMTP app password, BYOK encryption key, and any Razorpay credential found in Git history. Re-encrypt or invalidate stored BYOK material if its encryption key changes.
2. Remove the exposed values from Git history with an approved history-rewrite procedure before making the repository public. The current file is clean, but Git history still contains old values.
3. Create production Clerk, Supabase, AI-provider, Qdrant, Redis, SMTP, Google OAuth, Turnstile, and Razorpay credentials. Do not reuse test keys.
4. Configure Supabase Auth allowed site URL and redirect URLs for the final frontend domain. Configure Clerk production allowed origins/redirects for that same domain.
5. Apply the SQL migration above to the production PostgreSQL/Supabase project and verify the global row is ON/4.
6. Configure Render secrets from `render.yaml`. Use the same Supabase project for `DATABASE_URL`, `SUPABASE_URL`, and service-role key. Do not deploy with SQLite or `SUPABASE_DISABLED=true`.
7. Build/test backend: `cd server && npm ci && npm run build && npm test -- --runInBand --cacheDirectory ../tmp/jest-demo src/modules/settings/feature-entitlement.service.spec.ts`.
8. Deploy backend using `npm run start:prod`. Verify `/health/live` and `/health/ready` over HTTPS.
9. Configure Vercel production variables, then run `npm ci && npm run build`; deploy `dist/` through the existing Vercel configuration.
10. Point the frontend domain to Vercel and the API subdomain to Render. Set `VITE_API_URL`, `CLIENT_ORIGINS`, `CLIENT_ORIGIN`, and `PUBLIC_BACKEND_URL` to the final HTTPS origins; redeploy after any build-time `VITE_*` change.
11. Set Google OAuth's authorized redirect URI to the exact `GOOGLE_REDIRECT_URI` used by the deployed flow. The current code exchanges tokens at `/api/v1/exam/oauth/callback`; confirm the Google Console redirect matches the frontend/backend handoff used in production.
12. Deploy Supabase Edge Functions `create-order`, `verify-payment`, `razorpay-webhook`, and `payment-history`. Set their Razorpay/Supabase secrets in Supabase, not in Git.
13. Configure Razorpay webhook URL to the deployed `razorpay-webhook` Edge Function, select the payment/order events used by the function, and set the matching webhook secret. Switch from test to live key ID/secret only after test-mode verification.
14. Sign in through Clerk with an authorized admin, open Admin Portal → API Safety, confirm ACTIVE and limit 4. Toggle OFF, refresh overview, toggle ON, and confirm two corresponding audit rows.
15. Execute the production acceptance matrix below with provider dashboards open; verify the fifth call creates no provider request.
16. Monitor `feature_usage_counters`, `api_usage_errors`, provider dashboards, Render logs, Sentry, database connections, Redis/Qdrant health, and Razorpay webhook failures during launch.

## Production acceptance matrix

- New Clerk user has no paid subscription and resolves to Free when Demo Mode is OFF.
- Demo ON: four successful calls per feature are allowed; call five returns HTTP 429 with `DEMO_LIMIT_REACHED` before provider execution.
- Two users have independent counters; two features for one user have independent counters.
- Refresh, incognito, localStorage clearing, multiple tabs, and direct authenticated API calls cannot bypass the database counter.
- Concurrent fifth calls cannot both pass the conditional upsert.
- At 00:00 Asia/Kolkata a new period key supplies a fresh allowance.
- Demo OFF immediately invokes the preserved plan matrix; paid plan data remains unchanged. Demo ON restores demo limits.
- Validation errors and simulated provider 429/500/timeout refund the reservation; UI receives the safe temporary-unavailability message and no stack/key/database detail.
- Existing authentication, subscription activation, Razorpay signature/amount validation, and webhook flows pass in test mode and then live mode.
- Admin endpoints reject non-admin Clerk users. No admin secret is present in JS bundles, API responses, or logs.
- Light/dark themes, mobile viewport, keyboard flow, and “View Plans” error handling are manually verified on the main protected modules.

## Launch risks to monitor

- The repository had real-looking secrets committed. Rotation and history cleanup are mandatory before public launch.
- The Vercel compatibility handler under `api/v1/[...path].ts` contains direct Gemini calls but now refuses paid/AI routes in production. Production must point `VITE_API_URL` to NestJS; otherwise those features return `PROTECTED_API_REQUIRES_BACKEND` instead of bypassing limits.
- Demo counters protect authenticated users, not coordinated abuse across many newly created accounts. Add Clerk bot/abuse controls, Turnstile, IP/device anomaly alerts, and hard provider billing caps.
- Static route inventory must be updated whenever a new paid/external endpoint is added. Treat a matching entry plus tests as part of the definition of done for new API features.
