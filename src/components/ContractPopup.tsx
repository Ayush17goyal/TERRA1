import { API_BASE_URL } from '../lib/api'
import React, { useEffect, useState, useCallback } from 'react'
import { Download, ShieldCheck, Scale, Loader2 } from 'lucide-react'
import { useAuth, useUser } from '@clerk/clerk-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || `${API_BASE_URL}`

const DEFAULT_CONTRACT_CONTENT = `By accessing, registering on, subscribing to, clicking “I Agree”, creating an account, or otherwise using the LEGATRIXON Platform, the user expressly acknowledges and agrees that they have read, understood, and accepted these Terms and Conditions, Privacy Policy, and all other policies published by LEGATRIXON, and such acceptance shall constitute a valid, legally binding, and enforceable electronic contract having the same legal effect as a written agreement signed physically. The user further agrees not to copy, reproduce, modify, distribute, sell, license, commercialize, scrape, extract, download, reverse engineer, decompile, disassemble, derive, or attempt to access the source code, software architecture, algorithms, databases, AI models, workflows, proprietary information, trade secrets, business methods, designs, functionalities, or any other intellectual or technological components of the Platform, nor create, develop, operate, support, or assist any website, software, application, platform, service, or product that is substantially similar to, derived from, competitive with, or intended to replicate any part of LEGATRIXON. Any unauthorized use, infringement, misuse, circumvention of security measures, or breach of this Agreement shall constitute a material violation entitling LEGATRIXON to immediately suspend or terminate access, seek injunctive relief, recover damages, legal costs, and pursue all civil, criminal, and statutory remedies available under applicable law without prejudice to any other rights or remedies available to it.`;

