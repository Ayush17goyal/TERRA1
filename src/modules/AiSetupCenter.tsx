import { API_BASE_URL } from '../lib/api'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  X,
} from 'lucide-react'

const API_BASE = `${API_BASE_URL}`

type ProviderStatus = 'Connected' | 'Invalid Key' | 'Rate Limited' | 'Not Configured' | string

type AiSetupCenterProps = {
  apiToken: string
  mode?: 'mandatory' | 'guide'
  onComplete?: () => void
  onClose?: () => void
}

const providers = [
  {
    id: 'groq',
    name: 'Groq',
    logo: 'G',
    tab: 'Groq Setup',
    description: 'Fast AI inference for drafting, summaries, and quick legal learning assistance.',
    accountStep: 'Create Groq Account',
    accountButton: 'Open Groq Console',
    accountUrl: 'https://console.groq.com',
    keyStep: 'Generate API Key',
    keyButton: 'Open API Keys',
    keyUrl: 'https://console.groq.com/keys',
    example: 'gsk_xxxxxxxxxxxxx',
    inputLabel: 'Groq API Key Input',
    placeholder: 'gsk_...',
    accent: '#f97316',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    logo: 'Gm',
    tab: 'Gemini Setup',
    description: 'Google AI support for longer explanations, learning help, and high-context legal tasks.',
    accountStep: 'Open Google AI Studio',
    accountButton: 'Open AI Studio',
    accountUrl: 'https://aistudio.google.com',
    keyStep: 'Create API Key',
    keyButton: 'Create Key',
    keyUrl: 'https://aistudio.google.com/apikey',
    example: 'AIzaSyxxxxxxxxxx',
    inputLabel: 'Gemini API Key Input',
    placeholder: 'AIzaSy...',
    accent: '#60a5fa',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: 'AI',
    tab: 'OpenAI Setup',
    description: 'Structured AI workflows for research, drafting, analysis, and reliable legal productivity.',
    accountStep: 'Open OpenAI Platform',
    accountButton: 'Open OpenAI Platform',
    accountUrl: 'https://platform.openai.com',
    keyStep: 'Generate API Key',
    keyButton: 'Create OpenAI API Key',
    keyUrl: 'https://platform.openai.com/api-keys',
    example: 'sk-proj-...',
    inputLabel: 'OpenAI API Key Input',
    placeholder: 'sk-proj-...',
    accent: '#10b981',
  },
]

const statusTone: Record<string, string> = {
  Connected: 'connected',
  'Invalid Key': 'invalid',
  'Rate Limited': 'limited',
  'Not Configured': 'empty',
}

