import React from 'react'
import { useMootSuite } from './MootSuiteContext'
import {
  BrainCircuit,
  Scale,
  BookOpen,
  Fingerprint,
  GitBranch,
  Search,
  Settings,
  Edit,
  CheckCircle2,
  FileText
} from 'lucide-react'

export default function BenchIntelligence() {
  const { userMemory, updateCaseMemory, mootHistory, researchHistory } = useMootSuite()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BrainCircuit style={{ color: 'var(--gold)' }} size={22} /> Bench Intelligence™ Dashboard
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
          Central memory engine — view and edit all case parameters, linked citations, argument nodes, and session state.
        </p>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Active Case Brief */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Scale size={16} /> Active Case Parameters
          </h4>

          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { label: 'Case Name', value: userMemory.activeCaseName },
              { label: 'Jurisdiction', value: userMemory.jurisdiction },
              { label: 'Drafting Party', value: userMemory.party },
              { label: 'Legal Domain', value: userMemory.domain }
            ].map(item => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: 'rgba(0,0,0,0.1)',
                  border: '1px solid var(--line)',
                  borderRadius: '6px'
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>{item.label}</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</strong>
              </div>
            ))}
          </div>

          {/* Compromis Preview */}
          <div>
            <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
              Factual Compromis Summary
            </span>
            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.12)', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-soft)', lineHeight: '1.4', maxHeight: '120px', overflowY: 'auto' }}>
              {userMemory.compromis || 'No compromis data configured.'}
            </div>
          </div>
        </div>

        {/* Session Diagnostics */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={16} /> Session Diagnostics
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ padding: '12px', background: 'rgba(245,193,79,0.03)', border: '1px solid var(--line)', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Total Sessions</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: 'var(--gold)', marginTop: '4px' }}>{mootHistory.length}</strong>
            </div>
            <div style={{ padding: '12px', background: 'rgba(52,152,219,0.03)', border: '1px solid var(--line)', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Linked Citations</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: '#3498db', marginTop: '4px' }}>{researchHistory.length}</strong>
            </div>
            <div style={{ padding: '12px', background: 'rgba(46,204,113,0.03)', border: '1px solid var(--line)', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Core Arguments</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: '#2ecc71', marginTop: '4px' }}>{userMemory.coreArguments.length}</strong>
            </div>
            <div style={{ padding: '12px', background: 'rgba(155,89,182,0.03)', border: '1px solid var(--line)', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Context Sync</span>
              <strong style={{ display: 'block', fontSize: '1.4rem', color: '#9b59b6', marginTop: '4px' }}>Active</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', background: 'rgba(46,204,113,0.04)', border: '1px solid rgba(46,204,113,0.15)', padding: '8px 10px', borderRadius: '6px', fontSize: '0.74rem', color: '#2ecc71', alignItems: 'center' }}>
            <CheckCircle2 size={14} />
            <span>All modules are synchronised to the active case context.</span>
          </div>
        </div>
      </div>

      {/* Bottom section: Argument Nodes & Citations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Active Arguments */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitBranch size={16} /> Core Argument Nodes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {userMemory.coreArguments.map((arg, idx) => (
              <div key={arg.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--gold)', flexShrink: 0 }}>#{idx + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{arg.title}</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>Cite: {arg.citation}</span>
                </div>
              </div>
            ))}
            {userMemory.coreArguments.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '20px' }}>
                No arguments configured. Use the Argument Builder to create them.
              </p>
            )}
          </div>
        </div>

        {/* Linked Citations */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} /> Linked Precedent Citations
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {researchHistory.map(cit => (
              <div key={cit.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 10px', background: 'rgba(245,193,79,0.02)', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <Fingerprint size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cit.caseName}</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>{cit.citation} | Similarity: {cit.similarityScore}%</span>
                </div>
              </div>
            ))}
            {researchHistory.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '20px' }}>
                No citations linked. Use the Legal Research Trainer or Similarity Engine.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
