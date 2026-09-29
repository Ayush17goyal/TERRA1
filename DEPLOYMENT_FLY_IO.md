# LEGATRIXON Backend - Fly.io Deployment Guide

## ✅ Why Fly.io (FREE & BEST for your stack)

| Feature             | Fly.io Free  | Vercel               | Railway        | Render           |
| ------------------- | ------------ | -------------------- | -------------- | ---------------- |
| **Cost**            | ✅ Free      | ❌ Paid              | ❌ $5+/mo      | ❌ $7+/mo        |
| **NestJS**          | ✅ Yes       | ⚠️ Serverless only   | ✅ Yes         | ✅ Yes           |
| **BGE-M3 Sidecar**  | ✅ Yes       | ❌ No Python         | ✅ Yes         | ✅ Yes           |
| **Background Jobs** | ✅ Yes       | ❌ 10s timeout       | ✅ Yes         | ✅ Yes           |
| **PostgreSQL**      | ✅ Yes       | ❌ External only     | ✅ Built-in    | ✅ Limited       |
| **Redis**           | ✅ Yes       | ✅ Upstash (paid)    | ✅ Built-in    | ⚠️ Limited       |
| **Qdrant**          | ✅ Yes       | ✅ Cloud only (paid) | ✅ Yes         | ✅ Yes           |
| **File Uploads**    | ✅ Unlimited | ❌ 4.5MB limit       | ✅ Unlimited   | ✅ Unlimited     |
| **Setup Time**      | ⭐ 10 mins   | ⭐⭐ 15 mins         | ⭐⭐⭐ 20 mins | ⭐⭐⭐⭐ 25 mins |

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Install Fly CLI

```powershell
# Windows
choco install flyctl
# OR download from https://fly.io/docs/getting-started/installing-flyctl/

# Verify installation
flyctl version
```

### Step 2: Authenticate with Fly.io

```powershell
flyctl auth login
# Opens browser for GitHub/email authentication
```

### Step 3: Create Fly.io App (ONE TIME)

```powershell
cd c:\Users\goyal\OneDrive\Desktop\LEGATRIXON-3

# Create the app (uses app name from fly.toml)
flyctl launch --no-deploy

# When prompted:
# - Choose region: mia (Miami) or hkg (Hong Kong)
# - Copy database URL: flyctl postgres attach --postgres-app legatrixon-postgres
```

### Step 4: Set Production Environment Variables

```powershell
# Set each secret (DO NOT commit to git)
flyctl secrets set POSTGRES_URL="postgresql://postgres:password@legatrixon-postgres.internal/legatrixon"
flyctl secrets set NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
flyctl secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIs..."
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."
flyctl secrets set QDRANT_URL="https://cluster.qdrant.io"
flyctl secrets set QDRANT_API_KEY="xxxxxxx"
flyctl secrets set REDIS_URL="redis://default:password@redis.internal:6379"
flyctl secrets set OPENROUTER_API_KEY="sk-or-v1-xxxxx"
flyctl secrets set CLIENT_ORIGINS="https://app.legatrixon.com"

# View all secrets (values hidden)
flyctl secrets list
```

### Step 5: Deploy

```powershell
# First deployment
flyctl deploy

# Monitor logs
flyctl logs

# Check app status
flyctl status
```

### Step 6: Verify Health

```powershell
# Get app URL
flyctl apps list

# Test health endpoint
$appUrl = "https://legatrixon-backend.fly.dev"
curl "$appUrl/health"

# Should return:
# {
#   "status": "healthy",
#   "timestamp": "2026-06-24T10:30:00Z",
#   "details": { ... }
# }
```

---

## 📊 DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────┐
│         Fly.io Edge (DDoS Protected)        │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
        ┌──────────▼──────────┐
        │ NestJS Backend      │
        │ (1 shared CPU)      │
        │ Node.js 20-alpine   │
        └──────────┬──────────┘
                   │
        ┌──────────┼────────────┬─────────────┐
        │          │            │             │
    ┌───▼──┐  ┌───▼────┐  ┌───▼────┐  ┌────▼────┐
    │Postgres│  │Redis  │  │Qdrant  │  │Supabase │
    │(Local) │  │(Local)│  │(Cloud) │  │(Cloud)  │
    │Fly.io  │  │Fly.io │  │Managed │  │Managed  │
    └────────┘  └───────┘  └────────┘  └─────────┘
```

---

## 🔧 CONFIGURATION DETAILS

### Port Configuration

- **Internal**: Port 3000 (from `fly.toml`)
- **External**: 80/443 (auto-redirect HTTP → HTTPS)
- **Auto-managed by Fly.io**

### Database Strategy

#### Option A: Fly.io PostgreSQL (Recommended for MVP)

```powershell
# Create Postgres on Fly.io
flyctl postgres create --name legatrixon-postgres

