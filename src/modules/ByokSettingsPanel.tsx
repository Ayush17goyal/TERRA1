import { API_BASE_URL } from '../lib/api'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Gauge,
  HelpCircle,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'

const API_BASE = `${API_BASE_URL}`

type ProviderStatus = 'Connected' | 'Invalid Key' | 'Rate Limited' | 'Not Configured' | string

type ByokKey = {
  provider: string
  status: ProviderStatus
  lastVerifiedAt: string | null
  fingerprint?: string | null
}

type ByokUsage = {
  requestsUserKeys: number
  requestsLegatrixonKeys: number
  cacheHits: number
  estimatedApiCallsSaved: number
}

const PROVIDERS = [
  {
    id: 'groq',
    label: 'Groq',
    logo: 'G',
    detail: 'Fast inference for quick legal study tools, drafting support, and lightweight reasoning workflows.',
    placeholder: 'gsk_...',
    accent: '#f97316',
    accountLabel: 'Create Free Groq Account',
    accountUrl: 'https://console.groq.com/',
    keyLabel: 'Get Groq API Key',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    logo: 'Gm',
    detail: 'Google AI provider suited for long legal explanations, study support, and high-context learning.',
    placeholder: 'AIza...',
    accent: '#60a5fa',
    accountLabel: 'Open Google AI Studio',
    accountUrl: 'https://aistudio.google.com/',
    keyLabel: 'Create Gemini API Key',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    logo: 'AI',
    detail: 'Reliable provider for structured output, legal drafting, JSON workflows, and advanced reasoning.',
    placeholder: 'sk-proj-...',
    accent: '#10b981',
    accountLabel: 'Open OpenAI Platform',
    accountUrl: 'https://platform.openai.com/',
    keyLabel: 'Create OpenAI API Key',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
]

const SETUP_STEPS = [
  'Open provider website',
  'Create account or sign in',
  'Generate API key',
  'Copy API key',
  'Paste API key into LEGATRIXON',
  'Click Save',
]

const statusCopy: Record<string, { label: string; tone: string; helper: string }> = {
  Connected: {
    label: 'Connected',
    tone: 'ok',
    helper: 'Requests will try this key before LEGATRIXON providers.',
  },
  'Invalid Key': {
    label: 'Invalid key',
    tone: 'danger',
    helper: 'Update the key to enable this provider.',
  },
  'Rate Limited': {
    label: 'Rate limited',
    tone: 'warn',
    helper: 'LEGATRIXON fallback stays available where your plan allows.',
  },
  'Not Configured': {
    label: 'Not configured',
    tone: 'muted',
    helper: 'Optional. Existing LEGATRIXON AI keeps working.',
  },
}

export function ByokSettingsPanel({ apiToken }: { apiToken: string }) {
  const [keys, setKeys] = useState<ByokKey[]>([])
  const [usage, setUsage] = useState<ByokUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{ provider: string; type: 'success' | 'error'; message: string } | null>(null)

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiToken}`,
  }), [apiToken])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = authHeaders()
      const [statusRes, usageRes] = await Promise.all([
        fetch(`${API_BASE}/settings/byok/status`, { headers }),
        fetch(`${API_BASE}/settings/byok/usage`, { headers }),
      ])

      if (statusRes.ok) {
        const data = await statusRes.json()
        setKeys(Array.isArray(data.providers) ? data.providers : [])
      }
      if (usageRes.ok) setUsage(await usageRes.json())
    } catch {
      setFeedback({ provider: 'all', type: 'error', message: 'Unable to refresh provider status.' })
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    load()
  }, [load])

  const providerStatus = useCallback((providerId: string): ByokKey => {
    return keys.find((key) => key.provider === providerId) || {
      provider: providerId,
      status: 'Not Configured',
      lastVerifiedAt: null,
      fingerprint: null,
    }
  }, [keys])

  const totalRequests = usage ? usage.requestsUserKeys + usage.requestsLegatrixonKeys : 0
  const userKeyPercent = totalRequests > 0 && usage ? Math.round((usage.requestsUserKeys / totalRequests) * 100) : 0

  const usageCards = useMemo(() => [
    { label: 'Your Keys', value: usage?.requestsUserKeys || 0, detail: `${userKeyPercent}% of routed requests`, icon: <KeyRound size={18} /> },
    { label: 'LEGATRIXON Keys', value: usage?.requestsLegatrixonKeys || 0, detail: 'System-provider requests', icon: <Server size={18} /> },
    { label: 'Cache Hits', value: usage?.cacheHits || 0, detail: 'Redis and semantic cache wins', icon: <Zap size={18} /> },
    { label: 'Calls Saved', value: usage?.estimatedApiCallsSaved || 0, detail: 'Estimated API calls avoided', icon: <Gauge size={18} /> },
  ], [usage, userKeyPercent])

  const saveKey = async (provider: string) => {
    const apiKey = inputValues[provider]?.trim()
    if (!apiKey) return

    setSaving(provider)
    setFeedback(null)

    try {
      const res = await fetch(`${API_BASE}/settings/byok/keys`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ provider, apiKey }),
      })
      const data = await res.json()

      if (!res.ok) {
        setFeedback({ provider, type: 'error', message: data.message || 'Provider key could not be saved.' })
        return
      }

      const message = data.status === 'Connected'
        ? 'Key verified and saved.'
        : `${data.status || 'Provider'} saved. LEGATRIXON fallback remains active.`
      setFeedback({ provider, type: data.status === 'Invalid Key' ? 'error' : 'success', message })
      setInputValues((prev) => ({ ...prev, [provider]: '' }))
      await load()
    } catch {
      setFeedback({ provider, type: 'error', message: 'Network error while saving key.' })
    } finally {
      setSaving(null)
    }
  }

  const deleteKey = async (provider: string) => {
    setDeleting(provider)
    setFeedback(null)

    try {
      const res = await fetch(`${API_BASE}/settings/byok/keys/${provider}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })

      if (!res.ok) {
        setFeedback({ provider, type: 'error', message: 'Provider key could not be removed.' })
        return
      }

      setFeedback({ provider, type: 'success', message: 'Provider key removed.' })
      await load()
    } catch {
      setFeedback({ provider, type: 'error', message: 'Network error while removing key.' })
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <section className="settings-section byok-panel" id="byok-settings-panel">
        <div className="byok-loading">
          <Loader2 size={20} className="spin-animation" />
          Loading AI Provider Settings...
        </div>
      </section>
    )
  }

  return (
    <section className="settings-section byok-panel" id="byok-settings-panel">
      <div className="byok-header">
        <div>
          <p className="settings-kicker">Bring Your Own Key</p>
          <h3><KeyRound size={18} />AI Provider Settings</h3>
          <p>Use personal provider quotas first while LEGATRIXON keeps the existing AI stack, fallbacks, cache, and retrieval workflow intact.</p>
        </div>
        <div className="byok-trust-stack">
          <span><ShieldCheck size={14} />Encrypted storage</span>
          <span><LockKeyhole size={14} />Write-only secrets</span>
        </div>
      </div>

      <div className="byok-guide">
        <div className="byok-guide-copy">
          <p className="settings-kicker">Quick Setup Guide</p>
          <h4><Clipboard size={17} />Copy, Paste, Save</h4>
          <p>Choose a provider, generate a key on the official website, paste it below, and LEGATRIXON will validate and encrypt it server-side.</p>
        </div>
        <ol className="byok-guide-steps">
          {SETUP_STEPS.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="byok-routing-strip">
        <span>User provider</span>
        <span>LEGATRIXON provider</span>
        <span>Fallback chain</span>
        <span>Source fallback</span>
      </div>

      <div className="byok-provider-grid">
        {PROVIDERS.map((provider) => {
          const status = providerStatus(provider.id)
          const copy = statusCopy[status.status] || statusCopy['Not Configured']
          const configured = status.status !== 'Not Configured'
          const fb = feedback?.provider === provider.id ? feedback : null

          return (
            <article className="byok-provider-card" key={provider.id} style={{ '--provider-accent': provider.accent } as React.CSSProperties}>
              <div className="byok-provider-top">
                <div className="byok-provider-title">
                  <span className="byok-provider-logo" aria-hidden="true">{provider.logo}</span>
                  <div>
                    <strong>{provider.label}</strong>
                    <p>{provider.detail}</p>
                  </div>
                </div>
                <span className={`byok-status byok-status-${copy.tone}`} title={copy.helper}>
                  {copy.tone === 'ok' ? <CheckCircle2 size={14} /> : copy.tone === 'danger' ? <XCircle size={14} /> : <ShieldCheck size={14} />}
                  {copy.label}
                </span>
              </div>

              <div className="byok-provider-actions">
                <a className="btn btn-outline" href={provider.accountUrl} target="_blank" rel="noreferrer">
                  {provider.accountLabel}<ExternalLink size={14} />
                </a>
                <a className="btn btn-ghost" href={provider.keyUrl} target="_blank" rel="noreferrer">
                  {provider.keyLabel}<ExternalLink size={14} />
                </a>
              </div>

              <ol className="byok-card-steps" aria-label={`${provider.label} setup steps`}>
                {SETUP_STEPS.map((step, index) => (
                  <li key={`${provider.id}-${step}`}>
                    <span>{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>

              <div className="byok-paste-help">
                <HelpCircle size={14} />
                <span>Paste the full key exactly as copied. The input clears after save and the key is never shown again.</span>
              </div>

              <div className="byok-key-row">
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={configured ? 'Saved securely. Paste a new key to update.' : provider.placeholder}
                  value={inputValues[provider.id] || ''}
                  onChange={(event) => setInputValues((prev) => ({ ...prev, [provider.id]: event.target.value }))}
                  title="Paste your provider API key here. It is sent only to the LEGATRIXON backend for validation and encrypted storage."
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveKey(provider.id)}
                  disabled={saving === provider.id || !inputValues[provider.id]?.trim()}
                  title="Validate and save this provider key"
                >
                  {saving === provider.id ? <Loader2 size={15} className="spin-animation" /> : configured ? 'Update' : 'Save'}
                </button>
                {configured && (
                  <button
                    type="button"
                    className="btn btn-ghost byok-delete"
                    onClick={() => deleteKey(provider.id)}
                    disabled={deleting === provider.id}
                    title={`Remove ${provider.label} key`}
                  >
                    {deleting === provider.id ? <Loader2 size={16} className="spin-animation" /> : <Trash2 size={16} />}
                  </button>
                )}
              </div>

              <div className="byok-provider-foot">
                <span>{copy.helper}</span>
                {status.fingerprint && <span>Fingerprint: {status.fingerprint}</span>}
                {status.lastVerifiedAt && <span>Verified: {new Date(status.lastVerifiedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
              </div>

              {fb && (
                <div className={`byok-feedback byok-feedback-${fb.type}`}>
                  {fb.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {fb.message}
                </div>
              )}
            </article>
          )
        })}
      </div>

      <div className="byok-help-grid">
        <div className="byok-help-item">
          <HelpCircle size={16} />
          <div>
            <strong>What is an API key?</strong>
            <p>A private provider token that lets LEGATRIXON send your AI requests using your own provider account.</p>
          </div>
        </div>
        <div className="byok-help-item">
          <ShieldCheck size={16} />
          <div>
            <strong>Will LEGATRIXON show it again?</strong>
            <p>No. After saving, only status, verification time, and a short fingerprint are shown.</p>
          </div>
        </div>
        <div className="byok-help-item">
          <Server size={16} />
          <div>
            <strong>What if my key fails?</strong>
            <p>LEGATRIXON fallback remains active according to your plan and existing AI limits.</p>
          </div>
        </div>
      </div>

      <div className="byok-usage-grid">
        {usageCards.map((card) => (
          <article className="settings-stat-card byok-usage-card" key={card.label}>
            <div className="settings-card-icon">{card.icon}</div>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>

      <div className="byok-security-note">
        <ShieldCheck size={18} />
        <p>
          API keys stay server-side, encrypted, and redacted from logs and analytics. BYOK changes provider billing only; LEGATRIXON plan limits and existing fallback behavior still apply.
        </p>
        <button type="button" className="btn btn-outline" onClick={load}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
    </section>
  )
}