export default function ContractPopup({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  const { isSignedIn, isLoaded: authLoaded, getToken } = useAuth()
  const { user } = useUser()
  const [accepted, setAccepted] = useState(false)
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeVersion, setActiveVersion] = useState('1.0.0')
  const [contractContent, setContractContent] = useState(DEFAULT_CONTRACT_CONTENT)
  const [initDone, setInitDone] = useState(false)

  console.log('[ContractPopup] RENDER — authLoaded:', authLoaded, 'isSignedIn:', isSignedIn, 'accepted:', accepted, 'initDone:', initDone)

  // Fetch active contract & check acceptance status
  useEffect(() => {
    if (!authLoaded) {
      console.log('[ContractPopup] Waiting for Clerk auth to load...')
      return
    }

    let cancelled = false

    ;(async () => {
      console.log('[ContractPopup] Auth loaded. Checking contract status...')
      try {
        const activeRes = await fetch(`${API_BASE}/contracts/active`)
        console.log('[ContractPopup] /contracts/active response status:', activeRes.status)
        
        if (!activeRes.ok) {
          console.error('[ContractPopup] Failed to fetch active contract:', activeRes.status)
          setInitDone(true)
          return
        }

        const activeData = await activeRes.json()
        console.log('[ContractPopup] Active contract:', activeData.contractVersion)

        if (cancelled) return
        setActiveVersion(activeData.contractVersion)
        setContractContent(activeData.contractContent)

        const currentVersion = activeData.contractVersion

        if (isSignedIn) {
          console.log('[ContractPopup] User is signed in, checking DB acceptance...')
          try {
            const token = await getToken()
            if (!token) {
              console.log('[ContractPopup] No token available')
              setInitDone(true)
              return
            }

            const statusRes = await fetch(`${API_BASE}/contracts/acceptance-status`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })

            console.log('[ContractPopup] acceptance-status response:', statusRes.status)

            if (statusRes.ok) {
              const statusData = await statusRes.json()
              console.log('[ContractPopup] Acceptance status from DB:', statusData)
              if (!cancelled) {
                // Commented out to ensure the popup is always shown on every fresh page load as requested:
                // setAccepted(statusData.accepted === true)
              }
            }
          } catch (err) {
            console.error('[ContractPopup] Error checking DB acceptance:', err)
          }
        } else {
          console.log('[ContractPopup] User is NOT signed in, checking localStorage...')
          const storedVersion = window.localStorage.getItem('legatrixon_contract_accepted_version')
          console.log('[ContractPopup] localStorage version:', storedVersion, 'current:', currentVersion)
          if (!cancelled) {
            // Commented out to ensure the popup is always shown on every fresh page load as requested:
            // setAccepted(storedVersion === currentVersion)
          }
        }
      } catch (err) {
        console.error('[ContractPopup] Fatal error:', err)
      } finally {
        if (!cancelled) setInitDone(true)
      }
    })()

    return () => { cancelled = true }
  }, [authLoaded, isSignedIn, getToken])

  // Sync pending local acceptance to DB on login
  useEffect(() => {
    if (!isSignedIn || !user) return
    const pending = window.localStorage.getItem('legatrixon_pending_contract_acceptance')
    if (!pending) return
    ;(async () => {
      try {
        const data = JSON.parse(pending)
        const token = await getToken()
        if (!token) return
        const res = await fetch(`${API_BASE}/contracts/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ contractVersion: data.contractVersion, email: user.primaryEmailAddress?.emailAddress || '' })
        })
        if (res.ok) {
          window.localStorage.removeItem('legatrixon_pending_contract_acceptance')
          console.log('[ContractPopup] Synced pending acceptance to DB')
        }
      } catch (err) {
        console.error('[ContractPopup] Failed to sync pending acceptance:', err)
      }
    })()
  }, [isSignedIn, user, getToken])

  const handleAccept = useCallback(async () => {
    if (!checked || submitting) return
    setSubmitting(true)
    try {
      const payload = {
        contractVersion: activeVersion,
        email: user?.primaryEmailAddress?.emailAddress || '',
        userId: user?.id || 'anonymous-production-user',
        sessionId: window.localStorage.getItem('legatrixon_session_id') || 'contract-acceptance'
      }

      let token = ''
      if (isSignedIn && user) {
        try {
          token = (await getToken()) || ''
        } catch (err) {
          console.warn('[ContractPopup] Clerk token unavailable; recording acceptance without auth header.', err)
        }
      }

      const postAcceptance = (authorizationToken = '') => fetch(`${API_BASE}/contracts/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorizationToken ? { 'Authorization': `Bearer ${authorizationToken}` } : {})
        },
        body: JSON.stringify(payload)
      })

      let res = await postAcceptance(token)
      if (!res.ok && token) {
        console.warn('[ContractPopup] Authenticated acceptance failed; retrying without auth header.', res.status)
        res = await postAcceptance('')
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[ContractPopup] Acceptance API failed:', res.status, text)
        window.localStorage.setItem('legatrixon_pending_contract_acceptance', JSON.stringify({
          ...payload,
          timestamp: new Date().toISOString(),
          accepted: true
        }))
      } else {
        window.localStorage.removeItem('legatrixon_pending_contract_acceptance')
      }

      window.localStorage.setItem('legatrixon_contract_accepted_version', activeVersion)
      setAccepted(true)
    } catch (err) {
      console.error('[ContractPopup] Accept failed after retry:', err)
      window.localStorage.setItem('legatrixon_contract_accepted_version', activeVersion)
      window.localStorage.setItem('legatrixon_pending_contract_acceptance', JSON.stringify({
        contractVersion: activeVersion,
        email: user?.primaryEmailAddress?.emailAddress || '',
        userId: user?.id || 'anonymous-production-user',
        timestamp: new Date().toISOString(),
        accepted: true
      }))
      setAccepted(true)
    } finally {
      setSubmitting(false)
    }
  }, [checked, submitting, isSignedIn, user, getToken, activeVersion])
  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = `${API_BASE}/contracts/download-pdf`
    link.download = `LEGATRIXON_Contract_v${activeVersion}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [activeVersion])

  // If accepted, don't block
  if (accepted) {
    console.log('[ContractPopup] Already accepted — not showing popup')
    return null
  }

  // ALWAYS render the overlay — either a loading spinner or the full contract
  return (
    <div
      id="contract-popup-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: theme === 'light' ? 'rgba(241, 245, 249, 0.92)' : 'rgba(7, 10, 18, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483647,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes contractSlideIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes contractSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .contract-scroll::-webkit-scrollbar { width: 8px; }
        .contract-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 4px; }
        .contract-scroll::-webkit-scrollbar-thumb { background: rgba(245, 193, 79, 0.3); border-radius: 4px; }
        .contract-scroll::-webkit-scrollbar-thumb:hover { background: rgba(245, 193, 79, 0.5); }
      `}</style>

      {!initDone ? (
        /* Loading state — still blocks the page */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <Loader2 size={36} color="#F5C14F" style={{ animation: 'contractSpin 1s linear infinite' }} />
          <p style={{ color: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: '0.9rem' }}>Loading compliance agreement...</p>
        </div>
      ) : (
        /* Full contract modal */
        <div style={{
          background: theme === 'light' ? 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)' : 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
          border: theme === 'light' ? '1px solid rgba(212, 175, 55, 0.5)' : '1px solid rgba(245, 193, 79, 0.3)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '640px',
          width: '100%',
          boxShadow: theme === 'light' 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 60px rgba(245, 193, 79, 0.04)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 60px rgba(245, 193, 79, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '20px',
          boxSizing: 'border-box' as const,
          animation: 'contractSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: 'rgba(245, 193, 79, 0.12)', color: '#F5C14F',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Scale size={22} />
            </div>
            <div>
              <h2 style={{
                fontSize: '1.2rem', fontWeight: 800, color: theme === 'light' ? '#0f172a' : '#f8fafc',
                margin: 0, letterSpacing: '0.02em'
              }}>
                LEGATRIXON Compliance Agreement
              </h2>
              <p style={{ fontSize: '0.75rem', color: theme === 'light' ? '#64748b' : '#94a3b8', margin: '2px 0 0' }}>
                Mandatory Intellectual Property &amp; Electronic Contract {activeVersion && `• Version ${activeVersion}`}
              </p>
            </div>
          </div>

          {/* Contract text */}
          <div
            className="contract-scroll"
            style={{
              height: '300px', overflowY: 'auto', padding: '16px',
              background: theme === 'light' ? '#f8fafc' : '#0f172a', 
              border: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #334155', 
              borderRadius: '8px',
              fontSize: '0.84rem', color: theme === 'light' ? '#334155' : '#cbd5e1', 
              lineHeight: '1.7',
              whiteSpace: 'pre-wrap' as const,
            }}
          >
            {contractContent || 'Loading contract content...'}
          </div>

          {/* Checkbox */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            cursor: 'pointer', color: theme === 'light' ? '#1e293b' : '#f1f5f9', fontSize: '0.86rem',
            userSelect: 'none' as const, lineHeight: '1.4',
          }}>
            <input
              id="contract-accept-checkbox"
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#F5C14F', cursor: 'pointer' }}
            />
            <span>I have read and agree to the Intellectual Property &amp; Electronic Contract.</span>
          </label>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '12px' }}>
            <button
              id="contract-download-btn"
              type="button"
              onClick={handleDownload}
              style={{
                background: 'transparent', border: '1px solid rgba(245, 193, 79, 0.6)',
                color: theme === 'light' ? '#b59410' : '#F5C14F', padding: '10px 18px', borderRadius: '8px',
                fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', outline: 'none', transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(245, 193, 79, 0.08)'; e.currentTarget.style.borderColor = '#F5C14F' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(245, 193, 79, 0.6)' }}
            >
              <Download size={14} /> Download Contract PDF
            </button>
            <button
              id="contract-accept-btn"
              type="button"
              onClick={handleAccept}
              disabled={!checked || submitting}
              style={{
                background: checked ? 'linear-gradient(135deg, #F5C14F 0%, #D4AF37 100%)' : (theme === 'light' ? '#cbd5e1' : '#334155'),
                border: 'none', color: checked ? '#111827' : (theme === 'light' ? '#64748b' : '#94a3b8'),
                padding: '10px 24px', borderRadius: '8px', fontWeight: 700,
                fontSize: '0.84rem', cursor: checked ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '8px', outline: 'none',
                transition: 'all 0.2s', opacity: checked ? 1 : 0.6,
              }}
              onMouseOver={(e) => { if (checked) e.currentTarget.style.boxShadow = '0 0 16px rgba(245, 193, 79, 0.5)' }}
              onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none' }}
            >
              {submitting ? (
                <><Loader2 size={14} style={{ animation: 'contractSpin 1s linear infinite' }} /> Storing acceptance...</>
              ) : (
                <><ShieldCheck size={14} /> Accept &amp; Continue</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

