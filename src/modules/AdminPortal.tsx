import { API_BASE_URL, API_ORIGIN } from '../lib/api'
import React, { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  Scale,
  LayoutDashboard,
  DatabaseZap,
  Cpu,
  Brain,
  Users as UsersIcon,
  CreditCard,
  BarChart3,
  Activity,
  History,
  Settings as SettingsIcon,
  Search,
  Lock,
  CalendarDays,
  LogOut,
  ArrowLeft,
  TrendingUp,
  Database,
  Terminal,
  ShieldAlert,
  UserCheck,
  Plus,
  CheckCircle2,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  PenSquare,
  Star,
  ThumbsUp,
  ThumbsDown,
  KeyRound,
  Power,
  BookOpen,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase-client'
import { renderAvatar } from '../lib/avatars'
import { ADMIN_PORTAL_SESSION_KEY, adminAuthHeaders, storedAdminPortalSession } from '../lib/admin-auth'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import IngestionDashboard from './IngestionDashboard'
import MasterclassManagement from './MasterclassManagement'

type AdminTab =
  | 'Dashboard'
  | 'Knowledge Base Manager'
  | 'AI Models'
  | 'Token & Cache Analytics'
  | 'Research Intelligence'
  | 'Users'
  | 'Calendar Monitor'
  | 'Subscriptions'
  | 'Analytics'
  | 'System Monitoring'
  | 'Audit Logs'
  | 'Founder Security Logs'
  | 'Settings'
  | 'Clerk Dashboard Access'
  | 'Feedback Management'
  | 'Bug Reports'
  | 'Feature Requests'
  | 'Support Tickets'
  | 'Contract Settings'
  | 'Masterclass Management'
  | 'API Safety'

type FounderSecurityEventType =
  | 'ADMIN_LOGIN_ATTEMPT'
  | 'ADMIN_LOGIN_SUCCESS'
  | 'ADMIN_LOGIN_FAILED'
  | 'NEW_DEVICE_LOGIN'
  | 'NEW_BROWSER_LOGIN'
  | 'NEW_IP_LOGIN'
  | 'PASSWORD_CHANGE'
  | 'NEW_ADMIN_CREATED'
  | 'ROLE_CHANGED'
  | 'ACCOUNT_LOCKED'
  | 'FOUNDER_PORTAL_ACCESS_ATTEMPT'
  | 'SUPER_ADMIN_ACCESS_ATTEMPT'

const founderSecurityEvents: FounderSecurityEventType[] = [
  'ADMIN_LOGIN_ATTEMPT',
  'ADMIN_LOGIN_SUCCESS',
  'ADMIN_LOGIN_FAILED',
  'NEW_DEVICE_LOGIN',
  'NEW_BROWSER_LOGIN',
  'NEW_IP_LOGIN',
  'PASSWORD_CHANGE',
  'NEW_ADMIN_CREATED',
  'ROLE_CHANGED',
  'ACCOUNT_LOCKED',
  'FOUNDER_PORTAL_ACCESS_ATTEMPT',
  'SUPER_ADMIN_ACCESS_ATTEMPT',
]

const founderEventLabels: Record<FounderSecurityEventType, string> = {
  ADMIN_LOGIN_ATTEMPT: 'Admin Login Attempts',
  ADMIN_LOGIN_SUCCESS: 'Successful Admin Logins',
  ADMIN_LOGIN_FAILED: 'Failed Login Attempts',
  NEW_DEVICE_LOGIN: 'New Device Logins',
  NEW_BROWSER_LOGIN: 'New Browser Logins',
  NEW_IP_LOGIN: 'New IP Address Logins',
  PASSWORD_CHANGE: 'Password Changes',
  NEW_ADMIN_CREATED: 'New Admin Creation',
  ROLE_CHANGED: 'Role Changes',
  ACCOUNT_LOCKED: 'Account Lock Events',
  FOUNDER_PORTAL_ACCESS_ATTEMPT: 'Founder Portal Access Attempts',
  SUPER_ADMIN_ACCESS_ATTEMPT: 'Super Admin Access Attempts',
}

async function notifyFounderSecurity(eventType: FounderSecurityEventType, metadata: Record<string, any> = {}) {
  try {
    await fetch(`${API_BASE_URL}/founder-security/events`, {
      method: 'POST',
      headers: await adminAuthHeaders(true),
      body: JSON.stringify({
        eventType,
        actorEmail: metadata.actorEmail || 'admin-console@legatrixon.local',
        title: founderEventLabels[eventType],
        message: `${founderEventLabels[eventType]} detected in LEGATRIXON Admin Console.`,
        metadata: {
          browser: navigator.userAgent,
          path: window.location.pathname,
          ...metadata,
        },
      }),
    })
  } catch (error) {
    console.warn('[Founder Security] Event notification failed', error)
  }
}

type FounderSecurityLogTab = 'Access Intelligence' | 'Notification Audit Log'

const adminAccessEventTypes = new Set<FounderSecurityEventType>([
  'ADMIN_LOGIN_ATTEMPT',
  'ADMIN_LOGIN_SUCCESS',
  'ADMIN_LOGIN_FAILED',
  'ACCOUNT_LOCKED',
])

function sanitizeSecurityMetadata(value: any): any {
  if (Array.isArray(value)) return value.map(sanitizeSecurityMetadata)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      const normalizedKey = key.toLowerCase()
      if (normalizedKey.includes('answer') || normalizedKey.includes('question')) {
        return [key, '[REDACTED]']
      }
      return [key, sanitizeSecurityMetadata(nestedValue)]
    })
  )
}

function getSecurityQuestionCategory(role: string) {
  if (role === 'CTO') return 'CTO Verification'
  if (role === 'Developer') return 'Developer Verification'
  return 'Founder Verification'
}

