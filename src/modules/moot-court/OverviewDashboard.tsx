import React from 'react'
import { useMootSuite } from './MootSuiteContext'
import {
  Gavel,
  BookOpen,
  GitBranch,
  Volume2,
  Search,
  Fingerprint,
  BarChart3,
  BrainCircuit,
  Scale,
  Award,
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react'

export default function OverviewDashboard() {
  const { userMemory, mootHistory, researchHistory, setActiveSubTab } = useMootSuite()

  const modules = [
    {
      id: 'BenchSimulator',
      title: 'AI Bench Simulator™',
      desc: 'Simulate high-pressure courtroom hearings against customized judge temperaments.',
      icon: <Gavel size={20} />,
      progress: 88,
      stat: `${mootHistory.length} Session(s) logged`,
      color: 'var(--gold)'
    },
    {
      id: 'MemorialArchitect',
      title: 'Memorial Architect AI™',
      desc: 'Draft comprehensive petitioner/respondent memorials with proper citation formatting.',
      icon: <BookOpen size={20} />,
      progress: 92,
      stat: `${userMemory.coreArguments.length} Argument nodes ready`,
      color: '#3498db'
    },
    {
      id: 'ArgumentBuilder',
      title: 'Argument Builder AI™',
      desc: 'Structure logical argument flow, map statutory citations, and construct outlines.',
      icon: <GitBranch size={20} />,
      progress: 78,
      stat: '2 core contentions active',
      color: '#9b59b6'
    },
    {
      id: 'OralArgumentCoach',
      title: 'Oral Argument Coach™',
      desc: 'Analyze oral delivery: tracking pacing, volume levels, tone profiles, and filler words.',
      icon: <Volume2 size={20} />,
      progress: 65,
      stat: 'Awaiting voice audit',
      color: '#e74c3c'
    },
    {
      id: 'LegalResearchTrainer',
      title: 'Legal Research Trainer™',
      desc: 'Practice finding landmark precedents, verifying authority levels, and extracting ratios.',
      icon: <Search size={20} />,
      progress: 84,
      stat: `${researchHistory.length} Precedent(s) tracked`,
      color: '#2ecc71'
    },
    {
      id: 'JudgmentSimilarity',
      title: 'Judgment Similarity Engine™',
      desc: 'Run vector-based similarity checks on precedents to map potential contradictory judgments.',
      icon: <Fingerprint size={20} />,
      progress: 75,
      stat: 'Vector database online',
      color: '#f1c40f'
    },
    {
      id: 'MootAnalytics',
      title: 'Moot Analytics™',
      desc: 'Review trend charts of advocacy, reasoning, manner, and research over active sessions.',
      icon: <BarChart3 size={20} />,
      progress: 90,
      stat: 'Performance indices generated',
      color: '#1abc9c'
    },
    {
      id: 'BenchIntelligence',
      title: 'Bench Intelligence™ Dashboard',
      desc: 'Central memory hub configuring court variables, case files, and judge profiles.',
      icon: <BrainCircuit size={20} />,
      progress: 95,
      stat: 'Active context synchronised',
      color: '#e67e22'
    }
  ]

  // Calculate stats
  const averageAdvocacy = mootHistory.length > 0 
    ? Math.round(mootHistory.reduce((sum, s) => sum + s.advocacyScore, 0) / mootHistory.length)
    : 0
  const averageReasoning = mootHistory.length > 0 
    ? Math.round(mootHistory.reduce((sum, s) => sum + s.reasoningScore, 0) / mootHistory.length)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'reveal-up 350ms ease-out both' }}>
      
      {/* Top Banner: Welcome + Active Case Context */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', background: 'var(--panel)', border: '1px solid var(--line)', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Moot Court Suite Workspace</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '4px 0 8px 0', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff 0%, var(--text-soft) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Appellate Strategy Console
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', lineHeight: '1.45', margin: 0 }}>
            Prepare appellate memorials, simulate arguments against customized benches, run citation similarity indexing, and track dashboard diagnostics.
          </p>
        </div>
        
        {/* Active Case Specs Badge */}
        <div className="glass-card" style={{ padding: '12px 16px', background: 'rgba(245, 193, 79, 0.03)', border: '1px dashed var(--gold)', borderRadius: '8px', minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Scale size={14} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--gold)', textTransform: 'uppercase' }}>Active Case Brief</span>
          </div>
          <strong style={{ display: 'block', fontSize: '0.86rem', color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '240px' }}>
            {userMemory.activeCaseName}
          </strong>
          <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', marginTop: '2px' }}>
            Party: <strong>{userMemory.party}</strong> | Domain: <strong>{userMemory.domain}</strong>
          </span>
        </div>
      </div>

      {/* Performance Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="glass-card" style={{ padding: '12px 16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(245, 193, 79, 0.08)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)' }}>Avg Advocacy Score</span>
            <strong style={{ display: 'block', fontSize: '1.15rem', color: 'var(--text)' }}>{averageAdvocacy > 0 ? `${averageAdvocacy}%` : 'N/A'}</strong>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '12px 16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(52, 152, 219, 0.08)', color: '#3498db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Scale size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)' }}>Avg Reasoning Score</span>
            <strong style={{ display: 'block', fontSize: '1.15rem', color: 'var(--text)' }}>{averageReasoning > 0 ? `${averageReasoning}%` : 'N/A'}</strong>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '12px 16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(155, 89, 182, 0.08)', color: '#9b59b6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)' }}>Draft Core Arguments</span>
            <strong style={{ display: 'block', fontSize: '1.15rem', color: 'var(--text)' }}>{userMemory.coreArguments.length}</strong>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '12px 16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(46, 204, 113, 0.08)', color: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Search size={20} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)' }}>Linked Precedents</span>
            <strong style={{ display: 'block', fontSize: '1.15rem', color: 'var(--text)' }}>{researchHistory.length}</strong>
          </div>
        </div>
      </div>

      {/* Main Suite Grid: Cards with progress bars */}
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <TrendingUp size={16} /> Suite Sub-Modules
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '14px' }}>
          {modules.map((m) => (
            <div
              key={m.id}
              onClick={() => setActiveSubTab(m.id)}
              className="glass-card"
              style={{
                padding: '16px',
                background: 'var(--panel)',
                border: '1px solid var(--line)',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.borderColor = m.color
                e.currentTarget.style.boxShadow = `0 4px 20px rgba(0, 0, 0, 0.25)`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.borderColor = 'var(--line)'
                e.currentTarget.style.boxShadow = 'var(--shadow)'
              }}
            >
              {/* Card Title & Icon */}
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', color: m.color }}>
                    {m.icon}
                  </div>
                  <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
                    {m.title}
                  </h4>
                </div>
                <ArrowRight size={14} style={{ color: 'var(--text-soft)' }} />
              </div>

              {/* Card Description */}
              <p style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-soft)', margin: 0, flex: 1 }}>
                {m.desc}
              </p>

              {/* Progress and status */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span style={{ color: 'var(--text-soft)' }}>{m.stat}</span>
                  <span style={{ fontWeight: '700', color: 'var(--text)' }}>Progress: {m.progress}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${m.progress}%`, height: '100%', background: m.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Logs */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0' }}>
          <Clock size={16} /> Recent Activity Timeline
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mootHistory.map((sess) => (
            <div key={sess.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.015)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Gavel size={16} style={{ color: 'var(--gold)' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.84rem', color: 'var(--text)' }}>
                    Simulated hearing in {sess.caseName}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>
                    Date: {sess.date} | Domain: {sess.domain}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-soft)' }}>Advocacy Rating</span>
                  <strong style={{ display: 'block', fontSize: '0.86rem', color: 'var(--gold)' }}>{sess.advocacyScore}/100</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setActiveSubTab('BenchSimulator')}
                  style={{ padding: '4px 10px', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  View Transcript
                </button>
              </div>
            </div>
          ))}

          {mootHistory.length === 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '14px' }}>
              No moot sessions recorded. Open the AI Bench Simulator to begin.
            </p>
          )}
        </div>
      </div>
      
    </div>
  )
}
