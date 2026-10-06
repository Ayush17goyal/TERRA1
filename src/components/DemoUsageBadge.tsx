import { useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../lib/api'

type DemoFeature = 'legal_research' | 'case_law_reasoning' | 'mock_test' | 'lexmentor_ai' | 'guidebot_ai' | 'bare_act_ai' | 'drafting_mentor' | 'drafting_academy' | 'document_processing' | 'judgment_ai' | 'draft_analysis' | 'academic_ai' | 'memorial_ai'

export function DemoUsageBadge({ feature }: { feature: DemoFeature }) {
  const { getToken, isSignedIn } = useAuth()
  const [usage, setUsage] = useState<any>(null)

  useEffect(() => {
    if (!isSignedIn) return
    let cancelled = false
    const load = async () => {
      try {
        const token = await getToken()
        if (!token) return
        const response = await fetch(`${API_BASE_URL}/settings/demo-usage?feature=${encodeURIComponent(feature)}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) setUsage(data)
      } catch { /* Usage display is non-blocking; the backend remains authoritative. */ }
    }
    void load()
    const interval = window.setInterval(load, 30_000)
    window.addEventListener('focus', load)
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', load) }
  }, [feature, getToken, isSignedIn])

  if (!usage || usage.mode !== 'demo') return null
  return <aside aria-label={`${usage.label} demo usage`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text-soft)', fontSize: 12, fontWeight: 700 }}>
    <span>Demo usage: {usage.used} / {usage.limit} used today</span>
    <strong style={{ color: usage.remaining === 0 ? '#ef4444' : 'var(--gold)' }}>{usage.remaining} remaining</strong>
  </aside>
}
