# 🚀 DEPLOY YOUR BACKEND IN 3 STEPS

Your frontend is live at **https://legatrixon-3.vercel.app**  
Your backend will be at **https://legatrixon-backend.fly.dev**

---

## 📋 WHAT YOU NEED (Get These First)

Open these links and copy the values:

1. **Supabase** (https://app.supabase.com → Settings → API)

   ```
   NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...
   ```

2. **Qdrant** (https://cloud.qdrant.io → Your Cluster)

   ```
   QDRANT_URL = https://cluster.qdrant.io
   QDRANT_API_KEY = xxxxxxx
   ```

3. **OpenRouter** (https://openrouter.ai → Settings)

   ```
   OPENROUTER_API_KEY = sk-or-v1-xxxxx
   ```

4. **Upstash Redis** (https://upstash.com → Create DB)
   ```
   REDIS_URL = redis://default:password@hostname:6379
   ```
   _(Optional - can skip if you don't have it)_

---

## 🎯 THREE SIMPLE STEPS

### Step 1: Install Fly CLI (One Time)

```powershell
choco install flyctl
```

### Step 2: Authenticate with Fly.io (One Time)

```powershell
flyctl auth login
```

_Browser opens - authenticate with GitHub_

### Step 3: Run Deploy Script

```powershell
cd c:\Users\goyal\OneDrive\Desktop\LEGATRIXON-3

# This will:
# 1. Build your backend ✓
# 2. Create Fly.io app ✓
# 3. Ask you for credentials (paste them when prompted) ✓
# 4. Deploy to production ✓
# 5. Test health check ✓

.\deploy.ps1
```

**When the script asks for credentials, copy-paste them from the links above.**

---

## ✅ DONE!

When it finishes, you'll see:

```
🎉 DEPLOYMENT COMPLETE!
📱 Your backend is now live at: https://legatrixon-backend.fly.dev
🔗 API base: https://legatrixon-backend.fly.dev/api/v1
```

---

## 🔗 CONNECT TO YOUR FRONTEND

In your Vercel environment variables, add:

```
VITE_API_URL=https://legatrixon-backend.fly.dev/api/v1
```

Then redeploy Vercel → your frontend will connect to the backend automatically.

---

## 🆘 PROBLEMS?

**Script fails to run?**

```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Try again
.\deploy.ps1
```

**Check logs anytime:**

```powershell
flyctl logs -f
```

**Restart the app:**

```powershell
flyctl restart
```

---

## 📊 WHAT YOU GET FOR FREE

✅ NestJS backend running  
✅ PostgreSQL database  
✅ Redis cache  
✅ Vector search (Qdrant)  
✅ File uploads  
✅ Background jobs  
✅ Auto-scaling  
✅ SSL/HTTPS  
✅ Health monitoring

---

## 🚀 YOU'RE READY!

1. Get credentials (4 services listed above)
2. Run `.\deploy.ps1`
3. Paste credentials when asked
4. Done!

**Total time: ~10 minutes**

---

Questions? Check `DEPLOYMENT_FLY_IO.md` for full guide.
