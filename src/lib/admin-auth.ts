export const ADMIN_PORTAL_SESSION_KEY = 'legatrixon_admin_portal_session'

export function storedAdminPortalSession() {
  return window.sessionStorage.getItem(ADMIN_PORTAL_SESSION_KEY) || ''
}

export async function adminAuthHeaders(includeJson = false): Promise<Record<string, string>> {
  let token = storedAdminPortalSession()
  if (!token) {
    try {
      token = await (window as any).Clerk?.session?.getToken?.() || ''
    } catch {
      token = ''
    }
  }
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
