import { useState, type ReactNode } from 'react'
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, Loader2, ShieldCheck } from 'lucide-react'
import { API_BASE_URL } from '../lib/api'

type RetrievedAuthority = {
  id?: string
  title?: string
  citation?: string
  collection?: string
  court?: string
  date?: string
  section?: string
  article?: string
  page?: string
  rerankerScore?: number
  retrievalScore?: number
  authorityStrength?: number
  chunkText?: string
}

type SupportingCitation = {
  citation?: string
  type?: string
  support?: string
  excerpt?: string
}

type VerificationResult = {
  available?: boolean
  authorityStatus?: string
  goodLawStatus?: string
  recentAmendments?: string
  conflictingJudgments?: string
  bindingAuthority?: string
  bindingCourt?: string
  citationAccuracy?: number
  confidenceScore?: number
  riskLevel?: string
  lastVerified?: string
  verificationTimestamp?: string
  professionalSummary?: string
  unsupportedReasoning?: string[]
  citationValidation?: { citation: string; status: string; paragraphSupport: string }[]
  details?: Record<string, string | undefined>
  sources?: Array<{
    name?: string
    type?: string
    authorityLevel?: string
    date?: string
    status?: string
    isValid?: boolean
  }>
}

type Props = {
  apiToken: string
  query: string
  answer: string
  citations?: Array<string | SupportingCitation>
  retrievedAuthorities?: RetrievedAuthority[]
  verification?: VerificationResult | null
}

