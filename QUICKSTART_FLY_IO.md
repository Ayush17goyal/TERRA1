# LEGATRIXON Backend - Quick Start (Fly.io Deployment)

## ⚡ 5-MINUTE QUICKSTART

### Prerequisites

- Fly.io account (free at https://fly.io)
- `flyctl` CLI installed
- Git

### Deploy in 5 Steps

```powershell
# 1. Authenticate
flyctl auth login

# 2. Navigate to project
cd c:\Users\goyal\OneDrive\Desktop\LEGATRIXON-3

# 3. Create Fly app (first time only)
flyctl launch --no-deploy
# When asked:
# - App name: legatrixon-backend (or similar)
# - Region: mia (Miami) for USA, or hkg (Hong Kong) for Asia
# - Database: Select "Create a PostgreSQL database"

# 4. Set secrets
flyctl secrets set NODE_ENV=production
flyctl secrets set NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
flyctl secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-key"
flyctl secrets set QDRANT_URL="your-qdrant-url"
flyctl secrets set QDRANT_API_KEY="your-qdrant-key"
flyctl secrets set REDIS_URL="redis://localhost:6379"  # or Upstash URL
flyctl secrets set OPENROUTER_API_KEY="your-openrouter-key"
flyctl secrets set CLIENT_ORIGINS="https://your-frontend.com"

# 5. Deploy!
flyctl deploy
```

### Verify Deployment

```powershell
# Get your app URL
flyctl info

# Test it works
curl https://legatrixon-backend.fly.dev/health
```

---

## 📋 What Was Changed (Already Done)

✅ **main.ts**: Fixed PORT binding to `0.0.0.0:3000` for containers  
✅ **CORS**: Updated for production (`CLIENT_ORIGINS` env var)  
✅ **Dockerfile**: Added dumb-init, health checks, non-root user  
✅ **Supabase Service**: Removed hardcoded credentials  
✅ **fly.toml**: Created production config  
✅ **Build**: Tested ✓ No errors

---

## 🔗 Environment Variables You Need

From **`.env.production.template`** (already created):

| Variable                        | Example                     | Where to get               |
| ------------------------------- | --------------------------- | -------------------------- |
| `POSTGRES_URL`                  | `postgresql://...`          | Fly.io creates this        |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxxx.supabase.co`  | Supabase Settings          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...`                | Supabase API Keys          |
| `SUPABASE_SERVICE_ROLE_KEY`     | `eyJhbGc...`                | Supabase API Keys (secret) |
| `QDRANT_URL`                    | `https://cluster.qdrant.io` | Qdrant Cloud               |
| `QDRANT_API_KEY`                | `xxxxxxx`                   | Qdrant Cloud               |
| `REDIS_URL`                     | `redis://...`               | Upstash Redis              |
| `OPENROUTER_API_KEY`            | `sk-or-v1-...`              | OpenRouter                 |
| `CLIENT_ORIGINS`                | `https://app.example.com`   | Your frontend domain       |

---

## 🚀 After Deployment

### Connect Frontend

In your Vercel frontend, update API base URL:

```typescript
// .env.production
VITE_API_URL=https://legatrixon-backend.fly.dev/api/v1
```

### Monitor Logs

```powershell
flyctl logs -f  # Real-time logs
```

### Update & Redeploy

```powershell
git push origin main
flyctl deploy
```

---

## ❓ Common Questions

**Q: Is it really free?**  
A: Yes! Fly.io free tier includes 3 shared CPU containers, 3GB persistent storage. Perfect for MVP.

**Q: Can I scale later?**  
A: Yes, just run `flyctl scale count web=2` and pay-as-you-go.

**Q: What if my app crashes?**  
A: Fly.io auto-restarts. Check logs: `flyctl logs`

**Q: How do I update code?**  
A: Push to GitHub, then `flyctl deploy` (redeploys from latest code)

---

## 📞 Support

- **Fly.io Docs**: https://fly.io/docs/
- **NestJS Docs**: https://docs.nestjs.com/
- **Troubleshooting**: See `DEPLOYMENT_FLY_IO.md`
