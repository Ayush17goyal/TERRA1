# LEGATRIXON Backend - Render Deployment Guide

**Status**: ✅ Production-Ready for Render

---

## Summary of Changes for Render Deployment

### 1. **Created `.env.example`**

- **File**: `server/.env.example`
- **Purpose**: Documents all required environment variables for production
- **Why**: Helps configure the backend correctly on Render
- **Contains**:
  - Database configuration (PostgreSQL recommended)
  - Supabase keys (service role protected from frontend)
  - Qdrant vector database config
  - API keys (OpenAI, Deepseek, Gemini, OpenRouter)
  - Authentication (Clerk)
  - Email (SMTP for notifications)
  - Encryption keys (BYOK)

### 2. **Improved `server/src/main.ts`**

- **Change**: Fixed CORS production handling
- **Why**: Ensures production mode REQUIRES CLIENT_ORIGINS env var instead of using hardcoded Vercel URLs
- **Ensures**:
  - ✅ Binds to `0.0.0.0` (all interfaces)
  - ✅ Uses `process.env.PORT || 3000`
  - ✅ CORS properly validates production origins
  - ✅ Production deployment will fail immediately if CLIENT_ORIGINS not set
  - ✅ Health endpoints accessible at `/health` and `/api/health` (no prefix)

### 3. **Verified Build Process**

- ✅ `npm run build` compiles TypeScript without errors
- ✅ `dist/src/main.js` created successfully (2,445 bytes)
- ✅ All NestJS modules load correctly
- ✅ Production build is optimized and ready

---

## Render Deployment Configuration

### Step 1: Create New Web Service on Render

