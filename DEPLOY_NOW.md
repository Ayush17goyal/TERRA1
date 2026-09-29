# 🚀 LEGATRIXON Backend - Deployment Checklist

## ✅ Pre-Deployment Verification (COMPLETE)

- [x] Build passes: `npm run build` ✓ (0 errors)
- [x] PORT binding fixed: `0.0.0.0:3000` ✓
- [x] CORS production-safe: Uses `CLIENT_ORIGINS` env var ✓
- [x] Supabase credentials removed: No hardcoded secrets ✓
- [x] Dockerfile production-ready: Health checks + non-root user ✓
- [x] fly.toml created: Health checks + auto-restart ✓
- [x] dist/src/main.js exists: Compiled successfully ✓

---

## 📋 BEFORE YOU START

You need these credentials (go get them now):

1. **Supabase** → Settings → API Keys
   - [ ] `NEXT_PUBLIC_SUPABASE_URL` (looks like `https://xxxx.supabase.co`)
   - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (looks like `eyJhbGc...`)
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` (looks like `eyJhbGc...`)

2. **Qdrant Cloud** → https://cloud.qdrant.io
   - [ ] `QDRANT_URL` (looks like `https://cluster.qdrant.io`)
   - [ ] `QDRANT_API_KEY`

3. **OpenRouter** → https://openrouter.ai/
   - [ ] `OPENROUTER_API_KEY` (looks like `sk-or-v1-...`)

4. **Upstash Redis** → https://upstash.com/
   - [ ] `REDIS_URL` (looks like `redis://default:password@...`)

5. **Your Frontend Domain**
   - [ ] `CLIENT_ORIGINS` (your Vercel app URL, e.g., `https://app.vercel.app`)

---

## 🎯 DEPLOYMENT COMMANDS (Copy & Paste)

### Step 1: Install Fly CLI (One time)

```powershell
choco install flyctl
```

### Step 2: Authenticate

```powershell
flyctl auth login
```

_Browser will open - authenticate with GitHub or email_

### Step 3: Create Fly App

```powershell
cd c:\Users\goyal\OneDrive\Desktop\LEGATRIXON-3

flyctl launch --no-deploy
```

**When prompted:**

- **App name**: `legatrixon-backend` (or your choice)
- **Region**: `mia` (Miami) for USA, or `hkg` (Hong Kong) for Asia
- **Create PostgreSQL database**: YES (for production DB)

### Step 4: Set Environment Secrets

Replace the placeholders below with your actual values:

```powershell
# Required secrets
flyctl secrets set NODE_ENV=production
flyctl secrets set NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
flyctl secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..."
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."
flyctl secrets set QDRANT_URL="https://cluster.qdrant.io"
flyctl secrets set QDRANT_API_KEY="xxxxxxx"
flyctl secrets set REDIS_URL="redis://default:password@..."
flyctl secrets set OPENROUTER_API_KEY="sk-or-v1-xxxxx"
flyctl secrets set CLIENT_ORIGINS="https://your-frontend.vercel.app"
```

### Step 5: Deploy

```powershell
flyctl deploy
```

_This builds Docker image and deploys to Fly.io (takes 2-3 minutes)_

### Step 6: Get Your Backend URL

```powershell
flyctl info
```

_Look for "URLS:" - copy that URL (something like `https://legatrixon-backend.fly.dev`)_

### Step 7: Verify It's Working

```powershell
# Replace with your actual URL
curl https://legatrixon-backend.fly.dev/health

# Should return something like:
# {
#   "status": "healthy",
#   "timestamp": "2026-06-24T10:30:00Z",
#   "details": { ... }
# }
```

---

## 🔗 NEXT: Connect Frontend

Once deployed, update your Vercel frontend:

**In Vercel Environment Variables:**

```
VITE_API_URL=https://legatrixon-backend.fly.dev/api/v1
```

Or in your code:

```typescript
const API_BASE =
  process.env.VITE_API_URL || "https://legatrixon-backend.fly.dev/api/v1";
```

---

## 🆘 If Something Goes Wrong

### Check Logs

```powershell
flyctl logs -f
```

### Restart App

```powershell
flyctl restart
```

### See All Secrets

```powershell
flyctl secrets list
```

### Update a Secret

```powershell
flyctl secrets set VARIABLE_NAME="new-value"
flyctl deploy
```

### Rollback to Previous Version

```powershell
flyctl releases
flyctl releases rollback
```

### Scale Up (if getting errors)

```powershell
# Increase memory/CPU
flyctl scale vm shared-cpu --memory=512

# Add more containers
flyctl scale count web=2
```

---

## 📊 After Deployment

**Monitoring:**

```powershell
# Real-time logs
flyctl logs -f

# App status
flyctl status

# Dashboard
flyctl open
```

**Performance:**

- First request takes 2-3 seconds (cold start)
- Subsequent requests: <100ms
- Free tier handles ~100 concurrent users

---

## 💪 You're Ready!

Follow the 7 deployment steps above. You'll have a production backend running in **5 minutes**.

Any issues? Check logs: `flyctl logs -f`

---

**Questions?**

- Fly.io Docs: https://fly.io/docs/
- Backend Docs: See `DEPLOYMENT_FLY_IO.md`