# Get connection string
flyctl postgres connect legatrixon-postgres
```

#### Option B: Supabase PostgreSQL (for scaling)

```powershell
# Use your Supabase connection string
flyctl secrets set POSTGRES_URL="postgresql://postgres:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

### Redis Strategy

```powershell
# Upstash Redis (managed, free tier available)
# - Sign up: https://upstash.com
# - Create Redis DB
# - Copy connection string to REDIS_URL secret

flyctl secrets set REDIS_URL="redis://default:password@your-upstash.upstash.io:6379"
```

### Vector DB Strategy

```powershell
# Qdrant Cloud (managed, free tier)
# - Sign up: https://cloud.qdrant.io
# - Create cluster
# - Copy URL and API key

flyctl secrets set QDRANT_URL="https://cluster-xxxx.qdrant.io"
flyctl secrets set QDRANT_API_KEY="xxxxxxx"
```

---

## 📈 SCALING (After Users Grow)

### Free Tier → Paid Tier

```powershell
# Free: 1 shared-cpu container, 256MB RAM
# Cost at $5/gb/month:

# Small (1 user - 10 users): $5-10/month
flyctl scale count web=1
flyctl scale vm shared-cpu --cpus=1 --memory=256

# Medium (10-100 users): $20-30/month
flyctl scale count web=2
flyctl scale vm shared-cpu --cpus=2 --memory=512

# Large (100+ users): $50+/month
flyctl scale count web=3
flyctl scale vm performance --cpus=4 --memory=2048
```

### Auto-scaling (Paid plan required)

```powershell
# Edit fly.toml to enable auto-scaling
# Then:
flyctl deploy
```

---

## 🐛 TROUBLESHOOTING

### Check Logs

```powershell
# Real-time logs
flyctl logs -f

# Filter errors
flyctl logs | grep ERROR

# View specific instance
flyctl logs --instance [instance-id]
```

### Common Issues

#### 1. Build fails: "npm: not found"

**Fix**: Update Dockerfile to use `npm run build` (already done)

#### 2. App crashes: "Cannot connect to database"

**Fix**:

```powershell
flyctl secrets set POSTGRES_URL="correct-url"
flyctl deploy
```

#### 3. Health check fails

**Fix**:

```powershell
flyctl logs | grep health
# Ensure /health endpoint is returning 200
```

#### 4. Memory limit exceeded

**Fix**: Scale up VM or reduce memory usage

```powershell
flyctl scale vm shared-cpu --memory=512
```

### Restart App

```powershell
flyctl restart
```

### Rollback to Previous Deployment

```powershell
flyctl releases
flyctl releases rollback
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] `flyctl status` shows "Running"
- [ ] `curl https://[app-name].fly.dev/health` returns 200
- [ ] API endpoints accessible from frontend
- [ ] Database migrations ran successfully
- [ ] Qdrant collections initialized
- [ ] Redis cache working
- [ ] Background jobs running
- [ ] File uploads working
- [ ] Logs show no errors

---

## 💰 COST ESTIMATION (First Year)

### Free Tier (MVP)

- Fly.io: **$0** (3 shared CPU containers free)
- Supabase: **$10-20** (free tier limited to 50,000 rows)
- Qdrant Cloud: **$0-20** (free tier: 1GB)
- Upstash Redis: **$0-10** (free tier: 10,000 commands/day)
- **Total: $10-50/month**

### Paid Tier (10-100 users)

- Fly.io: **$15-30** (2-3 containers, 512MB RAM each)
- Supabase: **$25-50** (auth, storage, real-time)
- Qdrant Cloud: **$20-50** (larger cluster)
- Upstash Redis: **$20-50** (higher throughput)
- **Total: $80-180/month**

### Enterprise (100+ users)

- Fly.io: **$50-200** (dedicated machines)
- Supabase Pro: **$25** + usage
- Qdrant: Self-host or enterprise
- **Total: $100-500/month**

---

## 🚀 NEXT STEPS

1. **Install flyctl** (Step 1 above)
2. **Run deployment steps** (Steps 2-6)
3. **Test endpoints** with Postman/curl
4. **Deploy frontend** to Vercel pointing to `https://[app-name].fly.dev`

---

## 📚 DOCUMENTATION

- Fly.io Docs: https://fly.io/docs/
- NestJS Deployment: https://docs.nestjs.com/deployment
- PostgreSQL on Fly: https://fly.io/docs/postgres/
- Troubleshooting: https://fly.io/docs/getting-started/troubleshooting/