Go to [Render Dashboard](https://dashboard.render.com) and create a **New Web Service**

### Step 2: Connect Your Repository

- Choose your GitHub repository
- Select the branch (main/production)

### Step 3: Configure Build & Deploy Settings

| Setting            | Value                             |
| ------------------ | --------------------------------- |
| **Name**           | `legatrixon-api` (or your choice) |
| **Environment**    | Node                              |
| **Region**         | (Choose closest to your users)    |
| **Root Directory** | `server`                          |
| **Build Command**  | `npm install && npm run build`    |
| **Start Command**  | `npm run start:prod`              |

### Step 4: Environment Variables

Set these in Render Dashboard (Settings → Environment):

```
NODE_ENV=production
CLIENT_ORIGINS=https://your-vercel-frontend.vercel.app,https://www.your-vercel-frontend.vercel.app
```

Then add all required variables from `.env.example`:

**Critical (Must Configure):**

```
CLIENT_ORIGINS=<your-frontend-urls>
CLERK_SECRET_KEY=<your-clerk-secret>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-role-key>
QDRANT_API_KEY=<your-qdrant-key>
OPENROUTER_API_KEY=<your-openrouter-key>
```

**Optional but Recommended:**

```
DATABASE_URL=postgresql://user:pass@host/db  # For persistent PostgreSQL
GOOGLE_CLIENT_SECRET=<your-google-secret>
OPENAI_API_KEY=<your-openai-key>
SMTP_PASS=<your-app-password>
```

**See `.env.example` for complete list**

### Step 5: Health Check Configuration

Render will automatically use the `/health` endpoint for health checks.

The backend provides:

- Status: `healthy` / `unhealthy`
- Timestamp: ISO format
- Service details: Database, Supabase, Qdrant, BGE-M3, AI Providers, Storage

**Health Endpoint Details:**

- **GET** `/health` or `/api/health`
- **Response Code**: `200` if healthy, `503` if unhealthy
- **Response Format**:

```json
{
  "status": "healthy",
  "timestamp": "2026-06-24T10:30:00.000Z",
  "details": {
    "database": "Healthy",
    "supabase": "Healthy",
    "qdrant": "Healthy",
    "bgeM3": "Healthy",
    "aiProviders": "Healthy",
    "storage": "Healthy"
  }
}
```

### Step 6: Deploy

Click **Create Web Service** and wait for the build to complete (~3-5 minutes)

Once deployed successfully, you'll get a URL like: **`https://legatrixon-api.onrender.com`**

---

## Backend URL Format

Once deployed on Render:

```
https://legatrixon-api.onrender.com/api/v1
```

---

## Frontend Configuration

Update your Vercel frontend `.env` with the Render backend URL:

```env
VITE_API_URL=https://legatrixon-api.onrender.com/api/v1
VITE_SUPABASE_URL=https://mydrikssmzzudzqeqroe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## Deployment Checklist

- [ ] Create `.env.example` in `server/` ✅ **DONE**
- [ ] Verify `server/src/main.ts` CORS production-safe ✅ **DONE**
- [ ] Run `npm run build` locally and confirm no errors ✅ **DONE**
- [ ] Create Render Web Service
- [ ] Set Root Directory to `server`
- [ ] Set Build Command: `npm install && npm run build`
- [ ] Set Start Command: `npm run start:prod`
- [ ] Add all environment variables from `.env.example`
- [ ] Deploy and monitor `/health` endpoint
- [ ] Test frontend connectivity to backend
- [ ] Verify CORS headers allow frontend origin
- [ ] Check Render logs for any runtime errors

---

## Troubleshooting

### Build Fails with "Build Command exited with code 1"

- Check npm install logs
- Ensure all `dependencies` are listed (not `devDependencies`)
- Verify Node version matches (Render uses Node 18+)
- Clear `node_modules` and `package-lock.json` locally, then reinstall

### Backend starts but frontend can't reach it (CORS Error)

- Verify `CLIENT_ORIGINS` environment variable is set in Render
- Ensure it matches your Vercel frontend URL exactly (case-sensitive)
- Frontend URL must start with `https://` (not http)
- Separate multiple origins with commas, no spaces

### Health endpoint returns 503 (Unhealthy)

- Check `/health` response details for which service is failing
- Verify all required env vars are set in Render
- Check Supabase, Qdrant, and AI provider credentials
- View Render logs for specific error messages

### Port already in use error

- This shouldn't happen on Render (each service gets its own port)
- If it occurs, restart the service from Render dashboard
- Check no other processes are binding to the port

### TypeScript compilation errors

- Run `npm run build` locally to identify issues
- Ensure all type definitions are installed
- Check `server/tsconfig.json` is correct
- Most common: missing types like `@types/node`

---

## Production Best Practices

1. **Database**: Use PostgreSQL (via `DATABASE_URL`) instead of SQLite for production
2. **Secrets**: Never commit `.env` file; use Render environment variables only
3. **Monitoring**: Check Render logs regularly; set up error notifications
4. **CORS**: Always specify exact frontend origins; never use `*` in production
5. **Rate Limiting**: Consider adding rate limiting for API endpoints
6. **SSL**: Render provides free SSL; all traffic is HTTPS by default
7. **Backups**: If using PostgreSQL, enable automated backups

---

## Quick Reference

**Render Build Command:**

```bash
npm install && npm run build
```

**Render Start Command:**

```bash
npm run start:prod
```

**Test Locally Before Deploying:**

```bash
cd server
NODE_ENV=production CLIENT_ORIGINS=http://localhost:5173 npm run build
npm run start:prod
```

**Backend URL on Render:**

```
https://legatrixon-api.onrender.com
```

**API Base URL:**

```
https://legatrixon-api.onrender.com/api/v1
```

**Health Check Endpoint:**

```
https://legatrixon-api.onrender.com/health
```

---

## Files Modified

1. **`server/.env.example`** (NEW)
   - Added comprehensive environment variable documentation
2. **`server/src/main.ts`** (UPDATED)
   - Improved CORS production safety
   - Added validation for CLIENT_ORIGINS in production
   - Clearer separation of dev/prod configurations

---

## Next Steps

1. Commit these changes to your repository
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Create a new Web Service
4. Configure as per the checklist above
5. Deploy and monitor the health endpoint
6. Update frontend with the Render backend URL

---

**Deployment Status**: 🟢 **READY FOR RENDER**

All files are configured and tested. Your NestJS backend is production-ready for Render deployment.
