# 📋 CREDENTIALS CHECKLIST

## Before You Deploy - Collect These

| Credential                      | Where to Get                     | Status       |
| ------------------------------- | -------------------------------- | ------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Settings → API          | [ ] Ready    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API          | [ ] Ready    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase Settings → API (secret) | [ ] Ready    |
| `QDRANT_URL`                    | Qdrant Cloud → Cluster           | [ ] Ready    |
| `QDRANT_API_KEY`                | Qdrant Cloud → API Keys          | [ ] Ready    |
| `OPENROUTER_API_KEY`            | OpenRouter Settings              | [ ] Ready    |
| `REDIS_URL`                     | Upstash Redis → Connection       | [ ] Optional |

---

## 🔧 WHERE TO GET EACH ONE

### Supabase

1. Go to https://app.supabase.com
2. Click your project
3. Go to **Settings → API**
4. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role secret → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

### Qdrant Cloud

1. Go to https://cloud.qdrant.io
2. Click your cluster
3. Go to **Connection String**
4. Copy:
   - HTTP URL → `QDRANT_URL`
   - API Key → `QDRANT_API_KEY`

### OpenRouter

1. Go to https://openrouter.ai
2. Click **Settings** (top right)
3. Copy your API Key → `OPENROUTER_API_KEY`

### Upstash Redis

1. Go to https://upstash.com
2. Go to **Console → Redis**
3. Create a database (if needed)
4. Click **Details**
5. Copy Redis URL → `REDIS_URL`
6. Format: `redis://default:password@hostname:port`

---

## ✅ READY TO DEPLOY?

- [ ] All credentials collected above
- [ ] `choco install flyctl` (installed Fly CLI)
- [ ] `flyctl auth login` (logged in to Fly)
- [ ] Navigate to project folder
- [ ] Run `.\deploy.ps1`

---

## 🚀 NEXT STEP

**Run this command:**

```powershell
cd c:\Users\goyal\OneDrive\Desktop\LEGATRIXON-3
.\deploy.ps1
```

The script will ask you to paste each credential when needed.
