# Deployment Strategy

## Build artifacts

The root Dockerfile produces two production targets:

- `backend-runtime`: Nest API and AI backend.
- `frontend-runtime`: Nginx serving the Vite build and reverse-proxying API traffic.

## Zero-downtime deployment

Run at least two backend replicas behind a load balancer. Use `/health/ready` as the readiness gate and `/health/live` as the liveness gate. During rollout:

1. Pull the new image by immutable commit SHA.
2. Start the new replica with the same secrets and network policy.
3. Wait for `/health/ready` to return ready.
4. Shift traffic to the new replica.
5. Drain old replicas after in-flight requests finish or after 120 seconds.
6. Keep the previous image tag available for rollback.

## Nginx

Nginx enforces static asset serving, SPA fallback, API proxying, body-size limits, CSP, and request throttling. Terminate TLS at the load balancer or add certificates to the Nginx container and redirect HTTP to HTTPS.

## Deployment verification

After deployment, verify:

```bash
curl -fsS https://app.example.com/healthz
curl -fsS https://api.example.com/health/live
curl -fsS https://api.example.com/health/ready
curl -fsS https://api.example.com/metrics | grep legatrixon_http_request_duration_seconds
```

Then run user smoke paths: login, chat stream, draft review, document upload, lesson completion, admin dashboard.