function getBrowserName(userAgent?: string) {
  const ua = userAgent || ''
  if (/Edg\//i.test(ua)) return 'Microsoft Edge'
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari'
  return ua ? 'Browser detected' : 'Unknown'
}

function getDeviceName(userAgent?: string) {
  const ua = userAgent || ''
  if (/iPad|Tablet/i.test(ua)) return 'Tablet'
  if (/Mobi|Android|iPhone/i.test(ua)) return 'Mobile'
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'Desktop'
  return ua ? 'Device detected' : 'Unknown'
}

function getAccessResult(event: any) {
  if (event.eventType === 'ADMIN_LOGIN_SUCCESS') return 'Access Granted'
  if (event.eventType === 'ACCOUNT_LOCKED') return 'Account Locked'
  if (event.metadata?.failedSecurityQuestion || event.metadata?.rejectedViaEmail) return 'Verification Failed'
  return 'Access Denied'
}

function getVerificationResult(event: any) {
  if (event.eventType === 'ADMIN_LOGIN_SUCCESS') return 'Successful Verification'
  if (event.eventType === 'ACCOUNT_LOCKED') return 'Account Locked'
  if (event.metadata?.failedSecurityQuestion || event.metadata?.rejectedViaEmail) return 'Failed Verification'
  return 'Verification Started'
}

export default function AdminPortal() {
  const navigate = useNavigate()
  
  // Authentication states
  const [role, setRole] = useState('Founder')
  const [step, setStep] = useState(1)
  const [sessionToken, setSessionToken] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [adminId, setAdminId] = useState('')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [approvalToken, setApprovalToken] = useState('')
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false)
  const [showBetterLuckPopup, setShowBetterLuckPopup] = useState(false)

  // Workspace states
  const [activeTab, setActiveTab] = useState<AdminTab>('Dashboard')

  useEffect(() => {
    const restoreSession = async () => {
      const token = storedAdminPortalSession()
      if (!token) return
      try {
        const response = await fetch(`${API_BASE_URL}/founder-security/admin-session`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) setIsAuthenticated(true)
        else window.sessionStorage.removeItem(ADMIN_PORTAL_SESSION_KEY)
      } catch {
        // Leave the login screen available when the backend cannot validate.
      }
    }
    void restoreSession()

    notifyFounderSecurity('FOUNDER_PORTAL_ACCESS_ATTEMPT', {
      reason: isAuthenticated ? 'Admin portal accessed (authenticated session)' : 'Admin portal accessed (unauthenticated login screen)'
    })
    notifyFounderSecurity('SUPER_ADMIN_ACCESS_ATTEMPT', {
      reason: isAuthenticated ? 'Super admin console route loaded (authenticated session)' : 'Super admin console route loaded (unauthenticated login screen)'
    })

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      const validTabs: AdminTab[] = [
        'Dashboard',
        'Knowledge Base Manager',
        'AI Models',
        'Token & Cache Analytics',
        'Research Intelligence',
        'Users',
        'Calendar Monitor',
        'Subscriptions',
        'Analytics',
        'System Monitoring',
        'Audit Logs',
        'Founder Security Logs',
        'Settings',
        'API Safety',
        'Clerk Dashboard Access',
        'Feedback Management',
        'Bug Reports',
        'Feature Requests',
        'Support Tickets'
      ];
      const found = validTabs.find(t => t.toLowerCase() === tabParam.toLowerCase() || t === tabParam);
      if (found) {
        setActiveTab(found);
      }
    }
  }, [])

  useEffect(() => {
    if (!isWaitingForApproval || !approvalToken) return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/founder-security/login-status?token=${approvalToken}`)
        if (!res.ok) return
        const data = await res.json()
        
        if (data.status === 'approved') {
          if (!data.sessionToken) {
            clearInterval(timer)
            setIsWaitingForApproval(false)
            setLoginError('Approval completed without a verifiable admin session. Please restart the login flow.')
            setStep(1)
            return
          }
          clearInterval(timer)
          window.sessionStorage.setItem(ADMIN_PORTAL_SESSION_KEY, data.sessionToken)
          setIsWaitingForApproval(false)
          setIsAuthenticated(true)
          setLoginError('')
        } else if (data.status === 'rejected') {
          clearInterval(timer)
          setIsWaitingForApproval(false)
          setLoginError('You are not authorized to enter in the admin portal')
          setShowBetterLuckPopup(true)
          setStep(1)
        } else if (data.status === 'invalid') {
          clearInterval(timer)
          setIsWaitingForApproval(false)
          setLoginError('Authorization request expired or invalid.')
          setStep(1)
        }
      } catch (err) {
        console.error('Polling approval status failed', err)
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [isWaitingForApproval, approvalToken])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    try {
      const response = await fetch(`${API_BASE_URL}/founder-security/admin-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role, adminId, password }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      if (result.ok) {
        if (result.step2Required) {
          setSessionToken(result.sessionToken)
          setSecurityQuestion(result.question)
          setStep(2)
          setLoginError('')
        } else if (result.pendingApproval && result.token) {
          setApprovalToken(result.token)
          setIsWaitingForApproval(true)
          setStep(3)
          setLoginError('')
        } else {
          setLoginError('Admin approval flow was not started.')
        }
      } else {
        if (result.locked) {
          setLoginError(result.message)
          setShowBetterLuckPopup(true)
        } else {
          setLoginError(result.message || 'Invalid Administrator Credentials.')
        }
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Admin authentication service unavailable.')
    }
  }

  const handleVerifyQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    try {
      const response = await fetch(`${API_BASE_URL}/founder-security/verify-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionToken, answer: securityAnswer }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      if (result.ok) {
        if (result.pendingApproval) {
          setApprovalToken(result.token)
          setIsWaitingForApproval(true)
          setStep(3)
          setLoginError('')
        } else {
          setIsAuthenticated(true)
          setLoginError('')
        }
      } else {
        if (result.locked) {
          setLoginError(result.message)
          setShowBetterLuckPopup(true)
          setStep(1)
          setSecurityAnswer('')
        } else {
          setLoginError(result.message || 'Incorrect security answer.')
        }
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Security question validation failed.')
    }
  }

  const handleLogout = () => {
    window.sessionStorage.removeItem(ADMIN_PORTAL_SESSION_KEY)
    setIsAuthenticated(false)
    setAdminId('')
    setPassword('')
    setRole('Founder')
    setStep(1)
    setSessionToken('')
    setSecurityQuestion('')
    setSecurityAnswer('')
    setApprovalToken('')
    setIsWaitingForApproval(false)
    navigate('/admin')
  }

  if (!isAuthenticated) {
    return (
      <main className="admin-login-wrap" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at center, var(--bg-elev) 0%, var(--bg) 100%)',
        fontFamily: "'Inter', sans-serif"
      }}>
        <section className="login-card glass-card" style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          background: 'var(--panel)',
          backdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow)',
          display: 'grid',
          gap: '24px'
        }}>
          {step === 3 || isWaitingForApproval ? (
            <div style={{ textAlign: 'center', display: 'grid', gap: '20px', padding: '12px 0' }}>
              <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  border: '3px solid var(--line)',
                  borderRadius: '50%',
                  opacity: 0.3
                }} />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  border: '3px solid transparent',
                  borderTopColor: 'var(--gold)',
                  borderRadius: '50%',
                  animation: 'spin 1.2s linear infinite'
                }} />
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold)'
                }}>
                  <Lock size={28} />
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px', fontFamily: 'Sora, sans-serif' }}>
                  Awaiting Authorization
                </h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', margin: 0, lineHeight: '1.5' }}>
                  A secure 2FA login request has been sent to the founder's email (<strong>legatrixon2026@gmail.com</strong>).
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--gold)', margin: '12px 0 0', fontWeight: '600' }}>
                  Please check your inbox to Approve or Reject...
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsWaitingForApproval(false)
                  setApprovalToken('')
                  setStep(1)
                }}
                className="btn btn-outline"
                style={{
                  padding: '10px 16px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  margin: '12px auto 0',
                  cursor: 'pointer',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--text)',
                  outline: 'none'
                }}
              >
                Cancel Request
              </button>
            </div>
          ) : step === 2 ? (
            <>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span className="legatrixon-logo-circle" style={{ width: '64px', height: '64px', borderWidth: '2px', margin: '0 auto' }} />
                <h1 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '4px 0 0', fontFamily: 'Sora, sans-serif' }}>
                  SECURITY CHALLENGE
                </h1>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', margin: 0 }}>
                  Role-specific verification step required.
                </p>
              </div>

              <form onSubmit={handleVerifyQuestion} style={{ display: 'grid', gap: '16px' }}>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'rgba(245, 193, 79, 0.04)',
                  border: '1px dashed var(--gold)',
                  color: 'var(--text)',
                  fontSize: '0.88rem',
                  lineHeight: '1.4',
                  textAlign: 'center',
                  fontWeight: '600'
                }}>
                  "{securityQuestion}"
                </div>

                <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Security Answer
                  <input
                    type="password"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter security answer"
                    required
                    autoFocus
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      marginTop: '4px'
                    }}
                  />
                </label>

                {loginError && (
                  <p style={{ fontSize: '0.82rem', color: '#ff6b6b', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={14} />
                    {loginError}
                  </p>
                )}

                <button type="submit" className="btn btn-primary" style={{
                  width: '100%',
                  padding: '12px',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}>
                  <Lock size={16} /> Verify Identity
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setSecurityAnswer('')
                    setLoginError('')
                  }}
                  className="btn btn-outline"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.84rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                >
                  Back
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span className="legatrixon-logo-circle" style={{ width: '64px', height: '64px', borderWidth: '2px', margin: '0 auto' }} />
                <h1 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '4px 0 0', fontFamily: 'Sora, sans-serif' }}>
                  ADMIN CONSOLE
                </h1>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', margin: 0 }}>
                  Select administrative role and enter credentials.
                </p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'grid', gap: '16px' }}>
                <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Select Role
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      marginTop: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Founder" style={{ background: 'var(--panel)', color: 'var(--text)' }}>Founder</option>
                    <option value="CTO" style={{ background: 'var(--panel)', color: 'var(--text)' }}>CTO</option>
                    <option value="Developer" style={{ background: 'var(--panel)', color: 'var(--text)' }}>Developer</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Admin ID
                  <input
                    type="text"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    placeholder="Enter Admin ID"
                    required
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      marginTop: '4px'
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Passphrase
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Passphrase"
                    required
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      marginTop: '4px'
                    }}
                  />
                </label>

                {loginError && (
                  <p style={{ fontSize: '0.82rem', color: '#ff6b6b', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={14} />
                    {loginError}
                  </p>
                )}

                <button type="submit" className="btn btn-primary" style={{
                  width: '100%',
                  padding: '12px',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}>
                  <Lock size={16} /> Authenticate Console
                </button>
              </form>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', textAlign: 'center' }}>
                <Link to="/" style={{ fontSize: '0.82rem', color: 'var(--text-soft)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowLeft size={14} /> Back to main portal
                </Link>
              </div>
            </>
          )}
        </section>

        {showBetterLuckPopup && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Inter', sans-serif"
          }}>
            <div style={{
              background: 'var(--panel)',
              border: '1px solid #f43f5e',
              borderRadius: '16px',
              padding: '36px',
              maxWidth: '380px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'grid',
              gap: '20px',
              boxSizing: 'border-box'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                background: 'rgba(244, 63, 94, 0.1)',
                color: '#f43f5e',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                fontSize: '28px',
                fontWeight: 'bold'
              }}>
                ✕
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#f8fafc', margin: '0 0 8px', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'Sora, sans-serif' }}>
                  Access Blocked
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', margin: 0, lineHeight: '1.6' }}>
                  {loginError || 'You are not authorized to enter in the admin portal'}
                </p>
                <div style={{
                  marginTop: '16px',
                  fontSize: '1.15rem',
                  fontWeight: '800',
                  color: 'var(--gold)',
                  fontFamily: 'Sora, sans-serif',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase'
                }}>
                  Better luck next time!
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBetterLuckPopup(false)}
                className="btn btn-primary"
                style={{
                  background: '#f43f5e',
                  borderColor: '#f43f5e',
                  color: '#ffffff',
                  fontWeight: '800',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: 'none',
                  fontSize: '0.88rem'
                }}
              >
                Dismiss
              </button>
            </div>
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>
          </div>
        )}
      </main>
    )
  }

  const sidebarItems = [
    { name: 'Dashboard' as AdminTab, icon: <LayoutDashboard size={16} /> },
    { name: 'Knowledge Base Manager' as AdminTab, icon: <DatabaseZap size={16} /> },
    { name: 'AI Models' as AdminTab, icon: <Cpu size={16} /> },
    { name: 'API Safety' as AdminTab, icon: <ShieldAlert size={16} /> },
    { name: 'Token & Cache Analytics' as AdminTab, icon: <Activity size={16} /> },
    { name: 'Research Intelligence' as AdminTab, icon: <Brain size={16} /> },
    { name: 'Users' as AdminTab, icon: <UsersIcon size={16} /> },
    { name: 'Calendar Monitor' as AdminTab, icon: <CalendarDays size={16} /> },
    { name: 'Subscriptions' as AdminTab, icon: <CreditCard size={16} /> },
    { name: 'Analytics' as AdminTab, icon: <BarChart3 size={16} /> },
    { name: 'System Monitoring' as AdminTab, icon: <Activity size={16} /> },
    { name: 'Audit Logs' as AdminTab, icon: <History size={16} /> },
    { name: 'Founder Security Logs' as AdminTab, icon: <ShieldAlert size={16} /> },
    { name: 'Settings' as AdminTab, icon: <SettingsIcon size={16} /> },
    { name: 'Contract Settings' as AdminTab, icon: <Scale size={16} /> },
    { name: 'Clerk Dashboard Access' as AdminTab, icon: <Lock size={16} /> },
    { name: 'Feedback Management' as AdminTab, icon: <MessageSquare size={16} /> },
    { name: 'Bug Reports' as AdminTab, icon: <AlertTriangle size={16} /> },
    { name: 'Feature Requests' as AdminTab, icon: <PenSquare size={16} /> },
    { name: 'Support Tickets' as AdminTab, icon: <History size={16} /> },
    { name: 'Masterclass Management' as AdminTab, icon: <BookOpen size={16} /> },
  ]

  return (
    <main className="admin-shell" style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Sidebar */}
      <aside className="admin-sidebar" style={{
        width: '260px',
        background: 'var(--bg-elev)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', paddingLeft: '8px' }}>
          <span className="legatrixon-logo-circle" style={{ width: '28px', height: '28px' }} />
          <span style={{ fontWeight: '900', letterSpacing: '0.04em', color: 'var(--text)', fontSize: '0.95rem' }}>
            LEGATRIXON
          </span>
          <span style={{ fontSize: '0.66rem', background: 'var(--gold-soft)', color: 'var(--gold)', border: '1px solid var(--line)', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>v2.0 ADMIN</span>
        </div>

        <nav style={{ display: 'grid', gap: '4px', flex: 1, alignContent: 'start' }}>
          {sidebarItems.map((item) => {
            if (item.name === 'Clerk Dashboard Access' && role !== 'Founder' && role !== 'CTO') {
              return null
            }
            const isSel = activeTab === item.name
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => setActiveTab(item.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSel ? 'var(--gold-soft)' : 'transparent',
                  color: isSel ? 'var(--gold)' : 'var(--text-soft)',
                  fontWeight: '600',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: '180ms ease'
                }}
              >
                {item.icon}
                {item.name === 'Knowledge Base Manager' 
                  ? 'Knowledge Base™' 
                  : item.name === 'Clerk Dashboard Access' 
                    ? 'Clerk Dashboard Access™' 
                    : item.name}
              </button>
            )
          })}
        </nav>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: 'auto', display: 'grid', gap: '6px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-soft)',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <ArrowLeft size={14} /> User Dashboard
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: '#ff6b6b',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <section className="admin-main" style={{
        flex: 1,
        padding: '24px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Top Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '14px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
              {activeTab === 'Knowledge Base Manager' ? 'Knowledge Base Manager™' : activeTab}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', margin: '2px 0 0' }}>
              System Operator Portal • Administrator Mode
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-soft)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '5px 10px', borderRadius: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)' }} />
              DeepSeek R1: Online
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-soft)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '5px 10px', borderRadius: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ok)', boxShadow: '0 0 6px var(--ok)' }} />
              Qdrant: Connected
            </div>
          </div>
        </header>

        {/* View Switcher */}
        {activeTab === 'Dashboard' && <DashboardView />}
        {activeTab === 'Knowledge Base Manager' && <KBManagerView />}
        {activeTab === 'AI Models' && <ModelsView />}
        {activeTab === 'API Safety' && <DemoModeAdminView />}
        {activeTab === 'Token & Cache Analytics' && <TokenAndCacheAnalyticsView />}
        {activeTab === 'Research Intelligence' && <ResearchIntelligenceView />}
        {activeTab === 'Users' && <UsersView />}
        {activeTab === 'Calendar Monitor' && <CalendarMonitorView />}
        {activeTab === 'Subscriptions' && <SubscriptionsView />}
        {activeTab === 'Analytics' && <AnalyticsView />}
        {activeTab === 'System Monitoring' && <SystemMonitoringView />}
        {activeTab === 'Audit Logs' && <AuditLogsView />}
        {activeTab === 'Founder Security Logs' && <FounderSecurityLogsView />}
        {activeTab === 'Settings' && <FounderSecuritySettingsView />}
        {activeTab === 'Clerk Dashboard Access' && <ClerkDashboardAccessView role={role} adminId={adminId} />}
        {activeTab === 'Feedback Management' && <FeedbackManagementView />}
        {activeTab === 'Bug Reports' && <BugReportsView />}
        {activeTab === 'Feature Requests' && <FeatureRequestsView />}
        {activeTab === 'Support Tickets' && <SupportTicketsView />}
        {activeTab === 'Contract Settings' && <ContractSettingsView />}
        {activeTab === 'Masterclass Management' && <MasterclassManagement />}
      </section>
    </main>
  )
}

/* ================================================== */
/* SUB-VIEWS IMPLEMENTATIONS                          */
/* ================================================== */

function DemoModeAdminView() {
  const { getToken } = useAuth()
  const [overview, setOverview] = useState<any>(null)
  const [limit, setLimit] = useState(4)
  const [status, setStatus] = useState('Loading API safety settings…')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const token = await getToken()
      if (!token) throw new Error('Sign in with the authorized Clerk admin account to manage Demo Mode.')
      const response = await fetch(`${API_BASE_URL}/settings/demo-mode/admin-overview`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Unable to load Demo Mode settings.')
      setOverview(data)
      setLimit(Number(data.limitPerFeaturePerDay || 4))
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load Demo Mode settings.')
    }
  }

  useEffect(() => { void load() }, [])

  const save = async (patch: { enabled?: boolean; limitPerFeaturePerDay?: number }) => {
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Administrator authentication is required.')
      const response = await fetch(`${API_BASE_URL}/settings/demo-mode`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(patch),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Demo Mode update failed.')
      setStatus(`Demo Mode is now ${data.enabled ? 'ACTIVE' : 'DISABLED'}.`)
      await load()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Demo Mode update failed.')
    } finally { setSaving(false) }
  }

  const active = Boolean(overview?.enabled)
  return <div style={{ display: 'grid', gap: 18 }} className="reveal-up">
    <div className="glass-card" style={{ padding: 22, background: 'var(--panel)', border: `1px solid ${active ? 'var(--ok)' : 'var(--line)'}`, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div><h3 style={{ margin: 0, color: 'var(--gold)', letterSpacing: '.06em' }}>DEMO MODE</h3><p style={{ margin: '6px 0 0', color: 'var(--text-soft)' }}>Demo Mode is currently <strong style={{ color: active ? 'var(--ok)' : 'var(--text)' }}>{active ? 'ACTIVE' : 'DISABLED'}</strong></p></div>
        <button disabled={saving || !overview} onClick={() => save({ enabled: !active })} className="btn btn-primary" style={{ minWidth: 130, padding: '12px 18px', fontWeight: 900, cursor: saving ? 'wait' : 'pointer', background: active ? '#ef4444' : 'var(--ok)', border: 0, color: '#fff' }}><Power size={16} /> Turn {active ? 'OFF' : 'ON'}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}><label style={{ display: 'grid', gap: 6, color: 'var(--text-soft)', fontSize: '.8rem' }}>Uses per feature per India calendar day<input type="number" min={1} max={100} value={limit} onChange={(event) => setLimit(Number(event.target.value))} style={{ padding: 10, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8, width: 180 }} /></label><button disabled={saving} onClick={() => save({ limitPerFeaturePerDay: limit })} className="btn btn-outline" style={{ padding: '10px 16px' }}>Save limit</button></div>
      {status && <p role="status" style={{ margin: 0, color: 'var(--text-soft)' }}>{status}</p>}
    </div>
    {overview && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>{[
      ['Total users', overview.totalUsers], ['Today’s API uses', overview.todayUsage], ['Active demo users', overview.activeUsers], ['Users at a limit', overview.usersReachingLimits], ['API errors today', overview.apiErrorsToday],
    ].map(([label, value]) => <div key={String(label)} className="glass-card" style={{ padding: 16, background: 'var(--panel)', border: '1px solid var(--line)' }}><span style={{ color: 'var(--text-soft)', fontSize: '.76rem' }}>{label}</span><strong style={{ display: 'block', fontSize: '1.5rem', marginTop: 6 }}>{value}</strong></div>)}</div>}
    {overview?.topFeatures?.length > 0 && <div className="glass-card" style={{ padding: 18, background: 'var(--panel)', border: '1px solid var(--line)' }}><h3 style={{ color: 'var(--gold)', marginTop: 0 }}>Top used features today</h3>{overview.topFeatures.map((item: any) => <div key={item.feature} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--line)' }}><span>{item.label}</span><strong>{item.uses}</strong></div>)}</div>}
  </div>
}

// 1. Dashboard View
function DashboardView() {
  const stats = [
    { label: 'Total Users', val: '12,480', inc: '+12% MoM', icon: <UsersIcon size={18} /> },
    { label: 'Active Users Today', val: '1,842', inc: '+8% vs yesterday', icon: <UserCheck size={18} /> },
    { label: 'Total Research Reports', val: '45,920', inc: '+15k this week', icon: <Brain size={18} /> },
    { label: 'Total AI Chats', val: '128,490', inc: '+34k this week', icon: <Cpu size={18} /> },
    { label: 'Documents Indexed', val: '8,421', inc: '+142 today', icon: <DatabaseZap size={18} /> },
    { label: 'Total Judgments', val: '5,118', inc: 'BGE-M3 Grounded', icon: <Scale size={18} /> },
    { label: 'Total Bare Acts', val: '302', inc: 'Fully Chunked', icon: <Terminal size={18} /> },
    { label: 'Research Papers', val: '3,001', inc: 'Scrape Pipeline', icon: <Search size={18} /> },
    { label: 'Total Embeddings', val: '4.8M', inc: 'Qdrant Dense', icon: <Activity size={18} /> },
    { label: 'Qdrant Collections', val: '6', inc: 'Fully Synced', icon: <Database size={18} /> }
  ]

  const dataUserGrowth = [
    { month: 'Jan', users: 4000 },
    { month: 'Feb', users: 5500 },
    { month: 'Mar', users: 7000 },
    { month: 'Apr', users: 8500 },
    { month: 'May', users: 10500 },
    { month: 'Jun', users: 12480 }
  ]

  const dataTopics = [
    { topic: 'Article 21', count: 1240 },
    { topic: 'Basic Structure', count: 980 },
    { topic: 'Sec 299 Homicide', count: 850 },
    { topic: 'Privacy Rights', count: 620 },
    { topic: 'Contract Act Sec 56', count: 480 }
  ]

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      {/* Stats Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        {stats.map((s) => (
          <div key={s.label} className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--gold)' }}>
              {s.icon}
              <span style={{ fontSize: '0.68rem', color: 'var(--ok)', background: 'rgba(15, 138, 87, 0.08)', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                {s.inc}
              </span>
            </div>
            <div style={{ marginTop: '4px' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', display: 'block' }}>{s.label}</span>
              <strong style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text)', display: 'block', marginTop: '2px' }}>{s.val}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
        {/* User Growth Area Chart */}
        <div className="glass-card" style={{ padding: '18px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', marginBottom: '14px', textTransform: 'uppercase' }}>
            User Growth Trend (Active Members)
          </h3>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataUserGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.3} />
                <XAxis dataKey="month" stroke="var(--text-soft)" style={{ fontSize: '0.75rem' }} />
                <YAxis stroke="var(--text-soft)" style={{ fontSize: '0.75rem' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.8rem' }} />
                <Area type="monotone" dataKey="users" stroke="var(--gold)" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Researched Topics Bar Chart */}
        <div className="glass-card" style={{ padding: '18px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', marginBottom: '14px', textTransform: 'uppercase' }}>
            Top Legal Research Topics
          </h3>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataTopics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.3} />
                <XAxis dataKey="topic" stroke="var(--text-soft)" style={{ fontSize: '0.65rem' }} />
                <YAxis stroke="var(--text-soft)" style={{ fontSize: '0.75rem' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.8rem' }} />
                <Bar dataKey="count" fill="var(--gold)" radius={[4, 4, 0, 0]}>
                  {dataTopics.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--gold)' : 'rgba(245, 193, 79, 0.6)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// 2. Knowledge Base Manager View
function KBManagerView() {
  const collectionData = [
    { name: 'Constitution', docs: 42, chunks: 520, status: 'Ready', sync: '2 hours ago' },
    { name: 'BNS', docs: 156, chunks: 1420, status: 'Ready', sync: 'Yesterday' },
    { name: 'BNSS', docs: 88, chunks: 940, status: 'Ready', sync: 'Yesterday' },
    { name: 'Evidence Act', docs: 34, chunks: 320, status: 'Ready', sync: '3 days ago' },
    { name: 'Bare Acts', docs: 201, chunks: 2450, status: 'Ready', sync: 'Last week' },
    { name: 'Supreme Court Judgments', docs: 312, chunks: 4500, status: 'Ready', sync: '2 hours ago' },
    { name: 'High Court Judgments', docs: 145, chunks: 2100, status: 'Ready', sync: '2 hours ago' },
    { name: 'Research Papers', docs: 124, chunks: 1800, status: 'Ready', sync: 'Yesterday' },
    { name: 'Law Commission Reports', docs: 18, chunks: 640, status: 'Ready', sync: 'Yesterday' },
    { name: 'User Documents', docs: 420, chunks: 1240, status: 'Ready', sync: '5 minutes ago' }
  ]

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Table of Knowledge Collections */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
            Knowledge Base Collections Telemetry
          </h3>
          <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <Plus size={12} /> Add Collection
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                <th style={{ padding: '8px 10px' }}>Collection Name</th>
                <th style={{ padding: '8px 10px' }}>Document Count</th>
                <th style={{ padding: '8px 10px' }}>Chunk Count</th>
                <th style={{ padding: '8px 10px' }}>Embedding Status</th>
                <th style={{ padding: '8px 10px' }}>Last Sync</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {collectionData.map((c) => (
                <tr key={c.name} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text)' }}>{c.name}</td>
                  <td style={{ padding: '10px' }}>{c.docs} docs</td>
                  <td style={{ padding: '10px' }}>{c.chunks} chunks</td>
                  <td style={{ padding: '10px', color: 'var(--ok)' }}>Synced (1024 Dim)</td>
                  <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{c.sync}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--ok)', background: 'rgba(15,138,87,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(15,138,87,0.2)' }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Render the original pipeline forms & history logger */}
      <IngestionDashboard />
    </div>
  )
}

// 3. AI Models View
function ModelsView() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [status, setStatus] = React.useState('')
  const [form, setForm] = React.useState({
    providerKey: 'openrouter',
    label: '',
    apiKey: '',
    activate: true,
    testBeforeActivate: true,
  })

  const loadProviders = async () => {
    setLoading(true)
    setStatus('')
    try {
      const response = await fetch(`${API_BASE_URL}/admin/providers`, {
        headers: await adminAuthHeaders(),
      })
      if (!response.ok) throw new Error(await response.text())
      setData(await response.json())
    } catch (error: any) {
      setStatus(error.message || 'Provider dashboard failed to load.')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadProviders()
  }, [])

  const saveKey = async () => {
    if (!form.apiKey.trim()) {
      setStatus('Enter an API key before saving.')
      return
    }
    setStatus('Encrypting and validating provider key...')
    try {
      const response = await fetch(`${API_BASE_URL}/admin/providers/keys`, {
        method: 'POST',
        headers: await adminAuthHeaders(true),
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error(await response.text())
      setForm((current) => ({ ...current, apiKey: '', label: '' }))
      setStatus('Provider key saved. Raw key was encrypted server-side and never returned.')
      await loadProviders()
    } catch (error: any) {
      setStatus(error.message || 'Could not save provider key.')
    }
  }

  const postAction = async (path: string, success: string) => {
    setStatus('Applying provider change...')
    try {
      const response = await fetch(`${API_BASE_URL}/admin/providers${path}`, {
        method: 'POST',
        headers: await adminAuthHeaders(true),
      })
      if (!response.ok) throw new Error(await response.text())
      setStatus(success)
      await loadProviders()
    } catch (error: any) {
      setStatus(error.message || 'Provider action failed.')
    }
  }

  const statusColor = (value: string) => {
    if (/healthy|active|connected|backup/i.test(value)) return 'var(--ok)'
    if (/disabled|invalid|quota|billing|rate/i.test(value)) return '#ef4444'
    return 'var(--gold)'
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <section className="glass-card reveal-up" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
              Production AI Provider Health
            </h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
              Encrypted key rotation, quota alerts, and live provider status. Raw keys never leave the backend.
            </p>
          </div>
          <button className="btn btn-outline" onClick={loadProviders} style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-soft)' }}>Loading provider dashboard...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                  <th style={{ padding: '8px 10px' }}>Provider</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Active Key</th>
                  <th style={{ padding: '8px 10px' }}>Backups</th>
                  <th style={{ padding: '8px 10px' }}>Last Failure</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.providers || []).map((provider: any) => (
                  <tr key={provider.providerKey} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: '800', color: 'var(--text)' }}>{provider.displayName}</td>
                    <td style={{ padding: '12px 10px', color: statusColor(provider.status), fontWeight: 700 }}>{provider.enabled ? provider.status : 'disabled'}</td>
                    <td style={{ padding: '12px 10px', fontFamily: 'monospace' }}>{provider.activeKeyFingerprint || 'No active key'}</td>
                    <td style={{ padding: '12px 10px' }}>{provider.backupKeyCount}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-soft)', maxWidth: '260px' }}>{provider.lastFailureReason || '—'}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <button className="btn btn-outline" style={{ padding: '6px 10px', marginRight: '6px' }} onClick={() => postAction(`/${provider.providerKey}/${provider.enabled ? 'disable' : 'enable'}`, provider.enabled ? 'Provider disabled.' : 'Provider enabled.')}>
                        <Power size={13} /> {provider.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 12px' }}>
          <KeyRound size={16} /> Replace or Add Provider Key
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: '6px', color: 'var(--text-soft)', fontSize: '0.78rem', fontWeight: 700 }}>
            Provider
            <select value={form.providerKey} onChange={(e) => setForm({ ...form, providerKey: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }}>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '6px', color: 'var(--text-soft)', fontSize: '0.78rem', fontWeight: 700 }}>
            Label
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Primary production key" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }} />
          </label>
          <label style={{ display: 'grid', gap: '6px', color: 'var(--text-soft)', fontSize: '0.78rem', fontWeight: 700 }}>
            API Key
            <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="Paste key once" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-soft)', fontSize: '0.8rem', fontWeight: 700 }}>
            <input type="checkbox" checked={form.activate} onChange={(e) => setForm({ ...form, activate: e.target.checked })} />
            Activate immediately
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-soft)', fontSize: '0.8rem', fontWeight: 700 }}>
            <input type="checkbox" checked={form.testBeforeActivate} onChange={(e) => setForm({ ...form, testBeforeActivate: e.target.checked })} />
            Test before saving
          </label>
          <button className="btn btn-primary" onClick={saveKey} style={{ padding: '10px 14px' }}>
            <Plus size={14} /> Encrypt & Save
          </button>
        </div>
        {status && <p style={{ margin: '12px 0 0', color: status.includes('failed') || status.includes('Error') ? '#ef4444' : 'var(--gold)', fontWeight: 700 }}>{status}</p>}
      </section>

      <section className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Managed Key Metadata
        </h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {(data?.providers || []).flatMap((provider: any) => provider.keys || []).map((key: any) => (
            <div key={key.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '10px', alignItems: 'center', padding: '10px', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--bg)' }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>{key.label}</strong>
                <span style={{ display: 'block', color: 'var(--text-soft)', fontSize: '0.74rem' }}>{key.providerKey} • {key.createdBy || 'admin'}</span>
              </div>
              <span style={{ fontFamily: 'monospace', color: 'var(--gold)' }}>{key.fingerprint || 'no fingerprint'}</span>
              <span style={{ color: statusColor(key.status), fontWeight: 800 }}>{key.isActive ? 'active' : key.status}</span>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" style={{ padding: '6px 9px' }} onClick={() => postAction(`/keys/${key.id}/test`, 'Key tested.')}>
                  <CheckCircle2 size={13} /> Test
                </button>
                {!key.isActive && (
                  <button className="btn btn-outline" style={{ padding: '6px 9px' }} onClick={() => postAction(`/keys/${key.id}/activate`, 'Key activated without restart.')}>
                    Activate
                  </button>
                )}
                <button className="btn btn-outline" style={{ padding: '6px 9px' }} onClick={() => postAction(`/keys/${key.id}/disable`, 'Key disabled.')}>
                  Disable
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 12px' }}>
          Founder Portal Alerts
        </h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {(data?.alerts || []).slice(0, 8).map((alert: any) => (
            <div key={alert.id} style={{ padding: '10px', border: '1px solid var(--line)', borderRadius: '8px', background: alert.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'var(--bg)' }}>
              <strong style={{ color: alert.severity === 'critical' ? '#ef4444' : 'var(--text)' }}>{alert.title}</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--text-soft)', fontSize: '0.78rem' }}>{alert.message}</p>
            </div>
          ))}
          {!(data?.alerts || []).length && <p style={{ color: 'var(--text-soft)' }}>No provider alerts yet.</p>}
        </div>
      </section>
    </div>
  )
}

// 3.b. Token & Cache Analytics View
function TokenAndCacheAnalyticsView() {
  const [data, setData] = React.useState<any>(null)
  const [cacheData, setCacheData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const fetchAnalytics = async () => {
    setLoading(true)
    setError('')
    try {
      const [tokenRes, cacheRes] = await Promise.all([
        fetch(`${API_BASE_URL}/chat/token-analytics`, {
          headers: await adminAuthHeaders()
        }),
        fetch(`${API_BASE_URL}/chat/cache-analytics`, {
          headers: await adminAuthHeaders()
        })
      ])

      if (!tokenRes.ok) throw new Error(`Token Analytics: HTTP ${tokenRes.status}`)
      if (!cacheRes.ok) throw new Error(`Cache Analytics: HTTP ${cacheRes.status}`)

      const tokenData = await tokenRes.json()
      const cache = await cacheRes.json()
      setData(tokenData)
      setCacheData(cache)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch token & cache analytics.')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchAnalytics()
  }, [])

  const summaryStats = React.useMemo(() => {
    if (!data) return null;
    const modulesList = Object.keys(data);
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalRequests = 0;

    modulesList.forEach(m => {
      totalPrompt += data[m].totalPromptTokens;
      totalCompletion += data[m].totalCompletionTokens;
      totalRequests += data[m].totalRequests;
    });

    const totalTokens = totalPrompt + totalCompletion;
    const baseBudgets = { lexmentor: 800, research: 1000, judgment: 2000, notebook: 1200 };
    let totalBaseBudget = 0;
    modulesList.forEach(m => {
      totalBaseBudget += data[m].totalRequests * (baseBudgets[m as keyof typeof baseBudgets] || 1000);
    });
    const savedTokens = Math.max(0, totalBaseBudget - totalCompletion);
    const savingsPercentage = totalBaseBudget > 0 ? Math.round((savedTokens / totalBaseBudget) * 100) : 0;

    return {
      totalRequests,
      totalPrompt,
      totalCompletion,
      totalTokens,
      savingsPercentage: savingsPercentage || 0
    };
  }, [data]);

  const chartData = React.useMemo(() => {
    if (!data) return [];
    return [
      { name: 'LexMentor', prompt: data.lexmentor?.totalPromptTokens || 0, completion: data.lexmentor?.totalCompletionTokens || 0 },
      { name: 'Legal Research', prompt: data.research?.totalPromptTokens || 0, completion: data.research?.totalCompletionTokens || 0 },
      { name: 'Memorial Gen', prompt: data.judgment?.totalPromptTokens || 0, completion: data.judgment?.totalCompletionTokens || 0 },
      { name: 'LexNotebook', prompt: data.notebook?.totalPromptTokens || 0, completion: data.notebook?.totalCompletionTokens || 0 },
    ];
  }, [data]);

  const distributionData = React.useMemo(() => {
    if (!data) return [];
    const colors = ['var(--gold)', '#38bdf8', '#c084fc', '#42c98f'];
    return [
      { name: 'LexMentor', value: data.lexmentor?.totalCompletionTokens || 0, color: colors[0] },
      { name: 'Legal Research', value: data.research?.totalCompletionTokens || 0, color: colors[1] },
      { name: 'Memorial Gen', value: data.judgment?.totalCompletionTokens || 0, color: colors[2] },
      { name: 'LexNotebook', value: data.notebook?.totalCompletionTokens || 0, color: colors[3] },
    ].filter(item => item.value > 0);
  }, [data]);

  const cacheHitRate = React.useMemo(() => {
    if (!cacheData) return 0;
    const total = (cacheData.hits || 0) + (cacheData.misses || 0);
    return total > 0 ? Math.round((cacheData.hits / total) * 100) : 0;
  }, [cacheData]);

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' }}>
            <Cpu size={16} /> Token &amp; Redis Semantic Cache Telemetry
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Real-time telemetry showing LLM token usage patterns, exact hash cache rate, semantic similarities, and saved costs.</p>
        </div>
        <button
          onClick={fetchAnalytics}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            color: 'var(--text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem'
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin-animation' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>Loading analytics...</span>
        </div>
      ) : error ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: '#ff6b6b' }}>
          <span style={{ fontSize: '0.84rem' }}>{error}</span>
        </div>
      ) : (
        <>
          {/* Summary Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>Total Token Volume</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: 'var(--text)', marginTop: '4px' }}>
                {summaryStats?.totalTokens.toLocaleString() || 0}
              </strong>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-soft)', display: 'block', marginTop: '2px' }}>
                Prompt: {summaryStats?.totalPrompt.toLocaleString()} | Completion: {summaryStats?.totalCompletion.toLocaleString()}
              </span>
            </div>
            <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>Cache Hit Rate</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: 'var(--ok)', marginTop: '4px' }}>
                {cacheHitRate}%
              </strong>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-soft)', display: 'block', marginTop: '2px' }}>
                Hits: {cacheData?.hits || 0} | Misses: {cacheData?.misses || 0}
              </span>
            </div>
            <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>Saved AI Cost</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: 'var(--gold)', marginTop: '4px' }}>
                ${cacheData?.estimatedCostSaved ? cacheData.estimatedCostSaved.toFixed(4) : '0.0000'}
              </strong>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-soft)', display: 'block', marginTop: '2px' }}>
                Avoided direct API billing cost
              </span>
            </div>
            <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>API Calls Saved</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: '#c084fc', marginTop: '4px' }}>
                {cacheData?.apiCallsSaved || 0}
              </strong>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-soft)', display: 'block', marginTop: '2px' }}>
                Requests solved by Redis Cache
              </span>
            </div>
          </div>

          {/* Visual Pipeline Flow Chart */}
          <div className="glass-card" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '0.86rem', fontWeight: '800', color: '#fff', textTransform: 'uppercase', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} color="var(--gold)" /> Centralized Pipeline Request Flow Telemetry
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '0 0 20px 0' }}>
              Real-time routing flowchart demonstrating exact hashing checks, vector similarity cache, and sequential multi-model LLM fallback stages.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', position: 'relative' }}>
              <div style={{ padding: '12px', borderLeft: '3px solid #10b981', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff' }}>1. Exact Cache Check</span>
                  <span style={{ background: '#10b981', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {cacheData?.pipeline?.exactHits || 0} Hits
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>O(1) SHA-256 exact matching on Redis database.</p>
              </div>

              <div style={{ padding: '12px', borderLeft: '3px solid #06b6d4', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff' }}>2. Semantic Cache Check</span>
                  <span style={{ background: '#06b6d4', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {cacheData?.pipeline?.semanticHits || 0} Hits
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Cosine similarity check on Redis vector list (threshold &gt;= 0.85).</p>
              </div>

              <div style={{ padding: '12px', borderLeft: '3px solid #3b82f6', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff' }}>3. Qdrant Context Ingestion</span>
                  <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {cacheData?.pipeline?.qdrantHits || 0} Hits
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Local RAG source citations mapping and document vector embedding.</p>
              </div>

              <div style={{ padding: '12px', borderLeft: '3px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff' }}>4. L1: Gemini 2.5 Flash</span>
                  <span style={{ background: '#8b5cf6', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {cacheData?.pipeline?.geminiHits || 0} Resolves
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Primary fallback layer. High speed, cost-effective reasoning engine.</p>
              </div>

              <div style={{ padding: '12px', borderLeft: '3px solid #ec4899', background: 'rgba(236, 72, 153, 0.05)', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff' }}>5. L2: GPT-4o Mini</span>
                  <span style={{ background: '#ec4899', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {cacheData?.pipeline?.gptHits || 0} Resolves
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Secondary fallback layer. High instruction-following standard engine.</p>
              </div>

              <div style={{ padding: '12px', borderLeft: '3px solid #f97316', background: 'rgba(249, 115, 22, 0.05)', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff' }}>6. L3: DeepSeek R1</span>
                  <span style={{ background: '#f97316', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {cacheData?.pipeline?.deepseekHits || 0} Resolves
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Tertiary fallback layer. Expensive, logic-dense model for expert analysis.</p>
              </div>

              <div style={{ padding: '12px', borderLeft: '3px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid var(--line)', borderLeftWidth: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff' }}>7. L6: Friendly Fallback</span>
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {cacheData?.pipeline?.friendlyHits || 0} Triggers
                  </span>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Final resilience tier. Clean error masking and local markdown summaries.</p>
              </div>
            </div>
          </div>

          {/* Charts and distributions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px', flexWrap: 'wrap' }}>
            <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '0.86rem', fontWeight: '800', color: '#fff', textTransform: 'uppercase', margin: '0 0 14px 0' }}>
                Prompt vs Completion Tokens by Module
              </h4>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.3} />
                    <XAxis dataKey="name" stroke="var(--text-soft)" style={{ fontSize: '0.72rem' }} />
                    <YAxis stroke="var(--text-soft)" style={{ fontSize: '0.72rem' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.78rem' }} />
                    <Legend style={{ fontSize: '0.78rem' }} />
                    <Bar dataKey="prompt" name="Prompt Tokens" fill="var(--gold-soft)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completion" name="Completion Tokens" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '0.86rem', fontWeight: '800', color: '#fff', textTransform: 'uppercase', margin: '0 0 14px 0' }}>
                Completion Token Distribution
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '100%', height: '180px' }}>
                  {distributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={distributionData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value">
                          {distributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                      No data recorded yet
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {distributionData.map((p) => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
                      <span>{p.name}: <strong style={{ color: 'var(--text)' }}>{Math.round((p.value / (summaryStats?.totalCompletion || 1)) * 100)}%</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Module diagnostics table */}
          <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '0.86rem', fontWeight: '800', color: '#fff', textTransform: 'uppercase', margin: '0 0 12px 0' }}>
              Detailed Module Diagnostics
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '8px 10px' }}>Module</th>
                    <th style={{ padding: '8px 10px' }}>Total Requests</th>
                    <th style={{ padding: '8px 10px' }}>Prompt Tokens</th>
                    <th style={{ padding: '8px 10px' }}>Completion Tokens</th>
                    <th style={{ padding: '8px 10px' }}>Avg Tokens / Req</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Telemetry Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'LexMentor (Chat)', key: 'lexmentor' },
                    { name: 'Legal Research', key: 'research' },
                    { name: 'Memorial Gen (Judgment)', key: 'judgment' },
                    { name: 'LexNotebook (Study Forge)', key: 'notebook' }
                  ].map(m => {
                    const stats = data[m.key] || { totalRequests: 0, totalPromptTokens: 0, totalCompletionTokens: 0, averageCompletionTokens: 0 };
                    return (
                      <tr key={m.key} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text)' }}>{m.name}</td>
                        <td style={{ padding: '10px' }}>{stats.totalRequests.toLocaleString()}</td>
                        <td style={{ padding: '10px' }}>{stats.totalPromptTokens.toLocaleString()}</td>
                        <td style={{ padding: '10px' }}>{stats.totalCompletionTokens.toLocaleString()}</td>
                        <td style={{ padding: '10px', color: 'var(--gold)', fontWeight: '700' }}>
                          {stats.averageCompletionTokens ? stats.averageCompletionTokens.toLocaleString() : 0}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--ok)', background: 'rgba(15,138,87,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// 4. Research Intelligence View
function ResearchIntelligenceView() {
  const topCases = [
    { name: 'Kesavananda Bharati v. State of Kerala (1973)', count: '14,240 lookups' },
    { name: 'Maneka Gandhi v. Union of India (1978)', count: '9,810 lookups' },
    { name: 'Minerva Mills v. Union of India (1980)', count: '6,490 lookups' },
    { name: 'Reg. v. Govinda (1876) ILR 1 Bom 342', count: '4,890 lookups' }
  ]

  const modesBreakdown = [
    { mode: 'Academic Mode', count: '42%', color: 'var(--gold)' },
    { mode: 'Moot Court Mode', count: '28%', color: '#38bdf8' },
    { mode: 'Judiciary Mode', count: '18%', color: '#42c98f' },
    { mode: 'Lawyer Mode', count: '12%', color: '#a2ffd6' }
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }} className="reveal-up">
      {/* Top Cases */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
          Top Precedents &amp; Cases Accessed
        </h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          {topCases.map((c, i) => (
            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: '600' }}>{i + 1}. {c.name}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700' }}>{c.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modes Breakdown */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
          Popular Research Modes
        </h3>
        <div style={{ display: 'grid', gap: '12px' }}>
          {modesBreakdown.map((m) => (
            <div key={m.mode}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                <span>{m.mode}</span>
                <strong style={{ color: m.color }}>{m.count}</strong>
              </div>
              <div className="progress-track" style={{ height: '6px', background: 'var(--bg)' }}>
                <div style={{ width: m.count, height: '100%', background: m.color, borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 5. Users View
// 5. Users View
function UsersView() {
  const [usersList, setUsersList] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filterText, setFilterText] = React.useState('')
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [newAdminId, setNewAdminId] = React.useState('')
  const [newAdminEmail, setNewAdminEmail] = React.useState('')
  const [newAdminRole, setNewAdminRole] = React.useState('Admin')
  const [newAdminName, setNewAdminName] = React.useState('')

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('joined_date', { ascending: false })
    if (!error && data) {
      setUsersList(data)
    }
    setLoading(false)
  }

  React.useEffect(() => {
    fetchUsers()

    // Realtime Postgres changes subscription
    const channel = supabase
      .channel('realtime_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdminId || !newAdminEmail || !newAdminName) return

    const { error } = await supabase.from('users').insert({
      clerk_user_id: newAdminId,
      full_name: newAdminName,
      email: newAdminEmail,
      role: newAdminRole,
      account_status: 'active',
      joined_date: new Date().toISOString()
    })

    if (!error) {
      setIsModalOpen(false)
      // Notify founder immediately
      await notifyFounderSecurity('NEW_ADMIN_CREATED', {
        newAdminId,
        newAdminEmail,
        newAdminRole,
        createdByName: 'founder-admin@legatrixon.local'
      })
      // Reset fields
      setNewAdminId('')
      setNewAdminEmail('')
      setNewAdminName('')
      setNewAdminRole('Admin')
    } else {
      alert('Error creating admin: ' + error.message)
    }
  }

  const handleRoleChange = async (email: string, oldRole: string, newRole: string) => {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('email', email)

    if (!error) {
      await notifyFounderSecurity('ROLE_CHANGED', {
        affectedUser: email,
        oldRole,
        newRole,
        changedBy: 'founder-admin@legatrixon.local'
      })
    }
  }

  const handleToggleLock = async (email: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended'
    const { error } = await supabase
      .from('users')
      .update({ account_status: nextStatus })
      .eq('email', email)

    if (!error) {
      if (nextStatus === 'suspended') {
        await notifyFounderSecurity('ACCOUNT_LOCKED', {
          affectedUser: email,
          locked: true,
          reason: 'Administrative manual lock action',
          triggeredBy: 'founder-admin@legatrixon.local'
        })
      } else {
        await notifyFounderSecurity('ROLE_CHANGED', {
          reason: `Account unlocked for user ${email}`,
          affectedUser: email,
          triggeredBy: 'founder-admin@legatrixon.local'
        })
      }
    }
  }

  const filteredUsers = usersList.filter(
    u =>
      (u.full_name || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(filterText.toLowerCase())
  )

  return (
    <div className="glass-card reveal-up" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
          User Directory &amp; Usage Diagnostics
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px', padding: '4px 8px', width: '180px' }}>
            <Search size={12} style={{ color: 'var(--text-soft)' }} />
            <input
              type="text"
              placeholder="Filter users..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '0.78rem', outline: 'none', width: '100%' }}
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}
          >
            <Plus size={14} /> Create Admin
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>Loading users...</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                <th style={{ padding: '8px 10px' }}>Name</th>
                <th style={{ padding: '8px 10px' }}>Email</th>
                <th style={{ padding: '8px 10px' }}>Phone Number</th>
                <th style={{ padding: '8px 10px' }}>University</th>
                <th style={{ padding: '8px 10px' }}>Semester</th>
                <th style={{ padding: '8px 10px' }}>Join Date</th>
                <th style={{ padding: '8px 10px' }}>Last Login</th>
                <th style={{ padding: '8px 10px' }}>Role</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.email} style={{ borderBottom: '1px solid var(--line)', background: u.account_status === 'suspended' ? 'rgba(216, 56, 56, 0.03)' : 'transparent' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
                        {renderAvatar(u.avatar_url || 'law_student_male', undefined, undefined, '100%')}
                      </div>
                      <strong style={{ color: 'var(--text)' }}>{u.full_name || 'N/A'}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '10px' }}>{u.email || 'N/A'}</td>
                  <td style={{ padding: '10px' }}>{u.phone_number || 'N/A'}</td>
                  <td style={{ padding: '10px' }}>
                    <strong style={{ color: 'var(--text)', display: 'block' }}>{u.university_name || 'N/A'}</strong>
                  </td>
                  <td style={{ padding: '10px' }}>{u.semester_year || 'N/A'}</td>
                  <td style={{ padding: '10px' }}>
                    {u.joined_date ? new Date(u.joined_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.email, u.role, e.target.value)}
                      style={{
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        border: '1px solid var(--line)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.78rem',
                        outline: 'none'
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="lawyer">Lawyer</option>
                      <option value="researcher">Researcher</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      color: u.account_status === 'suspended' ? '#ff6b6b' : 'var(--ok)',
                      background: u.account_status === 'suspended' ? 'rgba(216, 56, 56, 0.08)' : 'rgba(15, 138, 87, 0.08)',
                      border: `1px solid ${u.account_status === 'suspended' ? '#ff6b6b' : 'var(--ok)'}`
                    }}>
                      {u.account_status === 'suspended' ? 'LOCKED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleLock(u.email, u.account_status)}
                      style={{
                        background: u.account_status === 'suspended' ? 'rgba(15, 138, 87, 0.1)' : 'rgba(216, 56, 56, 0.1)',
                        color: u.account_status === 'suspended' ? 'var(--ok)' : '#ff6b6b',
                        border: `1px solid ${u.account_status === 'suspended' ? 'var(--ok)' : '#ff6b6b'}`,
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: '180ms ease'
                      }}
                    >
                      {u.account_status === 'suspended' ? 'Unlock' : 'Lock Account'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create New Admin Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setIsModalOpen(false)}>
          <form
            onSubmit={handleCreateAdmin}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--panel-strong)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: 'var(--shadow)',
              display: 'grid',
              gap: '16px'
            }}
            onClick={ev => ev.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', margin: 0 }}>
                Create New Admin Account
              </h4>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontWeight: '800', fontSize: '1.4rem', lineHeight: '1' }}
                onClick={() => setIsModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
              Admin ID
              <input
                type="text"
                required
                value={newAdminId}
                onChange={e => setNewAdminId(e.target.value)}
                placeholder="e.g. LEGATRIXON25"
                style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', outline: 'none' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
              Full Name
              <input
                type="text"
                required
                value={newAdminName}
                onChange={e => setNewAdminName(e.target.value)}
                placeholder="e.g. Vikramaditya Singh"
                style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', outline: 'none' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
              Email Address
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={e => setNewAdminEmail(e.target.value)}
                placeholder="e.g. admin.vikram@legatrixon.com"
                style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', outline: 'none' }}
              />
            </label>

            <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
              Role Selection
              <select
                value={newAdminRole}
                onChange={e => setNewAdminRole(e.target.value)}
                style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', outline: 'none' }}
              >
                <option value="admin">Administrator</option>
                <option value="super_admin">Super Administrator</option>
              </select>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontWeight: '800', marginTop: '10px', justifyContent: 'center' }}
            >
              Generate &amp; Authorize Admin
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// 5b. Calendar Monitor View
function CalendarMonitorView() {
  const [events, setEvents] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [timeFilter, setTimeFilter] = React.useState<'all' | 'today' | 'week' | 'month'>('all')
  const [userFilter, setUserFilter] = React.useState<string>('all')
  const [usersList, setUsersList] = React.useState<any[]>([])

  const fetchCalendarMonitor = async () => {
    setLoading(true)
    const { data: eventsData, error: err1 } = await supabase
      .from('calendar_events')
      .select('*')
      .order('event_date', { ascending: false })
      .order('event_time', { ascending: false })

    const { data: usersData, error: err2 } = await supabase
      .from('users')
      .select('*')

    if (!err1 && eventsData) {
      setEvents(eventsData)
    }
    if (!err2 && usersData) {
      setUsersList(usersData)
    }
    setLoading(false)
  }

  React.useEffect(() => {
    fetchCalendarMonitor()
    
    const channel = supabase
      .channel('realtime_calendar_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        fetchCalendarMonitor()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Filtering Logic
  const filteredEvents = events.filter((evt) => {
    // 1. User Filter
    if (userFilter !== 'all' && evt.clerk_user_id !== userFilter) {
      return false
    }

    // 2. Date Filter
    if (timeFilter !== 'all') {
      const eventDate = new Date(evt.event_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      eventDate.setHours(0, 0, 0, 0)

      if (timeFilter === 'today') {
        if (eventDate.getTime() !== today.getTime()) return false
      } else if (timeFilter === 'week') {
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        const oneWeekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        if (eventDate < oneWeekAgo || eventDate > oneWeekAhead) return false
      } else if (timeFilter === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        if (eventDate < startOfMonth || eventDate > endOfMonth) return false
      }
    }

    return true
  })

  return (
    <div className="glass-card reveal-up" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
          Admin Calendar Monitor
        </h3>
        
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              outline: 'none',
              maxWidth: '200px'
            }}
          >
            <option value="all">All Users</option>
            {usersList.map((u) => (
              <option key={u.clerk_user_id} value={u.clerk_user_id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>Loading events...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>No calendar events found matching the filters.</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                <th style={{ padding: '8px 10px' }}>User Name</th>
                <th style={{ padding: '8px 10px' }}>Event Title</th>
                <th style={{ padding: '8px 10px' }}>Event Date</th>
                <th style={{ padding: '8px 10px' }}>Event Time</th>
                <th style={{ padding: '8px 10px' }}>Creation Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt) => {
                const userObj = usersList.find((u) => u.clerk_user_id === evt.clerk_user_id)
                const userName = evt.created_by || userObj?.full_name || 'Anonymous Student'
                return (
                  <tr key={evt.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px' }}>
                      <strong style={{ color: 'var(--text)' }}>{userName}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block' }}>{userObj?.email || ''}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'var(--bg-elev)',
                        marginRight: '6px',
                        border: '1px solid var(--line)'
                      }}>
                        {evt.event_type?.toUpperCase()}
                      </span>
                      {evt.title}
                    </td>
                    <td style={{ padding: '10px' }}>{evt.event_date}</td>
                    <td style={{ padding: '10px' }}>{evt.event_time}</td>
                    <td style={{ padding: '10px', color: 'var(--text-soft)' }}>
                      {evt.event_created_at ? new Date(evt.event_created_at).toLocaleString() : new Date(evt.created_at).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// 6. Subscriptions View
function SubscriptionsView() {
  const dataPlans = [
    { name: 'Scholar', value: 450, color: 'var(--gold)' },
    { name: 'Professional', value: 280, color: '#38bdf8' },
    { name: 'Institution', value: 45, color: '#42c98f' }
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="reveal-up">
      {/* Active Plans distribution */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
          Active Subscriptions Distribution
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', alignItems: 'center' }}>
          <div style={{ width: '100%', height: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataPlans} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value">
                  {dataPlans.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {dataPlans.map((p) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />
                <span>{p.name}: <strong>{p.value} accounts</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subscription Growth Stats */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
          Monthly Recurring Revenue (MRR)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', display: 'block' }}>Current ARR</span>
            <strong style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text)' }}>₹4.2M</strong>
          </div>
          <div className="progress-track" style={{ height: '8px', background: 'var(--bg)', marginTop: '8px' }}>
            <div style={{ width: '78%', height: '100%', background: 'linear-gradient(90deg, #8f6412 0%, var(--gold) 100%)', borderRadius: '8px' }} />
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700' }}>
            <TrendingUp size={13} /> +14.8% growth vs last fiscal quarter
          </span>
        </div>
      </div>
    </div>
  )
}

// 7. Analytics View
function AnalyticsView() {
  const [activities, setActivities] = React.useState<any[]>([])
  const [logins, setLogins] = React.useState<any[]>([])
  const [exportsList, setExportsList] = React.useState<any[]>([])
  const [usersList, setUsersList] = React.useState<any[]>([])
  const [filterSegment, setFilterSegment] = React.useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly')
  const [activeLogsSubTab, setActiveLogsSubTab] = React.useState<'Activities' | 'Logins' | 'Exports'>('Activities')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [platformMetrics, setPlatformMetrics] = React.useState<{
    usersCount: number
    eventsCount: number
    internshipsCount: number
    researchCount: number
    mootActivitiesCount: number
    flashcardsCount: number
    studyHoursCount: number
    notificationsCount: number
  } | null>(null)

  const fetchAnalytics = async () => {
    setLoading(true)
    setError('')
    try {
      const [
        { data: activityData, error: actErr },
        { data: loginData, error: logErr },
        { data: exportData, error: expErr },
        { data: userData, error: usrErr },
        metricsRes
      ] = await Promise.all([
        supabase.from('user_activity_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('user_login_logs').select('*').order('login_time', { ascending: false }),
        supabase.from('exports').select('*').order('downloaded_at', { ascending: false }),
        supabase.from('users').select('*'),
        fetch(`${API_BASE_URL}/founder-security/admin-analytics`, {
          headers: await adminAuthHeaders()
        }).catch(err => {
          console.error('Failed to fetch platform metrics:', err)
          return null
        })
      ])

      if (actErr) throw actErr
      if (logErr) throw logErr
      if (expErr) throw expErr
      if (usrErr) throw usrErr

      setActivities(activityData || [])
      setLogins(loginData || [])
      setExportsList(exportData || [])
      setUsersList(userData || [])

      if (metricsRes && metricsRes.ok) {
        const metricsData = await metricsRes.json()
        setPlatformMetrics(metricsData)
      }
    } catch (err: any) {
      console.error('Error loading analytics:', err)
      setError(err.message || 'Failed to load analytics records.')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchAnalytics()
  }, [])

  const getFilteredItems = React.useCallback(<T extends { created_at?: string; login_time?: string; downloaded_at?: string }>(items: T[]): T[] => {
    const now = new Date()
    let limitMs = 7 * 24 * 60 * 60 * 1000 // default weekly
    if (filterSegment === 'Daily') {
      limitMs = 24 * 60 * 60 * 1000
    } else if (filterSegment === 'Monthly') {
      limitMs = 30 * 24 * 60 * 60 * 1000
    }

    return items.filter(item => {
      const dateStr = item.created_at || item.login_time || item.downloaded_at
      if (!dateStr) return false
      const itemDate = new Date(dateStr)
      return (now.getTime() - itemDate.getTime()) <= limitMs
    })
  }, [filterSegment])

  const chartData = React.useMemo(() => {
    const countsByDay: Record<string, { date: string; activities: number; logins: number; exports: number }> = {}

    // Initialize dates in the selected range to ensure we show days with zero activity
    const now = new Date()
    let daysToInclude = 7
    if (filterSegment === 'Daily') daysToInclude = 1
    else if (filterSegment === 'Monthly') daysToInclude = 30

    for (let i = daysToInclude - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(5, 10) // 'MM-DD'
      countsByDay[key] = { date: key, activities: 0, logins: 0, exports: 0 }
    }

    const filteredAct = getFilteredItems(activities)
    const filteredLog = getFilteredItems(logins)
    const filteredExp = getFilteredItems(exportsList)

    filteredAct.forEach(item => {
      const key = new Date(item.created_at).toISOString().slice(5, 10)
      if (countsByDay[key]) countsByDay[key].activities++
    })
    filteredLog.forEach(item => {
      const key = new Date(item.login_time).toISOString().slice(5, 10)
      if (countsByDay[key]) countsByDay[key].logins++
    })
    filteredExp.forEach(item => {
      const key = new Date(item.downloaded_at).toISOString().slice(5, 10)
      if (countsByDay[key]) countsByDay[key].exports++
    })

    return Object.values(countsByDay)
  }, [activities, logins, exportsList, getFilteredItems, filterSegment])

  const getUserLabel = (userId: string) => {
    const u = usersList.find(user => user.clerk_user_id === userId || user.id === userId)
    if (u) {
      return `${u.full_name || 'Anonymous'} (${u.email})`
    }
    return userId || 'System / Guest'
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Header Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} /> LIVE PLATFORM ANALYTICS MIRROR
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '4px 0 0 0' }}>Monitor live activity, downloads, logins, and feature usage across all student profiles.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(['Daily', 'Weekly', 'Monthly'] as const).map(seg => (
            <button
              key={seg}
              onClick={() => setFilterSegment(seg)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: filterSegment === seg ? '1px solid var(--gold)' : '1px solid var(--line)',
                background: filterSegment === seg ? 'rgba(245, 193, 79, 0.12)' : 'var(--panel)',
                color: filterSegment === seg ? 'var(--gold)' : 'var(--text-soft)',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {seg}
            </button>
          ))}
          <button
            onClick={fetchAnalytics}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              background: 'var(--panel)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Refresh logs"
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Supabase Platform Intelligence Panel */}
      <div className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        <h4 style={{ fontSize: '0.86rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} /> SUPABASE PLATFORM INTELLIGENCE (FOUNDER ONLY)
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {/* Card 1: Users Registered */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 193, 79, 0.1)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UsersIcon size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Users Registered</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.usersCount : '...'}
              </strong>
            </div>
          </div>

          {/* Card 2: Events Created */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Events Created</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.eventsCount : '...'}
              </strong>
            </div>
          </div>

          {/* Card 3: Internships Saved */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Internships Saved</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.internshipsCount : '...'}
              </strong>
            </div>
          </div>

          {/* Card 4: Research Sessions */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(192, 132, 252, 0.1)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Research Sessions</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.researchCount : '...'}
              </strong>
            </div>
          </div>

          {/* Card 5: Moot Activities */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Moot Activities</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.mootActivitiesCount : '...'}
              </strong>
            </div>
          </div>

          {/* Card 6: Flashcards Reviewed */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Flashcards Reviewed</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.flashcardsCount : '...'}
              </strong>
            </div>
          </div>

          {/* Card 7: Study Hours */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(20, 184, 166, 0.1)', color: '#14b8a6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Study Hours</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.studyHoursCount.toFixed(1) : '...'}
              </strong>
            </div>
          </div>

          {/* Card 8: Notifications Generated */}
          <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'block', textTransform: 'uppercase', fontWeight: '700' }}>Notifications Generated</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--text)' }}>
                {platformMetrics ? platformMetrics.notificationsCount : '...'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="glass-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>Logged Actions</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', color: 'var(--gold)', marginTop: '4px' }}>
            {getFilteredItems(activities).length}
          </strong>
        </div>
        <div className="glass-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>Active Users</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', color: '#38bdf8', marginTop: '4px' }}>
            {new Set(getFilteredItems(activities).map(a => a.user_id)).size}
          </strong>
        </div>
        <div className="glass-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>Login Sessions</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', color: 'var(--ok)', marginTop: '4px' }}>
            {getFilteredItems(logins).length}
          </strong>
        </div>
        <div className="glass-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>File Exports</span>
          <strong style={{ display: 'block', fontSize: '1.4rem', color: '#c084fc', marginTop: '4px' }}>
            {getFilteredItems(exportsList).length}
          </strong>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        <h4 style={{ fontSize: '0.86rem', fontWeight: '800', color: '#fff', textTransform: 'uppercase', margin: '0 0 14px 0' }}>
          Daily Traffic Flow Overview
        </h4>
        <div style={{ width: '100%', height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.3} />
              <XAxis dataKey="date" stroke="var(--text-soft)" style={{ fontSize: '0.72rem' }} />
              <YAxis stroke="var(--text-soft)" style={{ fontSize: '0.72rem' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.78rem' }} />
              <Legend style={{ fontSize: '0.78rem' }} />
              <Line type="monotone" dataKey="activities" stroke="var(--gold)" name="Actions" strokeWidth={2} />
              <Line type="monotone" dataKey="logins" stroke="#38bdf8" name="Logins" strokeWidth={2} />
              <Line type="monotone" dataKey="exports" stroke="#c084fc" name="Exports" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid Sub-navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        {(['Activities', 'Logins', 'Exports'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveLogsSubTab(tab)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: activeLogsSubTab === tab ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: activeLogsSubTab === tab ? 'var(--gold)' : 'var(--text-soft)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {tab === 'Activities' && 'User Activity Logs'}
            {tab === 'Logins' && 'Login Sessions'}
            {tab === 'Exports' && 'Exports & Downloads'}
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        {loading ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', textAlign: 'center', margin: '20px 0' }}>Loading live mirrored registers...</p>
        ) : error ? (
          <p style={{ fontSize: '0.82rem', color: '#ff6b6b', textAlign: 'center', margin: '20px 0' }}>{error}</p>
        ) : (
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {activeLogsSubTab === 'Activities' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '8px 10px' }}>User</th>
                    <th style={{ padding: '8px 10px' }}>Module</th>
                    <th style={{ padding: '8px 10px' }}>Action Logged</th>
                    <th style={{ padding: '8px 10px' }}>Session ID</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredItems(activities).length > 0 ? (
                    getFilteredItems(activities).map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>{getUserLabel(item.user_id)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--gold)' }}>{item.module_name}</td>
                        <td style={{ padding: '8px 10px' }}>{item.action_type}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)', fontFamily: 'monospace' }}>{item.session_id || '—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-soft)' }}>
                          {new Date(item.created_at).toLocaleString('en-IN', { hour12: false })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No activities logged in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeLogsSubTab === 'Logins' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '8px 10px' }}>User</th>
                    <th style={{ padding: '8px 10px' }}>IP Address</th>
                    <th style={{ padding: '8px 10px' }}>Client Info</th>
                    <th style={{ padding: '8px 10px' }}>Login Time</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Logout Time</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredItems(logins).length > 0 ? (
                    getFilteredItems(logins).map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>{getUserLabel(item.clerk_user_id)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>{item.ip_address}</td>
                        <td style={{ padding: '8px 10px' }}>{item.browser} ({item.device} • {item.operating_system})</td>
                        <td style={{ padding: '8px 10px' }}>{new Date(item.login_time).toLocaleString('en-IN', { hour12: false })}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-soft)' }}>
                          {item.logout_time ? new Date(item.logout_time).toLocaleString('en-IN', { hour12: false }) : 'Active Session'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No login sessions in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeLogsSubTab === 'Exports' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '8px 10px' }}>User</th>
                    <th style={{ padding: '8px 10px' }}>Type</th>
                    <th style={{ padding: '8px 10px' }}>Format</th>
                    <th style={{ padding: '8px 10px' }}>File Name</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Downloaded At</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredItems(exportsList).length > 0 ? (
                    getFilteredItems(exportsList).map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>{getUserLabel(item.user_id)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--gold)' }}>{item.export_type}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--line)' }}>
                            {String(item.format).toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>{item.file_name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-soft)' }}>
                          {new Date(item.downloaded_at).toLocaleString('en-IN', { hour12: false })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No data exports recorded in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 8. System Monitoring View
function SystemMonitoringView() {
  const systems = [
    { name: 'PostgreSQL Database', stat: 'Healthy', load: '12% CPU', mem: '1.2 GB / 8 GB', indicator: 'green' },
    { name: 'Qdrant Vector DB', stat: 'Healthy', load: '4% CPU', mem: '4.8 GB / 16 GB', indicator: 'green' },
    { name: 'Supabase Storage', stat: 'Healthy', load: 'N/A', mem: '12 GB used', indicator: 'green' },
    { name: 'DeepSeek Inference Server', stat: 'Latency high', load: '84% GPU load', mem: '21 GB / 24 GB VRAM', indicator: 'yellow' },
    { name: 'BGE-M3 Embedder Sidecar', stat: 'Healthy', load: '14% CPU', mem: '1.4 GB / 8 GB', indicator: 'green' }
  ]

  return (
    <div className="glass-card reveal-up" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
        Infrastructure Health Monitoring (Server &amp; Services)
      </h3>
      <div style={{ display: 'grid', gap: '8px' }}>
        {systems.map((s) => (
          <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.indicator === 'green' ? 'var(--ok)' : '#ffa4a4', boxShadow: s.indicator === 'green' ? '0 0 6px var(--ok)' : '0 0 6px #ffa4a4' }} />
              <div>
                <strong style={{ color: 'var(--text)', fontSize: '0.88rem' }}>{s.name}</strong>
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', marginTop: '2px' }}>Operational load: {s.load} • Memory: {s.mem}</span>
              </div>
            </div>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: s.indicator === 'green' ? 'var(--ok)' : 'var(--gold)' }}>
              {s.stat}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 9. Audit Logs View
function AuditLogsView() {
  const [events, setEvents] = React.useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = React.useState<any>(null)
  const [status, setStatus] = React.useState('Loading security events...')

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/founder-security/events`, {
        headers: await adminAuthHeaders(),
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      setEvents(data)
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load security events.')
    }
  }

  React.useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glass-card reveal-up" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
        Security &amp; Operational Audit Registers
      </h3>
      {status && <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', margin: '0 0 10px 0' }}>{status}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
              <th style={{ padding: '8px 10px' }}>Timestamp</th>
              <th style={{ padding: '8px 10px' }}>Action Logged</th>
              <th style={{ padding: '8px 10px' }}>Operator / Email</th>
              <th style={{ padding: '8px 10px' }}>IP Address</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Delivery Status</th>
            </tr>
          </thead>
          <tbody>
            {events.length > 0 ? (
              events.map((e) => {
                let badgeColor = '#b9b4a8';
                let badgeBg = 'rgba(185, 180, 168, 0.08)';
                let badgeBorder = 'rgba(185, 180, 168, 0.2)';
                if (e.deliveryStatus === 'sent') {
                  badgeColor = 'var(--ok)';
                  badgeBg = 'rgba(15, 138, 87, 0.08)';
                  badgeBorder = 'rgba(15, 138, 87, 0.2)';
                } else if (e.deliveryStatus === 'failed') {
                  badgeColor = '#ff6b6b';
                  badgeBg = 'rgba(216, 56, 56, 0.08)';
                  badgeBorder = 'rgba(216, 56, 56, 0.2)';
                } else if (e.deliveryStatus === 'pending') {
                  badgeColor = '#f5c14f';
                  badgeBg = 'rgba(245, 193, 79, 0.08)';
                  badgeBorder = 'rgba(245, 193, 79, 0.2)';
                }

                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedEvent(e)}
                    style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', transition: '180ms ease' }}
                    className="audit-row"
                  >
                    <td style={{ padding: '10px', color: 'var(--text-soft)' }}>
                      {new Date(e.createdAt).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text)' }}>
                      {e.title}
                    </td>
                    <td style={{ padding: '10px' }}>{e.actorEmail || e.actorId || 'System'}</td>
                    <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{e.ipAddress || 'Internal'}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        color: badgeColor,
                        background: badgeBg,
                        border: `1px solid ${badgeBorder}`
                      }}>
                        {e.deliveryStatus.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>
                  No security events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedEvent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setSelectedEvent(null)}>
          <div style={{
            width: '100%',
            maxWidth: '640px',
            background: 'var(--panel-strong)',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow)',
            display: 'grid',
            gap: '16px'
          }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
                Security Event: {selectedEvent.title}
              </h4>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontWeight: '800', fontSize: '1.4rem', lineHeight: '1', padding: '0 4px' }}
                onClick={() => setSelectedEvent(null)}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 12px', fontSize: '0.84rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Event ID:</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{selectedEvent.id}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Event Type:</span>
              <span style={{ color: 'var(--gold)', fontWeight: '700' }}>{selectedEvent.eventType}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Timestamp:</span>
              <span>{new Date(selectedEvent.createdAt).toLocaleString()}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Actor / operator:</span>
              <span>{selectedEvent.actorEmail || selectedEvent.actorId || 'System'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>IP Address:</span>
              <span>{selectedEvent.ipAddress || 'Internal'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>User Agent:</span>
              <span style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>{selectedEvent.userAgent || 'N/A'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Recipients:</span>
              <span>{(selectedEvent.recipients || []).join(', ') || 'None'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Delivery Status:</span>
              <span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: selectedEvent.deliveryStatus === 'sent' ? 'var(--ok)' : selectedEvent.deliveryStatus === 'failed' ? '#ff6b6b' : '#f5c14f',
                  background: selectedEvent.deliveryStatus === 'sent' ? 'rgba(15, 138, 87, 0.08)' : selectedEvent.deliveryStatus === 'failed' ? 'rgba(216, 56, 56, 0.08)' : 'rgba(245, 193, 79, 0.08)',
                  border: `1px solid ${selectedEvent.deliveryStatus === 'sent' ? 'var(--ok)' : selectedEvent.deliveryStatus === 'failed' ? '#ff6b6b' : '#f5c14f'}`
                }}>
                  {selectedEvent.deliveryStatus.toUpperCase()}
                </span>
              </span>

              {selectedEvent.deliveryError && (
                <>
                  <span style={{ color: '#ff6b6b', fontWeight: '700' }}>Delivery Error:</span>
                  <span style={{ color: '#ff6b6b', fontSize: '0.78rem' }}>{selectedEvent.deliveryError}</span>
                </>
              )}
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>Message Content</strong>
              <p style={{ fontSize: '0.84rem', padding: '10px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--line)', margin: 0, color: 'var(--text)', lineHeight: '1.4' }}>
                {selectedEvent.message}
              </p>
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>Raw Metadata Payload</strong>
              <pre style={{ margin: 0, fontSize: '0.74rem', background: 'var(--bg)', border: '1px solid var(--line)', padding: '10px', borderRadius: '8px', overflowX: 'auto', fontFamily: 'monospace', maxHeight: '110px', color: 'var(--text-soft)' }}>
                {JSON.stringify(sanitizeSecurityMetadata(selectedEvent.metadata || {}), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 10. Settings View
function SettingsView() {
  return (
    <div className="glass-card reveal-up" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'grid', gap: '16px' }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '4px', margin: 0 }}>
        Administrative Global Controls
      </h3>
      <div style={{ display: 'grid', gap: '12px' }}>
        <label style={{ display: 'grid', gap: '6px', fontSize: '0.84rem' }}>
          DeepSeek API Authorization Token
          <input type="password" value="sk-••••••••••••••••••••••••" readOnly style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text-soft)', width: '350px', outline: 'none' }} />
        </label>

        <label style={{ display: 'grid', gap: '6px', fontSize: '0.84rem', marginTop: '4px' }}>
          Qdrant REST Endpoint URL
          <input type="text" value="http://localhost:6333" readOnly style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text-soft)', width: '350px', outline: 'none' }} />
        </label>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontWeight: '700' }}>Backup Database</button>
          <button className="btn btn-outline" style={{ padding: '8px 16px' }}>Restart Ingest Worker</button>
        </div>
      </div>
    </div>
  )
}

