# LEGATRIXON Upload Feature Diagnostics & Testing Guide

**Date:** 2026-06-24  
**Issue:** PDF uploads fail with "Failed to fetch"  
**Status:** 🔧 FIXING

---

## 1. UPLOAD ENDPOINT CONFIGURATION

### Current Setup

```
┌─────────────────────────────────────────────────────────────┐
│ VERCEL FRONTEND                                             │
│ https://legatrixon.vercel.app                              │
└────────────┬────────────────────────────────────────────────┘
             │ POST /api/v1/notebook/upload
             │ with multipart/form-data
             │
             ├─ Production (Correct):
             │  ↓ VITE_API_URL = https://legatrixon-api.onrender.com/api/v1
             │  └─→ RENDER BACKEND (NestJS)
             │     └─ http://legatrixon-api.onrender.com/api/v1/notebook/upload ✅
             │
             └─ Development:
                ↓ VITE_API_URL = http://localhost:4000/api/v1
                └─→ LOCAL NESTJS
                   └─ http://localhost:4000/api/v1/notebook/upload ✅

```

### File Upload Route Details

**Endpoint:** `POST /api/v1/notebook/upload`

**Headers:**
```
Authorization: Bearer {clerkToken}
Content-Type: multipart/form-data
```

**Body:**
```
file: (binary) PDF, DOCX, PPTX, TXT, or MD file
documentType: Optional - "Judgment", "Bare Act", "Research Paper", "Memorial", "Notes", "Legal Document"
```

**Constraints:**
- Maximum file size: 100MB
- Supported formats: PDF, DOCX, PPTX, TXT, MD
- Authentication: Required (Clerk bearer token)

---

## 2. ENVIRONMENT CONFIGURATION

### Production (.env.production)

```bash
# CRITICAL: Set this for production uploads to work
VITE_API_URL=https://legatrixon-api.onrender.com/api/v1

# Optional (alternative name)
VITE_API_BASE_URL=https://legatrixon-api.onrender.com/api/v1

# Auth & Supabase (public keys, safe to expose)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_SUPABASE_URL=https://mydrikssmzzudzqeqroe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Development (.env.local)

```bash
# Dev uses http://localhost:4000/api/v1 (NestJS) by default
# Only set this if using a different backend
VITE_API_URL=http://localhost:4000/api/v1
```

---

## 3. CORS CONFIGURATION

### Render Backend (NestJS)

**File:** `server/src/main.ts` (lines 27-55)

```typescript
// Production requires CLIENT_ORIGINS env var
app.enableCors({
  origin: corsOrigins,  // ['https://legatrixon.vercel.app', ...]
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true,
  maxAge: 3600,
});
```

**Required Environment Variable on Render:**
```
CLIENT_ORIGINS=https://legatrixon.vercel.app,https://www.legatrixon.vercel.app
```

### Vercel Edge Function

**File:** `api/v1/[...path].ts` (lines 1-10)

```typescript
export const config = {
  api: {
    bodyParser: false,  // ✅ Allows multipart/form-data
  },
};
```

---

## 4. FILE UPLOAD PROCESSING

### Supported File Types

| Format | Handler | Status | Features |
|--------|---------|--------|----------|
| **PDF** | `pdf-parse` library | ✅ | Extracts text, page count, detects scanned PDFs |
| **DOCX** | AdmZip + XML parsing | ✅ | Extracts text from word/document.xml |
| **PPTX** | AdmZip + XML parsing | ✅ | Extracts text from slide XML |
| **TXT** | UTF-8 conversion | ✅ | Direct text read |
| **MD** | UTF-8 conversion | ✅ | Markdown text read |

### Processing Steps

```
1. Receive multipart/form-data
   ↓
2. Extract file buffer & metadata
   ↓
3. Normalize file type (.pdf → PDF, .docx → DOCX, etc.)
   ↓
4. Extract text based on file type
   └─ PDF → pdf-parse
   └─ DOCX → AdmZip XML parsing
   └─ PPTX → AdmZip slide extraction
   └─ TXT/MD → UTF-8 conversion
   ↓
5. Validate extraction
   └─ If < 100 words → Extraction Failed
   └─ If scanned PDF → Try OCR (not implemented)
   └─ If corrupt → Extraction Failed
   ↓
6. Build chunks (1800 chars per chunk)
   ↓
7. Store in Supabase
   └─ notebook_documents table
   └─ study_materials table (fallback)
   ↓
8. Return document metadata
```

---

## 5. TESTING CHECKLIST

### ✅ Pre-Upload Verification

- [ ] Frontend is running: `http://localhost:5173` (dev) or `https://legatrixon.vercel.app` (prod)
- [ ] Backend is running: `http://localhost:4000` (dev) or `https://legatrixon-api.onrender.com` (prod)
- [ ] User is logged in (Clerk authenticated)
- [ ] Check API configuration: Open browser console and run:
  ```javascript
  // Check if API URL is correct
  import { getApiDebugInfo } from './src/lib/api.ts'
  console.log(getApiDebugInfo())
  ```

### 🧪 Test Upload: Judgment PDF

**File:** `test-files/judgment.pdf` (or any PDF)  
**Steps:**
1. Navigate to Dashboard → Storage Workspace
2. Click "Upload Judgment" button
3. Select PDF file (< 100MB)
4. Observe upload progress (should show 0% → 100%)
5. Wait for extraction (status: "Indexing")
6. Verify extraction succeeded (status: "Indexed Successfully")

**Expected Response:**
```json
{
  "id": "doc_...",
  "name": "judgment.pdf",
  "type": "PDF",
  "status": "Indexed Successfully",
  "extractedText": "...",
  "wordCount": 2500,
  "chunkCount": 2,
  "uploadedAt": "2026-06-24T10:30:00Z"
}
```