export default function VerificationCard({ apiToken, query, answer, citations = [], retrievedAuthorities = [], verification = null }: Props) {
  const [result, setResult] = useState<VerificationResult | null>(verification?.available ? verification : null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const [authoritiesExpanded, setAuthoritiesExpanded] = useState(false)
  const [citationsExpanded, setCitationsExpanded] = useState(false)
  const [error, setError] = useState('')

  const hasAuthorities = Array.isArray(retrievedAuthorities) && retrievedAuthorities.length > 0
  if (!answer || !hasAuthorities) return null

  const supportingCitations = citations
    .map((item) => typeof item === 'string' ? { citation: item } : item)
    .filter((item) => item?.citation)

  const loadVerification = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }

    setExpanded(true)
    setError('')
    if (result) return

    if (verification?.available) {
      setResult(verification)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/legal-intelligence/authority-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ query, answer, citations, retrievedAuthorities }),
      })

      if (!response.ok) throw new Error('Verification service is unavailable.')
      const data = await response.json()
      if (!data?.available) throw new Error(data?.professionalSummary || 'Verification requires retrieved legal authorities.')
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Verification could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  const risk = result?.riskLevel?.toLowerCase()
  const accent = risk === 'high' ? '#ff4757' : risk === 'medium' ? 'var(--gold)' : '#2ed573'
  const metricRows = [
    ['Good Law Status', result?.goodLawStatus],
    ['Recent Amendments', result?.recentAmendments],
    ['Conflicting Judgments', result?.conflictingJudgments],
    ['Binding Authority', result?.bindingAuthority || result?.bindingCourt],
    ['Citation Accuracy', typeof result?.citationAccuracy === 'number' ? `${result.citationAccuracy}%` : undefined],
    ['Confidence Score', typeof result?.confidenceScore === 'number' ? `${result.confidenceScore}%` : undefined],
    ['Risk Level', result?.riskLevel],
    ['Last Verified', result?.lastVerified || result?.verificationTimestamp],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')

  return (
    <div style={{ marginTop: '10px' }}>
      <button
        type="button"
        onClick={loadVerification}
        style={{
          border: '1px solid rgba(143,100,18,0.24)',
          background: 'rgba(245,193,79,0.08)',
          color: 'var(--gold)',
          borderRadius: '6px',
          padding: '7px 10px',
          fontSize: '0.74rem',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <ShieldCheck size={14} />
        {expanded ? 'Hide Verification' : 'Verify Authorities'}
      </button>

      {expanded && (
        <div
          className="glass-card reveal-up"
          style={{
            marginTop: '10px',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={17} style={{ color: accent }} />
              <strong style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Authority Verification</strong>
            </div>
            {loading && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--gold)', fontSize: '0.76rem', fontWeight: 700 }}><Loader2 size={13} className="animate-spin" /> Verifying</span>}
            {!loading && result?.riskLevel && <span style={{ color: accent, fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>{result.riskLevel} Risk</span>}
          </div>

          {error && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#ff4757', fontSize: '0.78rem' }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {result && !loading && (
            <>
              {result.professionalSummary && <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.8rem', lineHeight: 1.45 }}>{result.professionalSummary}</p>}

              {metricRows.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  {metricRows.map(([label, value]) => (
                    <div key={label} style={{ border: '1px solid var(--line)', borderRadius: '6px', padding: '8px', background: 'rgba(0,0,0,0.08)' }}>
                      <span style={{ display: 'block', color: 'var(--text-soft)', fontSize: '0.62rem', textTransform: 'uppercase', fontWeight: 800 }}>{label}</span>
                      <strong style={{ display: 'block', color: label === 'Risk Level' ? accent : 'var(--text)', fontSize: '0.76rem', marginTop: '2px' }}>{String(value)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {!!result.unsupportedReasoning?.length && (
                <div style={{ display: 'grid', gap: '6px' }}>
                  {result.unsupportedReasoning.map((warning, index) => (
                    <div key={index} style={{ display: 'flex', gap: '8px', color: '#ff4757', fontSize: '0.76rem' }}>
                      <AlertTriangle size={13} /> {warning}
                    </div>
                  ))}
                </div>
              )}

              <Toggle title="Verification Details" expanded={detailsExpanded} setExpanded={setDetailsExpanded}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  {Object.entries(result.details || {}).filter(([, value]) => value).map(([key, value]) => (
                    <div key={key} style={{ border: '1px solid var(--line)', borderRadius: '6px', padding: '8px' }}>
                      <strong style={{ display: 'block', color: 'var(--gold)', fontSize: '0.68rem', textTransform: 'uppercase' }}>{key.replace(/([A-Z])/g, ' $1')}</strong>
                      <span style={{ color: 'var(--text-soft)', fontSize: '0.78rem' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </Toggle>

              <Toggle title="Verification Sources" expanded={sourcesExpanded} setExpanded={setSourcesExpanded}>
                <SourceList sources={result.sources || []} />
              </Toggle>
            </>
          )}

          <Toggle title="Retrieved Authorities" expanded={authoritiesExpanded} setExpanded={setAuthoritiesExpanded}>
            <AuthorityList authorities={retrievedAuthorities} />
          </Toggle>

          <Toggle title="Supporting Citations" expanded={citationsExpanded} setExpanded={setCitationsExpanded}>
            <CitationList citations={supportingCitations} />
          </Toggle>
        </div>
      )}
    </div>
  )
}

function Toggle({ title, expanded, setExpanded, children }: { title: string; expanded: boolean; setExpanded: (value: boolean) => void; children: ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
      <button type="button" onClick={() => setExpanded(!expanded)} style={{ border: 'none', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem', fontWeight: 800 }}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {title}
      </button>
      {expanded && <div style={{ marginTop: '8px' }}>{children}</div>}
    </div>
  )
}

function AuthorityList({ authorities }: { authorities: RetrievedAuthority[] }) {
  if (!authorities.length) return <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.78rem' }}>No retrieved authorities available.</p>
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {authorities.map((authority, index) => (
        <div key={authority.id || index} style={{ border: '1px solid var(--line)', borderRadius: '6px', padding: '9px', background: 'rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <BookOpen size={13} style={{ color: 'var(--gold)' }} />
            <strong style={{ fontSize: '0.8rem' }}>{authority.citation || authority.title}</strong>
            <span style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>{authority.collection}</span>
          </div>
          <p style={{ margin: '5px 0 0', color: 'var(--text-soft)', fontSize: '0.76rem', lineHeight: 1.4 }}>{authority.chunkText?.slice(0, 260)}</p>
        </div>
      ))}
    </div>
  )
}

function SourceList({ sources }: { sources: VerificationResult['sources'] }) {
  if (!sources?.length) return <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.78rem' }}>No verification sources returned.</p>
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {sources.map((source, index) => (
        <div key={index} style={{ border: '1px solid var(--line)', borderRadius: '6px', padding: '9px' }}>
          <strong style={{ fontSize: '0.8rem' }}>{source.name}</strong>
          <div style={{ color: 'var(--text-soft)', fontSize: '0.72rem', marginTop: '3px' }}>{source.type} {source.authorityLevel ? `- ${source.authorityLevel}` : ''} {source.status ? `- ${source.status}` : ''}</div>
        </div>
      ))}
    </div>
  )
}

function CitationList({ citations }: { citations: SupportingCitation[] }) {
  if (!citations.length) return <p style={{ margin: 0, color: 'var(--text-soft)', fontSize: '0.78rem' }}>No supporting citations extracted.</p>
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {citations.map((citation, index) => (
        <div key={index} style={{ color: 'var(--text-soft)', fontSize: '0.77rem' }}>
          <strong style={{ color: 'var(--text)' }}>{citation.citation}</strong> {citation.type ? `(${citation.type})` : ''} {citation.support ? `- ${citation.support}` : ''}
        </div>
      ))}
    </div>
  )
}