export function AiSetupCenter({ apiToken, mode = 'mandatory', onComplete, onClose }: AiSetupCenterProps) {
  const [activeProvider, setActiveProvider] = useState(providers[0].id)
  const [values, setValues] = useState<Record<string, string>>({})
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [completing, setCompleting] = useState(false)

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiToken}`,
  }), [apiToken])

  const loadStatuses = useCallback(async () => {
    if (!apiToken) return
    try {
      const response = await fetch(`${API_BASE}/settings/byok/status`, { headers: authHeaders() })
      if (!response.ok) return
      const data = await response.json()
      const nextStatuses: Record<string, ProviderStatus> = {}
      if (Array.isArray(data.providers)) {
        data.providers.forEach((provider: any) => {
          nextStatuses[provider.provider] = provider.status || 'Not Configured'
        })
      }
      setStatuses(nextStatuses)
    } catch {
      setMessage('Provider status is temporarily unavailable.')
    }
  }, [apiToken, authHeaders])

  useEffect(() => {
    loadStatuses()
  }, [loadStatuses])

  const active = useMemo(
    () => providers.find((provider) => provider.id === activeProvider) || providers[0],
    [activeProvider],
  )

  const saveProvider = async (providerId: string) => {
    const apiKey = values[providerId]?.trim()
    if (!apiKey) {
      setMessage('Paste an API key before saving.')
      return
    }

    setSaving(providerId)
    setMessage('')
    try {
      const response = await fetch(`${API_BASE}/settings/byok/keys`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ provider: providerId, apiKey }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(data.message || 'Key could not be saved.')
        return
      }
      setValues((current) => ({ ...current, [providerId]: '' }))
      setStatuses((current) => ({ ...current, [providerId]: data.status || 'Connected' }))
      setMessage(data.status === 'Connected' ? 'Provider connected successfully.' : `${data.status || 'Provider saved'}. LEGATRIXON AI remains available.`)
      await loadStatuses()
    } catch {
      setMessage('Network error while saving provider key.')
    } finally {
      setSaving(null)
    }
  }

  const enterLegatrixon = async () => {
    if (!understood) return
    setCompleting(true)
    setMessage('')
    try {
      if (mode === 'mandatory') {
        const response = await fetch(`${API_BASE}/settings/ai-provider-onboarding/complete`, {
          method: 'POST',
          headers: authHeaders(),
        })
        if (!response.ok) throw new Error('Unable to save onboarding status.')
      }
      onComplete?.()
      onClose?.()
    } catch (error: any) {
      setMessage(error.message || 'Unable to continue right now.')
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className={`ai-setup-overlay ${mode === 'guide' ? 'guide' : 'mandatory'}`} role="dialog" aria-modal={mode === 'mandatory'}>
      <section className="ai-setup-center">
        {mode === 'guide' && (
          <button type="button" className="ai-setup-close" onClick={onClose} aria-label="Close setup guide">
            <X size={18} />
          </button>
        )}

        <header className="ai-setup-hero">
          <div>
            <p className="settings-kicker">LEGATRIXON AI Setup Center</p>
            <h2>Welcome to LEGATRIXON.</h2>
            <p>To unlock the best AI-powered legal assistance, connect one or more AI providers.</p>
          </div>
          <div className="ai-setup-hero-badge">
            <KeyRound size={22} />
            <span>Optional BYOK</span>
          </div>
        </header>

        <nav className="ai-setup-tabs" aria-label="AI provider setup">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={activeProvider === provider.id ? 'active' : ''}
              onClick={() => setActiveProvider(provider.id)}
            >
              {provider.tab}
            </button>
          ))}
        </nav>

        <section className="ai-setup-provider-card" style={{ '--provider-accent': active.accent } as React.CSSProperties}>
          <div className="ai-setup-provider-head">
            <span className="ai-setup-logo">{active.logo}</span>
            <div>
              <p className="settings-kicker">{active.name}</p>
              <h3>{active.name}</h3>
              <p>{active.description}</p>
            </div>
            <span className={`ai-setup-status ${statusTone[statuses[active.id] || 'Not Configured'] || 'empty'}`}>
              {statuses[active.id] || 'Not Configured'}
            </span>
          </div>

          <div className="ai-setup-steps">
            <article>
              <span>Step 1</span>
              <h4>{active.accountStep}</h4>
              <a href={active.accountUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                {active.accountButton}
                <ExternalLink size={14} />
              </a>
            </article>
            <article>
              <span>Step 2</span>
              <h4>{active.keyStep}</h4>
              <a href={active.keyUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                {active.keyButton}
                <ExternalLink size={14} />
              </a>
            </article>
            <article>
              <span>Step 3</span>
              <h4>Copy API Key</h4>
              <p>Example:</p>
              <code>{active.example}</code>
            </article>
            <article>
              <span>Step 4</span>
              <h4>Paste in LEGATRIXON</h4>
              <div className="ai-setup-key-row">
                <input
                  type="password"
                  value={values[active.id] || ''}
                  placeholder={active.inputLabel}
                  autoComplete="off"
                  onChange={(event) => setValues((current) => ({ ...current, [active.id]: event.target.value }))}
                />
                <button type="button" className="btn btn-primary" onClick={() => saveProvider(active.id)} disabled={saving === active.id}>
                  {saving === active.id ? <Loader2 size={15} className="spin-animation" /> : <ShieldCheck size={15} />}
                  Save
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="ai-setup-security">
          <h3><LockKeyhole size={18} />Security</h3>
          <div>
            <span><CheckCircle2 size={16} />Keys are encrypted</span>
            <span><CheckCircle2 size={16} />Keys are stored securely</span>
            <span><CheckCircle2 size={16} />Keys are never shown again</span>
            <span><CheckCircle2 size={16} />Keys are never exposed to other users</span>
          </div>
        </section>

        <footer className="ai-setup-final">
          <label>
            <input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
            I have completed setup
          </label>
          <button type="button" className="btn btn-primary" disabled={!understood || completing} onClick={enterLegatrixon}>
            {completing ? <Loader2 size={16} className="spin-animation" /> : <CheckCircle2 size={16} />}
            Enter LEGATRIXON
          </button>
        </footer>

        {message && <p className="ai-setup-message">{message}</p>}
      </section>
    </div>
  )
}