### 🧪 Test Upload: DOCX File

**File:** `test-files/document.docx`  
**Steps:** Same as PDF test, select "Upload Legal Document"

**Expected:** Similar response with type: "DOCX"

### 🧪 Test Upload: Text File

**File:** `test-files/notes.txt`  
**Steps:** Same as PDF test, select "Upload Notes"

**Expected:** Similar response with type: "TXT"

### 🧪 Test Upload: PowerPoint

**File:** `test-files/presentation.pptx`  
**Steps:** Same as PDF test, select "Upload Research Paper"

**Expected:** Similar response with type: "PPTX"

### 🧪 Test Error Handling

**File:** `test-files/empty.pdf` (empty or corrupted PDF)  
**Steps:** Try to upload empty PDF

**Expected Error:**
```
"This file does not contain enough readable legal text. 
Please upload a clearer PDF, DOCX, TXT, or paste notes manually."
```

---

## 6. TROUBLESHOOTING

### Error: "Failed to fetch"

**Cause 1: CORS Issue**
```
Check: Browser DevTools → Network tab → upload request
Should see: Status 200-201 (success)
If see: Status 0 or OPTIONS failed → CORS issue

Fix:
1. Verify VITE_API_URL is set correctly
2. Check Render backend has CLIENT_ORIGINS env var
3. Restart backend after setting env var
```

**Cause 2: Wrong API URL**
```
Check: Browser Console → type: getApiDebugInfo()
Should see: apiBaseUrl = https://legatrixon-api.onrender.com/api/v1

If see: apiBaseUrl = /api/v1 → VITE_API_URL not set
Fix: Set VITE_API_URL in Vercel dashboard
```

**Cause 3: Backend Not Responding**
```
Check: Can you reach https://legatrixon-api.onrender.com/health ?
If no → backend is down or URL is wrong
If yes → endpoint issue

Test with curl:
curl -X POST https://legatrixon-api.onrender.com/api/v1/notebook/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf"
```

### Error: "Extraction Failed"

**Cause 1: File is empty or corrupted**
```
Fix: Use a valid PDF/DOCX file
Test with: test-files/sample-judgment.pdf
```

**Cause 2: File is too large**
```
Fix: File must be < 100MB
Check file size: ls -lh your-file.pdf
```

**Cause 3: PDF is scanned image**
```
Current: ❌ Not supported (no OCR)
Fix: Convert to searchable PDF using OCR tool
```

### Error: "Unauthorized"

**Cause:** Missing or invalid Clerk token
```
Fix:
1. Ensure user is logged in
2. Check token is being sent: Network tab → upload request headers
3. Verify Clerk is configured correctly
```

---

## 7. DEBUG COMMANDS

### Check API Configuration (Browser Console)

```javascript
// Show current API configuration
import { getApiDebugInfo, API_BASE_URL, API_ORIGIN } from './src/lib/api'
console.log('API Debug Info:', getApiDebugInfo())
console.log('API Base URL:', API_BASE_URL)
console.log('API Origin:', API_ORIGIN)
```

### Test Endpoint (curl)

```bash
# Health check
curl -I https://legatrixon-api.onrender.com/health

# Test upload endpoint (requires valid token)
curl -X POST https://legatrixon-api.onrender.com/api/v1/notebook/upload \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "documentType=Judgment"

# Expected response (201 Created):
# {
#   "id": "doc_...",
#   "status": "Indexed Successfully",
#   ...
# }
```

### Check Render Backend Status

```bash
# SSH into Render and check logs
# Or use Render dashboard: Services → legatrixon-backend → Logs
```

---

## 8. FILES MODIFIED

- ✅ `src/lib/api.ts` - Improved API URL configuration with debug logging
- ✅ `.env.production` - Created with correct VITE_API_URL
- ✅ `src/App.tsx` - Upload functions (already correct)
- ✅ `api/v1/[...path].ts` - Vercel Edge Function (already correct)
- ✅ `server/src/main.ts` - CORS configuration (already correct)

---

## 9. NEXT STEPS

### Immediate (Critical)

1. ✅ Set `VITE_API_URL=https://legatrixon-api.onrender.com/api/v1` in Vercel dashboard
2. ✅ Verify `CLIENT_ORIGINS=https://legatrixon.vercel.app` in Render dashboard
3. ✅ Redeploy frontend on Vercel
4. ✅ Test upload with sample PDF

### Verification

1. Upload Judgment (PDF) - Should succeed ✅
2. Upload Bare Act (DOCX) - Should succeed ✅
3. Upload Research Paper (PPTX) - Should succeed ✅
4. Upload Memorial (TXT) - Should succeed ✅
5. Upload Notes (MD) - Should succeed ✅
6. Upload Legal Document (any format) - Should succeed ✅

### Post-Deployment

- [ ] Monitor Render backend logs for upload processing
- [ ] Verify documents appear in Storage Workspace
- [ ] Test document features (Study Forge, LexMentor chat, etc.)
- [ ] Update production documentation

---

## 10. SUCCESS CRITERIA

✅ **PDF Upload:**
- File uploads without "Failed to fetch" error
- Text is extracted correctly
- Document appears in Storage with status "Indexed Successfully"
- Study Forge features work on uploaded document

✅ **DOCX Upload:**
- File uploads and extracts text from document.xml
- Text conversion works correctly
- Document processing completes

✅ **PPTX Upload:**
- File uploads and extracts text from slides
- Multiple slides are processed
- Document appears with correct word count

✅ **Error Handling:**
- Empty files show correct error message
- Corrupted files don't crash system
- User sees helpful error messages

---

**Last Updated:** 2026-06-24  
**Status:** 🔧 In Progress - Awaiting upload test