function FounderSecuritySettingsView() {
  const [subTab, setSubTab] = useState<'Founder Security' | 'User Feedback & Tickets'>('Founder Security')
  const [primaryEmail, setPrimaryEmail] = useState('legatrixon2026@gmail.com')
  const [backupEmails, setBackupEmails] = useState('')
  const [enabledAlerts, setEnabledAlerts] = useState<Record<FounderSecurityEventType, boolean>>(
    founderSecurityEvents.reduce((acc, eventType) => ({ ...acc, [eventType]: true }), {} as Record<FounderSecurityEventType, boolean>)
  )
  const [approvalWorkflows, setApprovalWorkflows] = useState({
    newAdminCreation: true,
    roleChanges: true,
    superAdminAccess: true,
    passwordChanges: true,
  })
  const [status, setStatus] = useState('')

  // User Feedback states
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [feedbacksLoading, setFeedbacksLoading] = useState(false)
  const [feedbacksError, setFeedbacksError] = useState('')

  const loadFeedbacks = async () => {
    setFeedbacksLoading(true)
    setFeedbacksError('')
    try {
      const response = await fetch(`${API_BASE_URL}/settings/feedback/admin`, {
        headers: await adminAuthHeaders(),
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      setFeedbacks(data)
    } catch (err) {
      setFeedbacksError(err instanceof Error ? err.message : 'Failed to load feedbacks')
    } finally {
      setFeedbacksLoading(false)
    }
  }

  useEffect(() => {
    if (subTab === 'User Feedback & Tickets') {
      loadFeedbacks()
    }
  }, [subTab])

  const handleStatusChange = async (feedbackId: string, nextStatus: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/feedback/${feedbackId}/status`, {
        method: 'PUT',
        headers: {
          ...(await adminAuthHeaders(true)),
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error(await response.text())
      setFeedbacks(prev => prev.map(item => item.id === feedbackId ? { ...item, status: nextStatus } : item))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  useEffect(() => {
    const loadFounderSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/founder-security/settings`, {
          headers: await adminAuthHeaders(),
        })
        if (!response.ok) throw new Error(await response.text())
        const settings = await response.json()
        setPrimaryEmail(settings.primaryEmail || 'legatrixon2026@gmail.com')
        setBackupEmails((settings.backupEmails || []).join(', '))
        setEnabledAlerts({
          ...founderSecurityEvents.reduce((acc, eventType) => ({ ...acc, [eventType]: true }), {} as Record<FounderSecurityEventType, boolean>),
          ...(settings.enabledAlerts || {}),
        })
        setApprovalWorkflows({
          newAdminCreation: true,
          roleChanges: true,
          superAdminAccess: true,
          passwordChanges: true,
          ...(settings.approvalWorkflows || {}),
        })
        setStatus('Founder security settings loaded.')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not load founder security settings.')
      }
    }
    loadFounderSettings()
  }, [])

  const saveFounderSettings = async () => {
    const backups = backupEmails.split(',').map((email) => email.trim()).filter(Boolean)
    const activeEmails = [primaryEmail.trim(), ...backups].filter(Boolean)
    if (activeEmails.length === 0) setPrimaryEmail('legatrixon2026@gmail.com')

    try {
      setStatus('Saving founder security settings...')
      const response = await fetch(`${API_BASE_URL}/founder-security/settings`, {
        method: 'PUT',
        headers: {
          ...(await adminAuthHeaders(true)),
        },
        body: JSON.stringify({
          primaryEmail: activeEmails[0] || 'legatrixon2026@gmail.com',
          backupEmails: backups,
          enabledAlerts,
          approvalWorkflows,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      const settings = await response.json()
      setPrimaryEmail(settings.primaryEmail || 'legatrixon2026@gmail.com')
      setBackupEmails((settings.backupEmails || []).join(', '))
      setStatus('Founder security settings saved. At least one active founder email is enforced.')
      await notifyFounderSecurity('ROLE_CHANGED', { reason: 'Founder security settings updated' })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Founder security settings could not be saved.')
    }
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      {/* Subtab selection */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        {(['Founder Security', 'User Feedback & Tickets'] as const).map((tab) => {
          const active = subTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setSubTab(tab)}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                border: `1px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                background: active ? 'rgba(245, 193, 79, 0.08)' : 'var(--panel)',
                color: active ? 'var(--gold)' : 'var(--text-soft)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {subTab === 'Founder Security' ? (
        <div className="glass-card" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'grid', gap: '16px' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
            Founder Security Settings
          </h3>
          <label style={{ display: 'grid', gap: '6px', fontSize: '0.84rem' }}>
            Primary Founder Notification Email
            <input type="email" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} placeholder="legatrixon2026@gmail.com" style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', width: '380px', outline: 'none' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>Fallback destination: legatrixon2026@gmail.com</span>
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '0.84rem' }}>
            Backup Notification Emails
            <input type="text" value={backupEmails} onChange={(e) => setBackupEmails(e.target.value)} placeholder="backup1@example.com, backup2@example.com" style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text)', width: '520px', outline: 'none' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: '8px' }}>
            {founderSecurityEvents.map((eventType) => (
              <label key={eventType} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--bg)', fontSize: '0.8rem' }}>
                <input
                  type="checkbox"
                  checked={enabledAlerts[eventType]}
                  onChange={(e) => setEnabledAlerts(prev => ({ ...prev, [eventType]: e.target.checked }))}
                />
                {founderEventLabels[eventType]}
              </label>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <strong style={{ fontSize: '0.84rem', color: 'var(--gold)' }}>Approval Workflows</strong>
            {Object.entries({
              newAdminCreation: 'Require approval for new admin creation',
              roleChanges: 'Require approval for role changes',
              superAdminAccess: 'Require approval for super admin access',
              passwordChanges: 'Require approval for password changes',
            }).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <input
                  type="checkbox"
                  checked={(approvalWorkflows as any)[key]}
                  onChange={(e) => setApprovalWorkflows(prev => ({ ...prev, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>

          {status && <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.78rem' }}>{status}</p>}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ padding: '8px 16px', fontWeight: '700' }} onClick={saveFounderSettings}>Save Founder Security Settings</button>
            <button className="btn btn-outline" style={{ padding: '8px 16px' }} onClick={() => notifyFounderSecurity('SUPER_ADMIN_ACCESS_ATTEMPT', { reason: 'Manual test notification from Founder Settings' })}>Send Test Security Event</button>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
                User Feedback &amp; Tickets
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '2px 0 0' }}>
                Review and update user-submitted feedback, ratings, feature requests, and bug reports.
              </p>
            </div>
            <button type="button" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={loadFeedbacks} disabled={feedbacksLoading}>
              <RefreshCw size={12} className={feedbacksLoading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {feedbacksError && (
            <p style={{ color: '#ff6b6b', fontSize: '0.8rem', margin: 0 }}>{feedbacksError}</p>
          )}

          {feedbacksLoading ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', margin: 0 }}>Loading tickets...</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '10px 8px' }}>User ID</th>
                    <th style={{ padding: '10px 8px' }}>Type</th>
                    <th style={{ padding: '10px 8px' }}>Details / Description</th>
                    <th style={{ padding: '10px 8px' }}>Rating</th>
                    <th style={{ padding: '10px 8px' }}>Priority</th>
                    <th style={{ padding: '10px 8px' }}>Votes</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks && feedbacks.length > 0 ? (
                    feedbacks.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: '0.74rem' }}>{item.userId?.substring(0, 12)}...</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                          {item.type === 'bug' && '🐛 Bug'}
                          {item.type === 'feature' && '💡 Feature'}
                          {item.type === 'rating' && '⭐ Rating'}
                          {item.type === 'ai_feedback' && '🤖 AI Feedback'}
                        </td>
                        <td style={{ padding: '10px 8px', maxWidth: '300px', wordBreak: 'break-word' }}>
                          {item.type === 'bug' && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--gold)', marginBottom: '2px' }}>
                              [{item.module}] {item.issueType}
                            </div>
                          )}
                          {item.title && <strong style={{ display: 'block', color: '#fff' }}>{item.title}</strong>}
                          <span>{item.description}</span>
                          {item.screenshotUrl && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: '2px' }}>
                              Screenshot: 📂 {item.screenshotUrl}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{item.rating ? `${item.rating} / 5` : '-'}</td>
                        <td style={{ padding: '10px 8px' }}>{item.priority || '-'}</td>
                        <td style={{ padding: '10px 8px' }}>{item.votes || 0}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            style={{
                              padding: '4px 6px',
                              borderRadius: '4px',
                              background: 'var(--bg)',
                              border: '1px solid var(--line)',
                              color: '#fff',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <option value="Submitted">Submitted</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Planned">Planned</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text-soft)' }}>
                        No user feedback or support tickets submitted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FounderSecurityLogsView() {
  const [events, setEvents] = React.useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = React.useState<any>(null)
  const [status, setStatus] = React.useState('Loading founder security logs...')
  const [testResult, setTestResult] = React.useState<any>(null)
  const [testing, setTesting] = React.useState(false)
  const [activeLogTab, setActiveLogTab] = React.useState<FounderSecurityLogTab>('Access Intelligence')

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/founder-security/events`, {
        headers: await adminAuthHeaders(),
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      setEvents(data)
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load founder security logs.')
    }
  }

  React.useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 5000)
    return () => clearInterval(interval)
  }, [])

  const triggerTestEmail = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch(`${API_ORIGIN}/api/security/test-email`, {
        method: 'POST',
      })
      const data = await response.json()
      setTestResult(data)
      fetchEvents()
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      })
    } finally {
      setTesting(false)
    }
  }

  const sentCount = events.filter((e) => e.deliveryStatus === 'sent').length
  const failedCount = events.filter((e) => e.deliveryStatus === 'failed').length
  const pendingCount = events.filter((e) => e.deliveryStatus === 'pending').length
  const accessEvents = events.filter((e) => adminAccessEventTypes.has(e.eventType))
  const accessSummary = {
    founderAttempts: events.filter((e) => e.eventType === 'ADMIN_LOGIN_ATTEMPT' && e.metadata?.role === 'Founder').length,
    ctoAttempts: events.filter((e) => e.eventType === 'ADMIN_LOGIN_ATTEMPT' && e.metadata?.role === 'CTO').length,
    developerAttempts: events.filter((e) => e.eventType === 'ADMIN_LOGIN_ATTEMPT' && e.metadata?.role === 'Developer').length,
    successfulVerifications: accessEvents.filter((e) => e.eventType === 'ADMIN_LOGIN_SUCCESS').length,
    failedVerifications: accessEvents.filter((e) => e.eventType === 'ADMIN_LOGIN_FAILED').length,
    lockedAccounts: accessEvents.filter((e) => e.eventType === 'ACCOUNT_LOCKED').length,
  }
  const summaryCards = [
    { label: 'Founder Access Attempts', value: accessSummary.founderAttempts, color: 'var(--gold)' },
    { label: 'CTO Access Attempts', value: accessSummary.ctoAttempts, color: 'var(--text)' },
    { label: 'Developer Access Attempts', value: accessSummary.developerAttempts, color: 'var(--text)' },
    { label: 'Successful Verifications', value: accessSummary.successfulVerifications, color: 'var(--ok)' },
    { label: 'Failed Verifications', value: accessSummary.failedVerifications, color: '#ff6b6b' },
    { label: 'Locked Accounts', value: accessSummary.lockedAccounts, color: 'var(--gold)' },
  ]

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      {/* Test Email Action Header */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
            Founder Security Diagnostic Console
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '2px 0 0' }}>
            Verify real-time SMTP dispatch and Gmail App Password authentication.
          </p>
        </div>
        <button
          onClick={triggerTestEmail}
          disabled={testing}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.84rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Activity size={14} className={testing ? 'spin' : ''} />
          {testing ? 'Sending Test Email...' : 'Trigger Test Email'}
        </button>
      </div>

      {testResult && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: testResult.success ? 'rgba(15, 138, 87, 0.08)' : 'rgba(216, 56, 56, 0.08)',
          border: `1px solid ${testResult.success ? 'var(--ok)' : '#ff6b6b'}`,
          fontSize: '0.82rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: testResult.success ? 'var(--ok)' : '#ff6b6b' }}>
            {testResult.success ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
            {testResult.message || (testResult.success ? 'Test email succeeded' : 'Test email failed')}
          </div>
          {testResult.error && (
            <div style={{ color: '#ff6b6b', fontSize: '0.76rem', fontFamily: 'monospace', wordBreak: 'break-all', padding: '6px', background: 'var(--bg)', borderRadius: '4px', border: '1px solid var(--line)' }}>
              Error Log: {testResult.error}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        {(['Access Intelligence', 'Notification Audit Log'] as FounderSecurityLogTab[]).map((tab) => {
          const active = activeLogTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveLogTab(tab)}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                border: `1px solid ${active ? 'var(--gold)' : 'var(--line)'}`,
                background: active ? 'var(--gold-soft)' : 'var(--panel)',
                color: active ? 'var(--gold)' : 'var(--text-soft)',
                fontWeight: '800',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {activeLogTab === 'Access Intelligence' && (
        <>
          <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'grid', gap: '14px' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: '900', color: 'var(--gold)', textTransform: 'uppercase', margin: 0 }}>
              ADMIN ACCESS INTELLIGENCE™
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(130px, 1fr))', gap: '12px' }}>
              {summaryCards.map((card) => (
                <div key={card.label} style={{ padding: '12px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', minHeight: '76px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)', fontWeight: '800', textTransform: 'uppercase', lineHeight: '1.25' }}>{card.label}</span>
                  <strong style={{ fontSize: '1.35rem', fontWeight: '900', color: card.color }}>{card.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
            {status && <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', margin: '0 0 10px 0' }}>{status}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left', minWidth: '1180px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '8px 10px' }}>Timestamp</th>
                    <th style={{ padding: '8px 10px' }}>Selected Role</th>
                    <th style={{ padding: '8px 10px' }}>Username / Admin ID</th>
                    <th style={{ padding: '8px 10px' }}>Portal Accessed</th>
                    <th style={{ padding: '8px 10px' }}>IP Address</th>
                    <th style={{ padding: '8px 10px' }}>Browser</th>
                    <th style={{ padding: '8px 10px' }}>Device</th>
                    <th style={{ padding: '8px 10px' }}>Security Question Category</th>
                    <th style={{ padding: '8px 10px' }}>Security Verification Result</th>
                    <th style={{ padding: '8px 10px' }}>Final Access Result</th>
                  </tr>
                </thead>
                <tbody>
                  {accessEvents.length > 0 ? (
                    accessEvents.map((event) => {
                      const role = event.metadata?.role || 'Founder'
                      const finalResult = getAccessResult(event)
                      const resultColor = finalResult === 'Access Granted' ? 'var(--ok)' : finalResult === 'Account Locked' ? 'var(--gold)' : '#ff6b6b'
                      return (
                        <tr key={`access-${event.id}`} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{new Date(event.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '10px', fontWeight: '800', color: 'var(--text)' }}>{role}</td>
                          <td style={{ padding: '10px', color: 'var(--text-soft)', fontFamily: 'monospace' }}>{event.metadata?.adminId || event.actorId || 'Unknown'}</td>
                          <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{event.metadata?.portal || 'Admin Portal'}</td>
                          <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{event.ipAddress || 'Internal'}</td>
                          <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{getBrowserName(event.userAgent || event.metadata?.browser)}</td>
                          <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{getDeviceName(event.userAgent || event.metadata?.browser)}</td>
                          <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{getSecurityQuestionCategory(role)}</td>
                          <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{getVerificationResult(event)}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '3px 8px', borderRadius: '4px', color: resultColor, background: 'var(--bg)', border: `1px solid ${resultColor}` }}>
                              {finalResult}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>
                        No admin portal access activity found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeLogTab === 'Notification Audit Log' && (
        <>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '600', textTransform: 'uppercase' }}>Notification Sent</span>
          <strong style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--ok)' }}>{sentCount}</strong>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: '2px' }}>Successfully dispatched via SMTP</span>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '600', textTransform: 'uppercase' }}>Notification Failed</span>
          <strong style={{ fontSize: '1.8rem', fontWeight: '900', color: '#ff6b6b' }}>{failedCount}</strong>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: '2px' }}>SMTP errors or network rejections</span>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '600', textTransform: 'uppercase' }}>Delivery Status (Pending)</span>
          <strong style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--gold)' }}>{pendingCount}</strong>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', marginTop: '2px' }}>Queued notifications awaiting retry</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '14px', margin: 0 }}>
          Founder Security Event Delivery Log
        </h3>
        {status && <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', margin: '0 0 10px 0' }}>{status}</p>}
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                <th style={{ padding: '8px 10px' }}>Timestamp</th>
                <th style={{ padding: '8px 10px' }}>Event</th>
                <th style={{ padding: '8px 10px' }}>Recipient</th>
                <th style={{ padding: '8px 10px' }}>Delivery Status</th>
                <th style={{ padding: '8px 10px' }}>SMTP Errors</th>
              </tr>
            </thead>
            <tbody>
              {events.length > 0 ? (
                events.map((e) => {
                  let badgeColor = '#b9b4a8';
                  let badgeBg = 'rgba(185, 180, 168, 0.08)';
                  let badgeBorder = 'rgba(185, 180, 168, 0.2)';
                  if (e.deliveryStatus === 'sent') {
                    badgeColor = 'var(--ok)';
                    badgeBg = 'rgba(15, 138, 87, 0.08)';
                    badgeBorder = 'rgba(15, 138, 87, 0.2)';
                  } else if (e.deliveryStatus === 'failed') {
                    badgeColor = '#ff6b6b';
                    badgeBg = 'rgba(216, 56, 56, 0.08)';
                    badgeBorder = 'rgba(216, 56, 56, 0.2)';
                  } else if (e.deliveryStatus === 'pending') {
                    badgeColor = 'var(--gold)';
                    badgeBg = 'rgba(245, 193, 79, 0.08)';
                    badgeBorder = 'rgba(245, 193, 79, 0.2)';
                  }

                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', transition: '180ms ease' }}
                      className="audit-row"
                    >
                      <td style={{ padding: '10px', color: 'var(--text-soft)' }}>
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text)' }}>
                        {e.title}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-soft)' }}>
                        {(e.recipients || []).join(', ') || 'None'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          color: badgeColor,
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`
                        }}>
                          {e.deliveryStatus.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: e.deliveryError ? '#ff6b6b' : 'var(--text-soft)', fontStyle: e.deliveryError ? 'normal' : 'italic', wordBreak: 'break-all' }}>
                        {e.deliveryError || 'None (Success Response verified)'}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>
                    No security event delivery records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {selectedEvent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setSelectedEvent(null)}>
          <div style={{
            width: '100%',
            maxWidth: '640px',
            background: 'var(--panel-strong)',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow)',
            display: 'grid',
            gap: '16px'
          }} onClick={ev => ev.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
                Security Event: {selectedEvent.title}
              </h4>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontWeight: '800', fontSize: '1.4rem', lineHeight: '1', padding: '0 4px' }}
                onClick={() => setSelectedEvent(null)}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 12px', fontSize: '0.84rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Event ID:</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{selectedEvent.id}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Event Type:</span>
              <span style={{ color: 'var(--gold)', fontWeight: '700' }}>{selectedEvent.eventType}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Timestamp:</span>
              <span>{new Date(selectedEvent.createdAt).toLocaleString()}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Actor / operator:</span>
              <span>{selectedEvent.actorEmail || selectedEvent.actorId || 'System'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>IP Address:</span>
              <span>{selectedEvent.ipAddress || 'Internal'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>User Agent:</span>
              <span style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>{selectedEvent.userAgent || 'N/A'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Recipients:</span>
              <span>{(selectedEvent.recipients || []).join(', ') || 'None'}</span>

              <span style={{ color: 'var(--text-soft)', fontWeight: '700' }}>Delivery Status:</span>
              <span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: selectedEvent.deliveryStatus === 'sent' ? 'var(--ok)' : selectedEvent.deliveryStatus === 'failed' ? '#ff6b6b' : '#f5c14f',
                  background: selectedEvent.deliveryStatus === 'sent' ? 'rgba(15, 138, 87, 0.08)' : selectedEvent.deliveryStatus === 'failed' ? 'rgba(216, 56, 56, 0.08)' : 'rgba(245, 193, 79, 0.08)',
                  border: `1px solid ${selectedEvent.deliveryStatus === 'sent' ? 'var(--ok)' : selectedEvent.deliveryStatus === 'failed' ? '#ff6b6b' : '#f5c14f'}`
                }}>
                  {selectedEvent.deliveryStatus.toUpperCase()}
                </span>
              </span>

              {selectedEvent.deliveryError && (
                <>
                  <span style={{ color: '#ff6b6b', fontWeight: '700' }}>Delivery Error:</span>
                  <span style={{ color: '#ff6b6b', fontSize: '0.78rem', fontFamily: 'monospace' }}>{selectedEvent.deliveryError}</span>
                </>
              )}
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>Message Content</strong>
              <p style={{ fontSize: '0.84rem', padding: '10px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--line)', margin: 0, color: 'var(--text)', lineHeight: '1.4' }}>
                {selectedEvent.message}
              </p>
            </div>

            <div style={{ display: 'grid', gap: '6px' }}>
              <strong style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>Raw Metadata Payload</strong>
              <pre style={{ margin: 0, fontSize: '0.74rem', background: 'var(--bg)', border: '1px solid var(--line)', padding: '10px', borderRadius: '8px', overflowX: 'auto', fontFamily: 'monospace', maxHeight: '110px', color: 'var(--text-soft)' }}>
                {JSON.stringify(sanitizeSecurityMetadata(selectedEvent.metadata || {}), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ClerkDashboardAccessViewProps {
  role: string;
  adminId: string;
}

function ClerkDashboardAccessView({ role, adminId }: ClerkDashboardAccessViewProps) {
  const [answer, setAnswer] = React.useState('')
  const [step, setStep] = React.useState<'verify' | 'polling' | 'denied'>('verify')
  const [token, setToken] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const [sessionActive, setSessionActive] = React.useState(false)
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null)
  const [timeLeft, setTimeLeft] = React.useState('')

  // Check existing active session on mount
  React.useEffect(() => {
    const checkSession = async () => {
      const storedToken = window.sessionStorage.getItem('clerk_dashboard_session')
      if (storedToken) {
        try {
          const res = await fetch(`${API_BASE_URL}/founder-security/clerk-access/session-check?sessionToken=${storedToken}`)
          if (res.ok) {
            const data = await res.json()
            if (data.valid) {
              setSessionActive(true)
              setExpiresAt(data.expiresAt)
            } else {
              window.sessionStorage.removeItem('clerk_dashboard_session')
            }
          }
        } catch (err) {
          console.error('Session check failed', err)
        }
      }
    }
    checkSession()
  }, [])

  // Timer loop for active session
  React.useEffect(() => {
    if (!sessionActive || !expiresAt) return

    const updateTimer = () => {
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) {
        setSessionActive(false)
        setExpiresAt(null)
        window.sessionStorage.removeItem('clerk_dashboard_session')
        setTimeLeft('')
      } else {
        const mins = Math.floor(remaining / 60000)
        const secs = Math.floor((remaining % 60000) / 1000)
        setTimeLeft(`${mins}m ${secs}s`)
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [sessionActive, expiresAt])

  // Polling approval status during request
  React.useEffect(() => {
    if (step !== 'polling' || !token) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/founder-security/clerk-access/status?token=${token}`)
        if (!response.ok) return
        const data = await response.json()

        if (data.status === 'approved') {
          clearInterval(interval)
          // Store session token in session storage
          window.sessionStorage.setItem('clerk_dashboard_session', data.sessionToken)

          // Fetch exact expiration timestamp from server
          try {
            const checkRes = await fetch(`${API_BASE_URL}/founder-security/clerk-access/session-check?sessionToken=${data.sessionToken}`)
            if (checkRes.ok) {
              const checkData = await checkRes.json()
              if (checkData.valid) {
                setExpiresAt(checkData.expiresAt)
                setSessionActive(true)
              }
            }
          } catch (err) {
            console.error('Failed to retrieve expiration time', err)
            setExpiresAt(Date.now() + 15 * 60 * 1000)
            setSessionActive(true)
          }

          // Automatically launch dashboard
          const newWindow = window.open('https://dashboard.clerk.com/', '_blank')
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            // Fallback to redirecting current tab if popup is blocked
            window.location.href = 'https://dashboard.clerk.com/'
          }

          setStep('verify')
          setAnswer('')
          setError('')
        } else if (data.status === 'rejected') {
          clearInterval(interval)
          setStep('denied')
          setError('Founder approval denied.')
        } else if (data.status === 'invalid') {
          clearInterval(interval)
          setStep('verify')
          setError('Authorization request expired or invalid.')
        }
      } catch (err) {
        console.error('Polling Clerk Dashboard access approval failed', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [step, token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/founder-security/clerk-access/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, adminId, answer }),
      })

      const data = await response.json()
      if (response.ok && data.ok) {
        setToken(data.token)
        setStep('polling')
      } else {
        setError(data.message || 'Verification failed.')
      }
    } catch (err: any) {
      setError(err.message || 'Access request service unavailable.')
    } finally {
      setLoading(false)
    }
  }

  const handleLaunch = () => {
    window.open('https://dashboard.clerk.com/', '_blank')
  }

  const handleRevoke = () => {
    window.sessionStorage.removeItem('clerk_dashboard_session')
    setSessionActive(false)
    setExpiresAt(null)
  }

  if (sessionActive) {
    return (
      <div style={{ maxWidth: '480px', margin: '40px auto 0', width: '100%' }} className="reveal-up">
        <div className="glass-card" style={{ padding: '36px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'rgba(15, 138, 87, 0.1)',
              color: 'var(--ok)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--ok)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '4px 0 0', fontFamily: 'Sora, sans-serif' }}>
              Access Granted
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', margin: 0 }}>
              Your session for Clerk Dashboard Access is currently active.
            </p>
          </div>

          <div style={{
            padding: '16px',
            borderRadius: '8px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            textAlign: 'center',
            display: 'grid',
            gap: '6px'
          }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '600', textTransform: 'uppercase' }}>Time Remaining</span>
            <strong style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--gold)', fontFamily: 'monospace' }}>
              {timeLeft || 'Calculating...'}
            </strong>
          </div>

          <button
            type="button"
            onClick={handleLaunch}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontWeight: '800',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Lock size={16} /> Launch Clerk Dashboard
          </button>

          <button
            type="button"
            onClick={handleRevoke}
            className="btn btn-outline"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              background: 'transparent',
              color: '#ff6b6b',
              borderColor: 'rgba(255, 107, 107, 0.2)',
              outline: 'none'
            }}
          >
            Lock Gateway / Revoke Session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto 0', width: '100%' }} className="reveal-up">
      <div className="glass-card" style={{ padding: '36px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <span className="legatrixon-logo-circle" style={{ width: '48px', height: '48px', borderWidth: '2px' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '4px 0 0', fontFamily: 'Sora, sans-serif' }}>
            Clerk Dashboard Access Gateway
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', margin: 0 }}>
            Restricted to Founder &amp; CTO. Secondary authorization required.
          </p>
        </div>

        {step === 'verify' && (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(245, 193, 79, 0.04)', border: '1px dashed var(--gold)', color: 'var(--text)', fontSize: '0.86rem', lineHeight: '1.4', textAlign: 'center', fontWeight: '600' }}>
              "What do Founder and CTO like the most?"
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '0.78rem', color: 'var(--gold)', fontWeight: '700', textTransform: 'uppercase' }}>
              Security Answer
              <input
                type="password"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter security answer"
                required
                disabled={loading}
                autoFocus
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  color: 'var(--text)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  marginTop: '4px'
                }}
              />
            </label>

            {error && (
              <p style={{ fontSize: '0.82rem', color: '#ff6b6b', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} />
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
              {loading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <Lock size={16} /> Request Access
                </>
              )}
            </button>
          </form>
        )}

        {step === 'polling' && (
          <div style={{ textAlign: 'center', display: 'grid', gap: '20px', padding: '12px 0' }}>
            <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto' }}>
              <div style={{ position: 'absolute', inset: 0, border: '3px solid var(--line)', borderRadius: '50%', opacity: 0.3 }} />
              <div style={{ position: 'absolute', inset: 0, border: '3px solid transparent', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
                <Lock size={22} />
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px', fontFamily: 'Sora, sans-serif' }}>
                Awaiting Founder Approval
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', margin: 0, lineHeight: '1.5' }}>
                A secure 2FA access request has been sent to the founder's email (<strong>legatrixon2026@gmail.com</strong>).
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--gold)', margin: '10px 0 0', fontWeight: '600' }}>
                Please check your inbox to Approve or Reject...
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('verify')
                setToken('')
                setAnswer('')
                setError('')
              }}
              className="btn btn-outline"
              style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: '700', margin: '8px auto 0', cursor: 'pointer', border: '1px solid var(--line)', borderRadius: '8px', background: 'transparent', color: 'var(--text)', outline: 'none' }}
            >
              Cancel Request
            </button>
          </div>
        )}

        {step === 'denied' && (
          <div style={{ textAlign: 'center', display: 'grid', gap: '20px', padding: '12px 0' }}>
            <div style={{ width: '56px', height: '56px', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '24px', fontWeight: 'bold' }}>
              ✕
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#f8fafc', margin: '0 0 8px', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'Sora, sans-serif' }}>
                Access Blocked
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#fca5a5', margin: 0, fontWeight: '700' }}>
                {error || 'Founder approval denied.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('verify')
                setAnswer('')
                setError('')
              }}
              className="btn btn-outline"
              style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: '700', margin: '8px auto 0', cursor: 'pointer', border: '1px solid var(--line)', borderRadius: '8px', background: 'transparent', color: 'var(--text)', outline: 'none' }}
            >
              Back to Gateway
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// FEEDBACK & SUPPORT SYSTEMS ADDITIONS
// ==========================================

