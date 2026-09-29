# ⚡ UPLOAD FIX - IMMEDIATE DEPLOYMENT CHECKLIST

## 🚀 ACTION REQUIRED: Configure Vercel Environment Variables

Your upload fix is ready. The issue is that **VITE_API_URL is not set in production**. 

### Step 1: Set Environment Variables in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click on project: **legatrixon**
3. Click **Settings** → **Environment Variables**
4. Add the following variables:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `VITE_API_URL` | `https://legatrixon-api.onrender.com/api/v1` | Production, Preview |
| `VITE_API_BASE_URL` | `https://legatrixon-api.onrender.com/api/v1` | Production, Preview |

**How to add:**
- Click "Add New"
- Name: `VITE_API_URL`
- Value: `https://legatrixon-api.onrender.com/api/v1`
- Environments: Check "Production" and "Preview"
- Click "Save"
- Repeat for `VITE_API_BASE_URL`

### Step 2: Redeploy Frontend on Vercel

Option A (Automatic):
- Push code to main branch
- Vercel auto-deploys
- Wait 2-3 minutes for deployment to complete

Option B (Manual):
- In Vercel Dashboard
- Click "Deployments" tab
- Click "..." menu on latest deployment
- Click "Redeploy"
- Confirm deployment

### Step 3: Verify Render Backend Configuration

Check that Render backend has the CORS environment variable:

1. Go to https://dashboard.render.com
2. Click on **legatrixon-backend** service
3. Click **Environment**
4. Verify `CLIENT_ORIGINS` contains your Vercel frontend URL:
   ```
   CLIENT_ORIGINS=https://legatrixon.vercel.app
   ```
   
   If missing or incorrect:
   - Add/update: `CLIENT_ORIGINS=https://legatrixon.vercel.app`
   - Click "Save"
   - Service will redeploy automatically

### Step 4: Test Upload After Deployment

**Wait for Vercel deployment to complete (check status in dashboard)**

Then test upload:
1. Go to https://legatrixon.vercel.app
2. Login (if not already)
3. Go to Dashboard → Storage Workspace
4. Try uploading a PDF
5. Check if it succeeds (status: "Indexed Successfully")

---

## 📝 Files Changed

### New Files Created:
- ✅ `.env.production` - Production environment variables template
- ✅ `UPLOAD_DIAGNOSTICS.md` - Comprehensive testing & troubleshooting guide

### Files Modified:
- ✅ `src/lib/api.ts` - Improved API URL configuration with debug logging

### Files Already Correct (No Changes Needed):
- ✓ `src/App.tsx` - Upload functions
- ✓ `api/v1/[...path].ts` - Vercel Edge Function upload endpoint
- ✓ `server/src/main.ts` - CORS configuration
- ✓ `server/src/` - Backend upload handling (if using Render)

---

## 🔍 What Was Fixed

### The Problem:
```
❌ BEFORE:
  Frontend: Uses /api/v1 (relative path)
  → Browser: POST http://localhost:5173/api/v1/notebook/upload
  → Fails: "Failed to fetch" (wrong endpoint)

✅ AFTER:
  Frontend: Uses https://legatrixon-api.onrender.com/api/v1
  → Browser: POST https://legatrixon-api.onrender.com/api/v1/notebook/upload
  → Success: File uploaded to Render backend
```

### The Solution:
1. **Added VITE_API_URL** - Tells frontend where backend is
2. **Improved logging** - Shows debug info in console if misconfigured
3. **Created templates** - Clear instructions for production setup
4. **Documentation** - Complete testing guide included

---

## ✅ Success Criteria

After deployment, you should be able to:

- ✅ Upload PDF files without "Failed to fetch" error
- ✅ Upload DOCX files and see text extracted
- ✅ Upload PPTX files and see slides processed
- ✅ Upload TXT files directly
- ✅ See "Indexed Successfully" status for all file types
- ✅ View uploaded documents in Storage Workspace
- ✅ Use Study Forge on uploaded documents
- ✅ Chat with LexMentor about uploaded documents

---

## 🐛 Debugging If Upload Still Fails

### If you see "Failed to fetch":

1. **Check Environment Variables:**
   - In browser console, type: `getApiDebugInfo()`
   - Should show: `apiBaseUrl: https://legatrixon-api.onrender.com/api/v1`
   - If shows `/api/v1` → env var not set or deployment incomplete

2. **Check Render Backend:**
   - Can you reach https://legatrixon-api.onrender.com/health?
   - If not → backend is down
   - If yes → check CORS configuration

3. **Check CORS Configuration:**
   - Render dashboard → legatrixon-backend → Environment
   - Look for `CLIENT_ORIGINS` variable
   - Should contain: `https://legatrixon.vercel.app`

4. **Monitor Logs:**
   - Render dashboard → Services → legatrixon-backend → Logs
   - Check for upload errors
   - Look for CORS-related errors

### Debug curl command:
```bash
curl -X POST https://legatrixon-api.onrender.com/api/v1/notebook/upload \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -v
```

---

## 📞 Support

If upload still fails after these steps:
1. Check [UPLOAD_DIAGNOSTICS.md](UPLOAD_DIAGNOSTICS.md) for troubleshooting
2. Review Render backend logs for errors
3. Verify all environment variables are set correctly
4. Confirm backend URL is correct and reachable

---

**Status:** 🟡 Ready for Deployment  
**Action Required:** Set Vercel environment variables (5 minutes)  
**Next:** Test upload after deployment completes
