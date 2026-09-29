const configuredApiBase =
  (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim()

// Production API URL resolution
const DEV_API_URL = 'http://localhost:4000/api/v1'
const PROD_API_FALLBACK = '/api/v1' // For Vercel Edge Functions

export const API_BASE_URL = (() => {
  if (configuredApiBase) {
    // ✅ Explicit configuration (best)
    if (import.meta.env.DEV) {
      console.log('[API] Using configured VITE_API_URL:', configuredApiBase)
    }
    return configuredApiBase.replace(/\/+$/, '')
  }

  if (import.meta.env.DEV) {
    // ✅ Development: Use local NestJS backend
    console.log('[API] Development mode: using', DEV_API_URL)
    return DEV_API_URL
  }

  // ⚠️ Production without explicit config (fallback)
  console.warn(
    '[API] ⚠️ WARNING: VITE_API_URL not set in production.',
    'Using relative path fallback /api/v1 (Vercel Edge Functions).',
    'For proper file uploads, set VITE_API_URL to your backend URL.',
    'Example: https://legatrixon-api.onrender.com/api/v1'
  )
  return PROD_API_FALLBACK
})()

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '')

export const apiUrl = (path = '') =>
  `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

// Debug helper
export const getApiDebugInfo = () => ({
  isDev: import.meta.env.DEV,
  configuredBase: configuredApiBase || '(not set)',
  apiBaseUrl: API_BASE_URL,
  apiOrigin: API_ORIGIN,
  environment: {
    VITE_API_URL: import.meta.env.VITE_API_URL || '(not set)',
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '(not set)',
  },
})

