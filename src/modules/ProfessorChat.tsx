import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, BookOpen, Scale, Lightbulb, FileText } from 'lucide-react'
import { API_BASE_URL } from '../lib/api'

type Props = { apiToken: string }

type Source = 'corpus' | 'knowledge' | 'hybrid' | 'none'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  display: string
  streaming: boolean
  act?: string
  source?: Source
  lowConfidence?: boolean
}

// ─── Rotating placeholders ────────────────────────────────────────────────────
const PLACEHOLDERS = [
  'What is Mens Rea?',
  'Explain Kesavananda Bharati case',
  'Explain Section 300 BNS',
  'Difference between Murder and Culpable Homicide',
  'Draft a Legal Notice',
  'Research Right to Privacy in India',
  'Prepare notes on Article 21',
  'Ask me MCQs on Contract Law',
  'Prepare one-page revision notes on Torts',
  'What is anticipatory bail under BNSS?',
  'Explain doctrine of res judicata',
  'Explain Vishaka v State of Rajasthan',
]

// ─── Inline markdown renderer ─────────────────────────────────────────────────
function inline(raw: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g
  let cur = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(raw)) !== null) {
    if (m.index > cur) nodes.push(raw.slice(cur, m.index))
    if (m[1])      nodes.push(<strong key={k++}>{m[2]}</strong>)
    else if (m[3]) nodes.push(<em key={k++}>{m[4]}</em>)
    else if (m[5]) nodes.push(<code key={k++} className="pc-inline-code">{m[6]}</code>)
    cur = m.index + m[0].length
  }
  if (cur < raw.length) nodes.push(raw.slice(cur))
  return <>{nodes}</>
}

function ProfMD({ text, streaming }: { text: string; streaming: boolean }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let listBuf: React.ReactNode[] = []
  let numBuf: React.ReactNode[] = []
  let lk = 0
  const flushUl = () => { if (listBuf.length) { out.push(<ul key={`ul${lk++}`}>{listBuf}</ul>); listBuf = [] } }
  const flushOl = () => { if (numBuf.length) { out.push(<ol key={`ol${lk++}`}>{numBuf}</ol>); numBuf = [] } }
  const flush = () => { flushUl(); flushOl() }

  lines.forEach((ln, i) => {
    if (ln.startsWith('## '))        { flush(); out.push(<h2 key={i} className="pc-h2">{inline(ln.slice(3))}</h2>) }
    else if (ln.startsWith('### '))  { flush(); out.push(<h3 key={i} className="pc-h3">{inline(ln.slice(4))}</h3>) }
    else if (ln.startsWith('#### ')) { flush(); out.push(<h4 key={i} className="pc-h4">{inline(ln.slice(5))}</h4>) }
    else if (ln.startsWith('> '))    { flush(); out.push(<blockquote key={i} className="pc-bq">{inline(ln.slice(2))}</blockquote>) }
    else if (/^[-*]\s/.test(ln))     { flushOl(); listBuf.push(<li key={i}>{inline(ln.slice(2))}</li>) }
    else if (/^\d+\.\s/.test(ln))    { flushUl(); numBuf.push(<li key={i}>{inline(ln.replace(/^\d+\.\s/, ''))}</li>) }
    else if (!ln.trim())             { flush() }
    else                             { flush(); out.push(<p key={i}>{inline(ln)}</p>) }
  })
  flush()
  return (
    <div className="pc-md">
      {out}
      {streaming && <span className="pc-cursor">▊</span>}
    </div>
  )
}

// ─── Act badge ────────────────────────────────────────────────────────────────
function ActBadge({ act }: { act?: string }) {
  if (!act || act === 'UNKNOWN') return null
  const slug = act.toLowerCase().replace(/\s+/g, '-')
  return <span className={`pc-act-badge pc-act-badge--${slug}`}>{act}</span>
}

// ─── Source badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source }: { source?: Source }) {
  if (!source || source === 'none') return null
  const config: Record<Source, { label: string; cls: string }> = {
    corpus:    { label: '✓ From Indexed Corpus',        cls: 'pc-src--corpus' },
    hybrid:    { label: '◑ Corpus + General Knowledge', cls: 'pc-src--hybrid' },
    knowledge: { label: '⚠ General Legal Knowledge',   cls: 'pc-src--knowledge' },
    none:      { label: '',                              cls: '' },
  }
  const { label, cls } = config[source]
  if (!label) return null
  return <span className={`pc-src-badge ${cls}`}>{label}</span>
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: <Scale size={13} />, label: 'What is Mens Rea?' },
  { icon: <BookOpen size={13} />, label: 'Explain Article 21 Constitution' },
  { icon: <FileText size={13} />, label: 'Explain Section 300 BNS' },
  { icon: <Lightbulb size={13} />, label: 'Explain Kesavananda Bharati case' },
  { icon: <Scale size={13} />, label: 'Difference between Murder and Culpable Homicide' },
  { icon: <BookOpen size={13} />, label: 'Draft a Legal Notice' },
  { icon: <FileText size={13} />, label: 'Prepare notes on Article 14' },
  { icon: <Lightbulb size={13} />, label: 'Ask me MCQs on Contract Law' },
]