// FeedbackManagementView component
function FeedbackManagementView() {
  const [ratings, setRatings] = useState<any[]>([])
  const [aiFeedback, setAiFeedback] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subTab, setSubTab] = useState<'Star Ratings' | 'AI Assistant Feedback'>('Star Ratings')
  const [search, setSearch] = useState('')

  const fetchRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_ratings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRatings(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ratings.');
    }
  };

  const fetchAiFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_feedback')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAiFeedback(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI feedback.');
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRatings(), fetchAiFeedback()]).finally(() => setLoading(false));

    const ratingsChannel = supabase
      .channel('ratings-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_ratings' }, () => {
        fetchRatings();
      })
      .subscribe();

    const aiChannel = supabase
      .channel('ai-feedback-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_feedback' }, () => {
        fetchAiFeedback();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ratingsChannel);
      supabase.removeChannel(aiChannel);
    };
  }, []);

  // Compute metrics
  const avgRating = ratings.length > 0 ? (ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(1) : '0.0';
  
  const aiHelpfulCount = aiFeedback.filter(f => f.feedback_type === 'Helpful').length;
  const aiNotHelpfulCount = aiFeedback.filter(f => f.feedback_type === 'Not Helpful').length;
  const aiTotal = aiFeedback.length;
  const aiHelpfulPercent = aiTotal > 0 ? ((aiHelpfulCount / aiTotal) * 100).toFixed(0) : '0';

  // Filters
  const filteredRatings = ratings.filter(r => 
    r.user_name?.toLowerCase().includes(search.toLowerCase()) || 
    r.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAi = aiFeedback.filter(f => 
    f.user_name?.toLowerCase().includes(search.toLowerCase()) || 
    f.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Average Platform Rating</span>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--gold)' }}>{avgRating} / 5.0</h3>
            <div style={{ display: 'flex', gap: '2px', color: 'var(--gold)' }}>
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={14} style={{ fill: s <= Math.round(Number(avgRating)) ? 'var(--gold)' : 'none' }} />
              ))}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', marginLeft: '6px' }}>({ratings.length} reviews)</span>
            </div>
          </div>
          <Star size={36} style={{ color: 'var(--gold)', opacity: 0.15 }} />
        </div>

        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>AI Assistant Helpfulness</span>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--ok)' }}>{aiHelpfulPercent}% Helpful</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', margin: 0 }}>
              {aiHelpfulCount} Helpful • {aiNotHelpfulCount} Not Helpful ({aiTotal} total responses rated)
            </p>
          </div>
          <ThumbsUp size={36} style={{ color: 'var(--ok)', opacity: 0.15 }} />
        </div>
      </div>

      {/* Sub-tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['Star Ratings', 'AI Assistant Feedback'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: subTab === tab ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: subTab === tab ? 'var(--gold)' : 'var(--text-soft)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', padding: '2px 8px', width: '220px' }}>
          <Search size={14} style={{ color: 'var(--text-soft)', marginRight: '6px' }} />
          <input
            type="text"
            placeholder="Search by user or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.76rem', outline: 'none', padding: '4px 0' }}
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        {loading ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', textAlign: 'center', margin: '20px 0' }}>Loading live feedback logs...</p>
        ) : error ? (
          <p style={{ fontSize: '0.82rem', color: '#ff6b6b', textAlign: 'center', margin: '20px 0' }}>{error}</p>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {subTab === 'Star Ratings' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '8px 10px' }}>User Name</th>
                    <th style={{ padding: '8px 10px' }}>User Email</th>
                    <th style={{ padding: '8px 10px' }}>Rating</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRatings.length > 0 ? (
                    filteredRatings.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>{item.user_name || 'Anonymous'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>{item.user_email || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', gap: '2px', color: 'var(--gold)' }}>
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={12} style={{ fill: s <= item.rating ? 'var(--gold)' : 'none' }} />
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-soft)' }}>
                          {new Date(item.created_at).toLocaleString('en-IN', { hour12: false })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No ratings found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                    <th style={{ padding: '8px 10px' }}>User Name</th>
                    <th style={{ padding: '8px 10px' }}>User Email</th>
                    <th style={{ padding: '8px 10px' }}>AI Helpfulness</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAi.length > 0 ? (
                    filteredAi.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>{item.user_name || 'Anonymous'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>{item.user_email || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            border: `1px solid ${item.feedback_type === 'Helpful' ? 'var(--ok)' : '#ff6b6b'}`,
                            background: item.feedback_type === 'Helpful' ? 'rgba(15,138,87,0.1)' : 'rgba(255,107,107,0.1)',
                            color: item.feedback_type === 'Helpful' ? 'var(--ok)' : '#ff6b6b'
                          }}>
                            {item.feedback_type}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-soft)' }}>
                          {new Date(item.created_at).toLocaleString('en-IN', { hour12: false })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No AI feedback found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// BugReportsView component
function BugReportsView() {
  const [bugs, setBugs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchBugs = async () => {
    try {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBugs(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bug reports.');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBugs().finally(() => setLoading(false));

    const channel = supabase
      .channel('bugs-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, () => {
        fetchBugs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleMarkFixed = async (bugId: string) => {
    try {
      const { error: bugError } = await supabase
        .from('bug_reports')
        .update({ status: 'Resolved' })
        .eq('id', bugId);

      if (bugError) throw bugError;

      // Sync matching support ticket
      await supabase
        .from('support_tickets')
        .update({ status: 'Resolved' })
        .eq('reference_id', bugId);

    } catch (err: any) {
      console.error('Failed to update bug status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const totalBugs = bugs.length;
  const openBugs = bugs.filter(b => b.status === 'Open').length;
  const resolvedBugs = bugs.filter(b => b.status === 'Resolved').length;

  const filteredBugs = bugs.filter(b => 
    b.user_name?.toLowerCase().includes(search.toLowerCase()) || 
    b.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    b.module_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.issue_type?.toLowerCase().includes(search.toLowerCase()) ||
    b.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Total Bug Reports</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--text)' }}>{totalBugs}</h3>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Open Bugs</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: '#ff6b6b' }}>{openBugs}</h3>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Resolved Bugs</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--ok)' }}>{resolvedBugs}</h3>
        </div>
      </div>

      {/* Title & Search bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text)' }}>All Bug Submissions</span>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', padding: '2px 8px', width: '250px' }}>
          <Search size={14} style={{ color: 'var(--text-soft)', marginRight: '6px' }} />
          <input
            type="text"
            placeholder="Search bugs, modules, users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.76rem', outline: 'none', padding: '4px 0' }}
          />
        </div>
      </div>

      {/* Grid Table */}
      <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        {loading ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', textAlign: 'center', margin: '20px 0' }}>Loading bug logs...</p>
        ) : error ? (
          <p style={{ fontSize: '0.82rem', color: '#ff6b6b', textAlign: 'center', margin: '20px 0' }}>{error}</p>
        ) : (
          <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                  <th style={{ padding: '8px 10px' }}>Reporter</th>
                  <th style={{ padding: '8px 10px' }}>Issue &amp; Module</th>
                  <th style={{ padding: '8px 10px', width: '30%' }}>Description</th>
                  <th style={{ padding: '8px 10px' }}>Screenshot</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.length > 0 ? (
                  filteredBugs.map(item => {
                    const isOpen = item.status === 'Open';
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontWeight: '700', display: 'block' }}>{item.user_name || 'Anonymous'}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>{item.user_email}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255, 107, 107, 0.1)',
                            border: '1px solid rgba(255, 107, 107, 0.3)',
                            color: '#ff6b6b',
                            display: 'inline-block',
                            marginBottom: '4px'
                          }}>
                            {item.issue_type}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--gold)' }}>{item.module_name}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>{item.description}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {item.screenshot_url ? (
                            <img
                              src={item.screenshot_url}
                              alt="screenshot"
                              onClick={() => window.open(item.screenshot_url, '_blank')}
                              style={{ width: '48px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--line)', cursor: 'pointer', display: 'block' }}
                              onError={(e) => {
                                (e.target as any).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-soft)', fontSize: '0.74rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            border: `1px solid ${isOpen ? '#ff6b6b' : 'var(--ok)'}`,
                            background: isOpen ? 'rgba(255,107,107,0.1)' : 'rgba(15,138,87,0.1)',
                            color: isOpen ? '#ff6b6b' : 'var(--ok)'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {isOpen && (
                            <button
                              onClick={() => handleMarkFixed(item.id)}
                              className="btn btn-outline"
                              style={{ padding: '4px 8px', fontSize: '0.7rem', color: 'var(--ok)', borderColor: 'var(--ok)', background: 'transparent' }}
                            >
                              Mark Fixed
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No bug reports found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// FeatureRequestsView component
function FeatureRequestsView() {
  const [features, setFeatures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_requests')
        .select('*')
        .order('votes', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFeatures(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch feature requests.');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchFeatures().finally(() => setLoading(false));

    const channel = supabase
      .channel('features-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_requests' }, () => {
        fetchFeatures();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (featureId: string, newStatus: string) => {
    try {
      const { error: featError } = await supabase
        .from('feature_requests')
        .update({ status: newStatus })
        .eq('id', featureId);

      if (featError) throw featError;

      // Sync matching support ticket
      await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('reference_id', featureId);

    } catch (err: any) {
      console.error('Failed to update feature status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const totalFeatures = features.length;
  const maxVotes = features.length > 0 ? Math.max(...features.map(f => f.votes || 0)) : 0;
  const pendingCount = features.filter(f => f.status === 'Pending').length;

  const filteredFeatures = features.filter(f => 
    f.user_name?.toLowerCase().includes(search.toLowerCase()) || 
    f.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    f.title?.toLowerCase().includes(search.toLowerCase()) ||
    f.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Total Feature Suggestions</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--text)' }}>{totalFeatures}</h3>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Highest Votes Count</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--gold)' }}>{maxVotes}</h3>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Pending Requests</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: '#c084fc' }}>{pendingCount}</h3>
        </div>
      </div>

      {/* Title & Search bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text)' }}>Community Ideas Board</span>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', padding: '2px 8px', width: '250px' }}>
          <Search size={14} style={{ color: 'var(--text-soft)', marginRight: '6px' }} />
          <input
            type="text"
            placeholder="Search features, descriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.76rem', outline: 'none', padding: '4px 0' }}
          />
        </div>
      </div>

      {/* Grid Table */}
      <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        {loading ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', textAlign: 'center', margin: '20px 0' }}>Loading features...</p>
        ) : error ? (
          <p style={{ fontSize: '0.82rem', color: '#ff6b6b', textAlign: 'center', margin: '20px 0' }}>{error}</p>
        ) : (
          <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                  <th style={{ padding: '8px 10px' }}>Suggested By</th>
                  <th style={{ padding: '8px 10px', width: '25%' }}>Feature Title &amp; Details</th>
                  <th style={{ padding: '8px 10px' }}>Priority</th>
                  <th style={{ padding: '8px 10px' }}>Votes</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeatures.length > 0 ? (
                  filteredFeatures.map(item => {
                    let badgeColor = 'var(--text-soft)';
                    let badgeBg = 'rgba(255,255,255,0.05)';
                    if (item.status === 'Pending') {
                      badgeColor = '#94a3b8';
                      badgeBg = 'rgba(148,163,184,0.1)';
                    } else if (item.status === 'Approved') {
                      badgeColor = '#38bdf8';
                      badgeBg = 'rgba(56,189,248,0.1)';
                    } else if (item.status === 'Planned') {
                      badgeColor = '#c084fc';
                      badgeBg = 'rgba(192,132,252,0.1)';
                    } else if (item.status === 'Resolved') {
                      badgeColor = 'var(--ok)';
                      badgeBg = 'rgba(15,138,87,0.1)';
                    } else if (item.status === 'Rejected') {
                      badgeColor = '#ff6b6b';
                      badgeBg = 'rgba(255,107,107,0.1)';
                    }

                    let prioColor = '#94a3b8';
                    if (item.priority === 'High') prioColor = '#ff6b6b';
                    if (item.priority === 'Medium') prioColor = 'var(--gold)';

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontWeight: '700', display: 'block' }}>{item.user_name || 'Anonymous'}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>{item.user_email}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <strong style={{ color: 'var(--text)', fontSize: '0.82rem', display: 'block', marginBottom: '2px' }}>{item.title}</strong>
                          <span style={{ color: 'var(--text-soft)', fontSize: '0.76rem', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{item.description}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ color: prioColor, fontWeight: '700' }}>{item.priority}</span>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: 'var(--gold)' }}>
                          {item.votes || 0}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            border: `1px solid ${badgeColor}`,
                            background: badgeBg,
                            color: badgeColor
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <select
                              value={item.status}
                              onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                              style={{ padding: '4px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', color: '#fff', fontSize: '0.72rem' }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Approved">Approve</option>
                              <option value="Planned">Plan</option>
                              <option value="Resolved">Resolve</option>
                              <option value="Rejected">Reject</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No feature requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// SupportTicketsView component
function SupportTicketsView() {
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch support tickets.');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTickets().finally(() => setLoading(false));

    const channel = supabase
      .channel('tickets-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (ticket: any, newStatus: string) => {
    try {
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id);

      if (ticketError) throw ticketError;

      // Update the base table if applicable
      const baseType = String(ticket.ticket_type).toLowerCase();
      if (baseType.includes('bug')) {
        await supabase
          .from('bug_reports')
          .update({ status: newStatus })
          .eq('id', ticket.reference_id);
      } else if (baseType.includes('feature')) {
        await supabase
          .from('feature_requests')
          .update({ status: newStatus })
          .eq('id', ticket.reference_id);
      }
    } catch (err: any) {
      console.error('Failed to update ticket status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const totalTickets = tickets.length;
  const openCount = tickets.filter(t => t.status === 'Submitted' || t.status === 'Open' || t.status === 'Under Review' || t.status === 'Pending').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed' || t.status === 'Fixed').length;

  const filteredTickets = tickets.filter(t => 
    t.user_name?.toLowerCase().includes(search.toLowerCase()) || 
    t.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    t.ticket_type?.toLowerCase().includes(search.toLowerCase()) ||
    t.status?.toLowerCase().includes(search.toLowerCase()) ||
    t.reference_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gap: '20px' }} className="reveal-up">
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Total Support Logs</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--text)' }}>{totalTickets}</h3>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Unresolved Tickets</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: '#ff6b6b' }}>{openCount}</h3>
        </div>
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Resolved Tickets</span>
          <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--ok)' }}>{resolvedCount}</h3>
        </div>
      </div>

      {/* Title & Search bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text)' }}>Consolidated Support &amp; Audit Log</span>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--line)', borderRadius: '6px', padding: '2px 8px', width: '250px' }}>
          <Search size={14} style={{ color: 'var(--text-soft)', marginRight: '6px' }} />
          <input
            type="text"
            placeholder="Search tickets, status, types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.76rem', outline: 'none', padding: '4px 0' }}
          />
        </div>
      </div>

      {/* Grid Table */}
      <div className="glass-card" style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        {loading ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', textAlign: 'center', margin: '20px 0' }}>Loading consolidated support log...</p>
        ) : error ? (
          <p style={{ fontSize: '0.82rem', color: '#ff6b6b', textAlign: 'center', margin: '20px 0' }}>{error}</p>
        ) : (
          <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                  <th style={{ padding: '8px 10px' }}>Ticket ID</th>
                  <th style={{ padding: '8px 10px' }}>User Details</th>
                  <th style={{ padding: '8px 10px' }}>Ticket Type</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Reference UUID</th>
                  <th style={{ padding: '8px 10px' }}>Created At</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length > 0 ? (
                  filteredTickets.map(item => {
                    let badgeColor = 'var(--text-soft)';
                    let badgeBg = 'rgba(255,255,255,0.05)';
                    if (item.status === 'Submitted' || item.status === 'Open' || item.status === 'Pending') {
                      badgeColor = '#38bdf8';
                      badgeBg = 'rgba(56,189,248,0.1)';
                    } else if (item.status === 'Under Review') {
                      badgeColor = 'var(--gold)';
                      badgeBg = 'rgba(245,193,79,0.1)';
                    } else if (item.status === 'Planned') {
                      badgeColor = '#c084fc';
                      badgeBg = 'rgba(192,132,252,0.1)';
                    } else if (item.status === 'Resolved' || item.status === 'Closed' || item.status === 'Fixed') {
                      badgeColor = 'var(--ok)';
                      badgeBg = 'rgba(15,138,87,0.1)';
                    } else if (item.status === 'Rejected') {
                      badgeColor = '#ff6b6b';
                      badgeBg = 'rgba(255,107,107,0.1)';
                    }

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)', fontFamily: 'monospace' }}>
                          {item.id?.substring(0, 8)}...
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontWeight: '700', display: 'block' }}>{item.user_name || 'Anonymous'}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>{item.user_email}</span>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: 'var(--gold)' }}>
                          {item.ticket_type}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            border: `1px solid ${badgeColor}`,
                            background: badgeBg,
                            color: badgeColor
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)', fontFamily: 'monospace' }}>
                          {item.reference_id ? `${item.reference_id.substring(0, 8)}...` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-soft)' }}>
                          {new Date(item.created_at).toLocaleString('en-IN', { hour12: false })}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {(item.ticket_type === 'Bug Report' || item.ticket_type === 'Feature Request' || item.ticket_type === 'bug' || item.ticket_type === 'feature') ? (
                            <select
                              value={item.status}
                              onChange={(e) => handleUpdateStatus(item, e.target.value)}
                              style={{ padding: '4px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--line)', color: '#fff', fontSize: '0.72rem' }}
                            >
                              <option value="Submitted">Submitted</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Resolved">Resolve</option>
                              <option value="Rejected">Reject</option>
                            </select>
                          ) : (
                            <span style={{ color: 'var(--text-soft)', fontSize: '0.74rem' }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-soft)' }}>No support tickets found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


/* ================================================== */
/* CONTRACT SETTINGS VIEW                             */
/* ================================================== */
interface ContractAcceptanceRecord {
  id: string;
  userId: string | null;
  email: string | null;
  timestamp: string;
  ipAddress: string | null;
  browserUserAgent: string | null;
  contractVersion: string;
  accepted: boolean;
}

interface ContractAcceptanceRecord {
  id: string;
  userId: string | null;
  email: string | null;
  timestamp: string;
  ipAddress: string | null;
  browserUserAgent: string | null;
  contractVersion: string;
  accepted: boolean;
}

function ContractSettingsView() {
  const { getToken } = useAuth()
  const [version, setVersion] = useState('')
  const [content, setContent] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [acceptances, setAcceptances] = useState<ContractAcceptanceRecord[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadConfigAndAcceptances = async () => {
    setLoading(true)
    setStatus('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Authorization required')

      const configRes = await fetch(`${API_BASE_URL}/contracts/active`)
      if (!configRes.ok) throw new Error('Failed to load contract config')
      const configData = await configRes.json()
      setVersion(configData.contractVersion)
      setContent(configData.contractContent)
      setLastUpdated(configData.lastUpdated)

      const accRes = await fetch(`${API_BASE_URL}/contracts/admin/acceptances`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!accRes.ok) throw new Error('Failed to load acceptance logs')
      const accData = await accRes.json()
      setAcceptances(accData)
    } catch (err: any) {
      setStatus(err.message || 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigAndAcceptances()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!version.trim() || !content.trim()) {
      setStatus('Version and Content are required.')
      return
    }
    setSubmitting(true)
    setStatus('Updating contract compliance configuration...')
    try {
      const token = await getToken()
      if (!token) throw new Error('Authorization required')

      const response = await fetch(`${API_BASE_URL}/contracts/admin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contractVersion: version, contractContent: content })
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setLastUpdated(result.lastUpdated)
      setStatus('Contract updated successfully! All visitors and users will be forced to re-accept.')
      loadConfigAndAcceptances()
    } catch (error: any) {
      setStatus(error.message || 'Failed to update contract configuration.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section className="glass-card" style={{ padding: '24px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={18} /> Edit Active Intellectual Property &amp; Electronic Contract
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
          Changing the version number will immediately invalidate previous acceptances, prompting all visitors and users to re-accept.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-soft)' }}>Loading contract settings...</p>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '6px', color: 'var(--text-soft)', fontSize: '0.8rem', fontWeight: 700 }}>
                Contract Version
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 1.0.0"
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: '0.8rem', color: 'var(--text-soft)', paddingBottom: '10px' }}>
                <span>Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}</span>
              </div>
            </div>

            <label style={{ display: 'grid', gap: '6px', color: 'var(--text-soft)', fontSize: '0.8rem', fontWeight: 700 }}>
              Contract Content (Text / Markdown)
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Paste contract terms here..."
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              {status && <span style={{ fontSize: '0.82rem', color: status.includes('success') ? 'var(--ok)' : 'var(--gold)', fontWeight: '600' }}>{status}</span>}
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Save &amp; Force Re-acceptance
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="glass-card" style={{ padding: '24px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', margin: '0 0 6px 0' }}>
          User Acceptance Registry
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
          Live record of legal consent captures containing unique Clerk identifiers, email accounts, timestamp, client IP addresses, and User Agent fingerprints.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-soft)' }}>Loading acceptance registry...</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '400px' }} className="contract-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--text-soft)' }}>
                  <th style={{ padding: '10px' }}>User ID / Subject</th>
                  <th style={{ padding: '10px' }}>Email</th>
                  <th style={{ padding: '10px' }}>Accepted Version</th>
                  <th style={{ padding: '10px' }}>IP Address</th>
                  <th style={{ padding: '10px' }}>Timestamp</th>
                  <th style={{ padding: '10px', maxWidth: '200px' }}>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {acceptances.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--line)', color: 'var(--text)' }}>
                    <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: 'var(--gold-soft)' }}>{item.userId || 'Guest (Synced later)'}</td>
                    <td style={{ padding: '12px 10px' }}>{item.email || '—'}</td>
                    <td style={{ padding: '12px 10px', fontWeight: '700' }}>v{item.contractVersion}</td>
                    <td style={{ padding: '12px 10px', fontFamily: 'monospace' }}>{item.ipAddress || '—'}</td>
                    <td style={{ padding: '12px 10px' }}>{new Date(item.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '12px 10px', color: 'var(--text-soft)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.browserUserAgent || undefined}>
                      {item.browserUserAgent || '—'}
                    </td>
                  </tr>
                ))}
                {!acceptances.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-soft)' }}>
                      No contract acceptance logs found in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
