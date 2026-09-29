# Render Deployment - Quick Settings Reference

## Copy-Paste These Values to Render Dashboard

### Service Settings

```
Name: legatrixon-api
Environment: Node
Region: US (or closest to you)
Root Directory: server
Build Command: npm install && npm run build
Start Command: npm run start:prod
```

### Environment Variables (Copy to Render Dashboard)

**Copy each line as KEY=VALUE to Render Settings → Environment**

```
NODE_ENV=production
CLIENT_ORIGINS=https://your-vercel-frontend.vercel.app,https://www.your-vercel-frontend.vercel.app

NEXT_PUBLIC_SUPABASE_URL=https://mydrikssmzzudzqeqroe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://mydrikssmzzudzqeqroe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://mydrikssmzzudzqeqroe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

QDRANT_URL=https://dd284eb5-9c7e-4f0e-92fd-815f87684ce0.us-west-1-0.aws.cloud.qdrant.io
QDRANT_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-proj-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=<your-gemini-api-key>

GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=https://legatrixon-api.onrender.com/api/v1/calendar/callback

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=legatrixon2026@gmail.com
SMTP_PASS=zqth uhom yxsu ofpm
SECURITY_EMAIL_FROM=legatrixon2026@gmail.com

BYOK_ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2

LEARNING_INDEXING_CONCURRENCY=2
LEARNING_CHUNK_SIZE=1400
```

## After Deployment

**Backend URL (use in frontend):**

```
https://legatrixon-api.onrender.com/api/v1
```

**Health Check Endpoint:**

```
https://legatrixon-api.onrender.com/health
```

**Frontend .env to Update:**

```
VITE_API_URL=https://legatrixon-api.onrender.com/api/v1
VITE_SUPABASE_URL=https://mydrikssmzzudzqeqroe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

## Critical Notes

⚠️ **Important**:

- Replace `YOUR_VERCEL_FRONTEND_URL` with actual Vercel URL
- Keep `CLIENT_ORIGINS` in `NODE_ENV=production` - it's required
- Service Role Keys (marked with `SUPABASE_SERVICE_ROLE_KEY`) are backend-only, never expose to frontend
- All API keys must be valid and non-expired
- Test health endpoint after deployment: `curl https://legatrixon-api.onrender.com/health`