function Landing({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <div className="pc-landing">
      <img src="/Legatrixon logo.jpg" alt="LEGATRIXON" className="pc-landing-logo" />
      <div className="pc-landing-brand">
        <span className="pc-landing-brand-name">LexMentor AI</span>
      </div>
      <p className="pc-landing-sub">
        Your specialized legal intelligence assistant — ask any law question, analyze cases, draft documents, or prepare for judiciary exams.
      </p>
      <div className="pc-suggestions">
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            type="button"
            className="pc-chip"
            onClick={() => onSuggest(s.label)}
          >
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className="pc-supported-types">
        <span>Supports:</span>
        <span className="pc-tag">Concepts</span>
        <span className="pc-tag">Case Analysis</span>
        <span className="pc-tag">Bare Acts</span>
        <span className="pc-tag">Legal Drafting</span>
        <span className="pc-tag">Comparisons</span>
        <span className="pc-tag">MCQ Practice</span>
        <span className="pc-tag">Revision Notes</span>
        <span className="pc-tag">Judiciary Prep</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProfessorChat({ apiToken }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [phIdx, setPhIdx] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef     = useRef<HTMLTextAreaElement>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (messages.length > 0) return
    const t = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 3000)
    return () => clearInterval(t)
  }, [messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const typewrite = useCallback((id: string, full: string) => {
    let pos = 0
    const step = () => {
      pos = Math.min(pos + 8, full.length)
      const done = pos >= full.length
      setMessages(prev => prev.map(m => m.id === id ? { ...m, display: full.slice(0, pos), streaming: !done } : m))
      if (!done) timerRef.current = setTimeout(step, 10)
    }
    timerRef.current = setTimeout(step, 10)
  }, [])

  const resize = () => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const send = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const uid = `u-${Date.now()}`
    setMessages(prev => [...prev, { id: uid, role: 'user', content: msg, display: msg, streaming: false }])
    setInput('')
    if (taRef.current) { taRef.current.style.height = 'auto' }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/legal-intelligence/bare-act/professor-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        body: JSON.stringify({ userInput: msg, history }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const aid = `a-${Date.now()}`
      setMessages(prev => [...prev, {
        id: aid, role: 'assistant',
        content: data.response, display: '', streaming: true,
        act: data.act, source: data.source, lowConfidence: data.lowConfidence,
      }])
      setLoading(false)
      typewrite(aid, data.response)
    } catch (err) {
      setLoading(false)
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`, role: 'assistant',
        content: 'Something went wrong. Please try again.',
        display: 'Something went wrong. Please try again.',
        streaming: false,
      }])
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const empty = messages.length === 0 && !loading

  return (
    <div className="pc-root">
      <div className={`pc-body ${empty ? 'pc-body--empty' : ''}`}>
        {empty && <Landing onSuggest={s => { setInput(s); send(s) }} />}

        {messages.map(msg => (
          <div key={msg.id} className={`pc-msg pc-msg--${msg.role}`}>
            {msg.role === 'user' ? (
              <div className="pc-user-bub">{msg.content}</div>
            ) : (
              <div className="pc-ai-bub">
                <div className="pc-meta-row">
                  <ActBadge act={msg.act} />
                  <SourceBadge source={msg.source} />
                </div>
                <ProfMD text={msg.display} streaming={msg.streaming} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="pc-msg pc-msg--assistant">
            <div className="pc-ai-bub pc-ai-bub--thinking">
              <div className="pc-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="pc-inp-wrap">
        <div className="pc-inp-box">
          <textarea
            ref={taRef}
            className="pc-inp-ta"
            value={input}
            onChange={e => { setInput(e.target.value); resize() }}
            onKeyDown={onKey}
            placeholder={empty ? PLACEHOLDERS[phIdx] : 'Ask a follow-up…'}
            rows={1}
            disabled={loading}
          />
          <button
            type="button"
            className={`pc-send${!input.trim() || loading ? ' pc-send--off' : ''}`}
            onClick={() => send()}
            disabled={!input.trim() || loading}
            aria-label="Send"
          >
            <ArrowUp size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
