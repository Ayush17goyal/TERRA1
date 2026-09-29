import React, { useState, useRef, useEffect } from 'react'
import { useMootSuite } from './MootSuiteContext'
import {
  Gavel,
  MessageSquare,
  Award,
  ChevronRight,
  BookOpen,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Scale
} from 'lucide-react'

export default function BenchSimulator() {
  const { userMemory, mootHistory, addMootSession, setActiveSubTab, setSelectedSimilarityQuery } = useMootSuite()
  
  const [judgeTemperament, setJudgeTemperament] = useState<'Scholarly' | 'Hostile' | 'Passive'>('Scholarly')
  const [mootArg, setMootArg] = useState('')
  const [isMooting, setIsMooting] = useState(false)
  
  const [activeSessionTranscript, setActiveSessionTranscript] = useState<Array<{ role: 'user' | 'judge'; text: string }>>([
    { role: 'judge', text: 'Counsel, you may begin your pleadings. We are listening.' }
  ])

  const [currentScores, setCurrentScores] = useState<{
    confidence: number
    reasoning: number
    research: number
    manner: number
  } | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSessionTranscript, isMooting])

  const handleMootSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!mootArg.trim() || isMooting) return

    const userText = mootArg.trim()
    setMootArg('')
    setIsMooting(true)

    // Add user pleading to transcript
    setActiveSessionTranscript(prev => [...prev, { role: 'user', text: userText }])

    // Generate simulated judge response based on case memory and user's query
    setTimeout(() => {
      let judgeReply = ''
      const lower = userText.toLowerCase()

      if (judgeTemperament === 'Hostile') {
        if (lower.includes('basic structure') || lower.includes('368')) {
          judgeReply = 'Counsel, are you suggesting this Bench can rewrite Article 368? The power to amend is wide. Where is your structural authority that binds our hands on procedural rules? Show us a direct precedent!'
        } else if (lower.includes('judicial review') || lower.includes('226')) {
          judgeReply = 'You speak of Article 226 as if it is absolute, Counsel. But does not the legislature have authority to frame administrative directives to filter frivolous litigations? Why is judicial access blocked if alternative remedies exist?'
        } else {
          judgeReply = 'Counsel, you rely heavily on broad assertions! Explain to this Bench the exact legal basis of your claim. Your current arguments lack authority!'
        }
      } else if (judgeTemperament === 'Scholarly') {
        if (lower.includes('basic structure') || lower.includes('kesavananda')) {
          judgeReply = 'A persuasive line of thought, Counsel. But how do you reconcile this with the Golaknath ratio? If the constituent amending power is supreme, why must we restrict the legislature under the guise of an unwritten basic structure?'
        } else if (lower.includes('judicial review') || lower.includes('minerva')) {
          judgeReply = 'True, Minerva Mills (1980) places judicial review on a high pedestal. But how does this regulation destroy that feature? It merely streamlines accessibility, does it not? Please elaborate.'
        } else {
          judgeReply = 'Interesting submission. However, how does this align with the rule of statutory harmony? We must balance state security and fundamental liberties. Please address that balance.'
        }
      } else {
        // Passive
        judgeReply = 'We note your submission, Counsel. Please proceed to your next argument concerning the constitutional maintainability of alternative remedies.'
      }

      setActiveSessionTranscript(prev => [...prev, { role: 'judge', text: judgeReply }])
      setIsMooting(false)

      // Grade the submission
      const baseScore = userText.length > 40 ? 82 : 68
      const calculatedScores = {
        confidence: Math.round(baseScore + Math.random() * 12),
        reasoning: Math.round(baseScore + Math.random() * 15),
        research: Math.round(baseScore + Math.random() * 10),
        manner: Math.round(baseScore + Math.random() * 12)
      }
      setCurrentScores(calculatedScores)

      // Automatically push this simulation to the history log
      const newSession = {
        id: `sess-${Date.now()}`,
        caseName: userMemory.activeCaseName,
        domain: userMemory.domain,
        date: new Date().toISOString().split('T')[0],
        advocacyScore: calculatedScores.confidence,
        reasoningScore: calculatedScores.reasoning,
        researchScore: calculatedScores.research,
        mannerScore: calculatedScores.manner,
        transcript: [...activeSessionTranscript, { role: 'user' as const, text: userText }, { role: 'judge' as const, text: judgeReply }]
      }
      addMootSession(newSession)
    }, 1500)
  }

  const handleResetSession = () => {
    setActiveSessionTranscript([
      { role: 'judge', text: 'Counsel, you may begin your pleadings. We are listening.' }
    ])
    setCurrentScores(null)
  }

  // Cross-link helper: Set query and navigate to Similarity tab
  const triggerSimilaritySearch = (precedentName: string) => {
    setSelectedSimilarityQuery(precedentName)
    setActiveSubTab('JudgmentSimilarity')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both' }}>
      
      {/* View Header */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gavel style={{ color: 'var(--gold)' }} size={22} /> AI Bench Simulator™
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
            Practice oral arguments, handle sudden judge interruptions, and receive immediate scoring.
          </p>
        </div>

        {/* Reset button */}
        <button
          type="button"
          onClick={handleResetSession}
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', cursor: 'pointer' }}
        >
          <RefreshCw size={12} /> Reset Bench
        </button>
      </div>

      {/* Simulator Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        
        {/* Left Column: Courtroom Dialogue */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '420px' }}>
          
          {/* Judge Temperament Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-soft)' }}>
              Configure Bench Disposition:
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['Scholarly', 'Hostile', 'Passive'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setJudgeTemperament(t)}
                  style={{
                    border: '1px solid var(--line)',
                    background: judgeTemperament === t ? 'var(--gold)' : 'transparent',
                    color: judgeTemperament === t ? '#1a1203' : 'var(--text-soft)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 150ms ease'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dialogue Log */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '300px', background: 'rgba(0,0,0,0.18)', padding: '12px', borderRadius: '10px', border: '1px solid var(--line)' }}>
            {activeSessionTranscript.map((dia, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  alignSelf: dia.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                <span style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {dia.role === 'user' ? 'Counsel (You)' : `Judge Bench [${judgeTemperament}]`}
                </span>
                <div
                  style={{
                    fontSize: '0.84rem',
                    lineHeight: '1.45',
                    background: dia.role === 'user' ? 'rgba(32, 52, 94, 0.12)' : 'rgba(143, 100, 18, 0.08)',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    color: 'var(--text)'
                  }}
                >
                  {dia.text}
                </div>
              </div>
            ))}
            
            {isMooting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', background: 'rgba(245,193,79,0.06)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <span className="pulse" style={{ color: 'var(--gold)' }}>●</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--gold)', fontStyle: 'italic' }}>
                  The Judge Bench is deliberating your submission...
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Argument Form */}
          <form onSubmit={handleMootSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={mootArg}
              onChange={(e) => setMootArg(e.target.value)}
              placeholder="Present your pleading (e.g. My Lords, we submit that the basic structure doctrine...)"
              disabled={isMooting}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'rgba(0,0,0,0.15)',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '0.86rem'
              }}
            />
            <button
              type="submit"
              disabled={!mootArg.trim() || isMooting}
              className="btn btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              Present <ChevronRight size={14} />
            </button>
          </form>
        </div>

        {/* Right Column: Analytics & Precedent Lookup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Real-time scorecard */}
          <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0' }}>
              <Award size={16} /> Oral Advocacy Scorecard
            </h4>
            
            {currentScores ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  { label: 'Advocacy Confidence', val: currentScores.confidence, color: 'var(--gold)' },
                  { label: 'Legal Reasoning', val: currentScores.reasoning, color: '#3498db' },
                  { label: 'Precedent Research', val: currentScores.research, color: '#2ecc71' },
                  { label: 'Courtroom Manner', val: currentScores.manner, color: '#e67e22' }
                ].map(metric => (
                  <div key={metric.label} style={{ display: 'grid', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                      <span style={{ color: 'var(--text-soft)' }}>{metric.label}</span>
                      <strong style={{ color: metric.color }}>{metric.val}%</strong>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${metric.val}%`, height: '100%', background: metric.color, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                ))}
                
                <div style={{ marginTop: '6px', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--line)', padding: '10px', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-soft)', lineHeight: '1.4' }}>
                  🚀 <strong>Bench Feedback:</strong> {judgeTemperament === 'Hostile' 
                    ? 'Good effort backing up under hostile queries. Incorporate more structural articles to reinforce core claims.' 
                    : 'Clear pleadings. Ensure transitions between issues are smooth and maintain constant eye contact.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', height: '150px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-soft)', fontSize: '0.8rem', textAlign: 'center', border: '1px dashed var(--line)', borderRadius: '8px' }}>
                ⚖️ Present your oral argument to the Bench to generate performance statistics.
              </div>
            )}
          </div>

          {/* Quick Precedent Search / Cross-link Widget */}
          <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Scale size={15} /> Precedent Quick Search
            </h4>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-soft)', margin: 0, lineHeight: '1.35' }}>
              Search conflicting precedents directly inside the vector engine to resolve judge objections:
            </p>
            
            <div style={{ display: 'grid', gap: '6px' }}>
              {[
                'Kesavananda Bharati v. State of Kerala (1973)',
                'Minerva Mills v. Union of India (1980)',
                'A.K. Gopalan v. State of Madras (1950)'
              ].map(caseName => (
                <button
                  key={caseName}
                  type="button"
                  onClick={() => triggerSimilaritySearch(caseName)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    color: 'var(--text)',
                    fontSize: '0.78rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 150ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 193, 79, 0.06)'
                    e.currentTarget.style.borderColor = 'var(--gold)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                    e.currentTarget.style.borderColor = 'var(--line)'
                  }}
                >
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {caseName}
                  </span>
                  <span style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: '700' }}>
                    Query <ArrowRight size={10} />
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
