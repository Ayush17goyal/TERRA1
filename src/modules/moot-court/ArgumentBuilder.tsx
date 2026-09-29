import React, { useState } from 'react'
import { useMootSuite } from './MootSuiteContext'
import {
  GitBranch,
  Plus,
  Trash2,
  Scale,
  ExternalLink,
  ChevronRight,
  BookOpen
} from 'lucide-react'

export default function ArgumentBuilder() {
  const { userMemory, updateCaseMemory, setActiveSubTab, setSelectedSimilarityQuery } = useMootSuite()
  
  const [argTitle, setArgTitle] = useState('')
  const [argCitation, setArgCitation] = useState('')

  const handleAddArgument = (e: React.FormEvent) => {
    e.preventDefault()
    if (!argTitle.trim()) return

    const newArg = {
      id: `arg-${Date.now()}`,
      title: argTitle.trim(),
      citation: argCitation.trim() || 'No Citation Added'
    }

    updateCaseMemory({
      coreArguments: [...userMemory.coreArguments, newArg]
    })

    setArgTitle('')
    setArgCitation('')
  }

  const handleDeleteArgument = (id: string) => {
    const updated = userMemory.coreArguments.filter(a => a.id !== id)
    updateCaseMemory({ coreArguments: updated })
  }

  const triggerSimilaritySearch = (precedentName: string) => {
    setSelectedSimilarityQuery(precedentName)
    setActiveSubTab('JudgmentSimilarity')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both' }}>
      
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch style={{ color: 'var(--gold)' }} size={22} /> Argument Builder AI™
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
          Map the logical structure of your pleading, organize contentions, and link authoritative citations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
        
        {/* Left Panel: Add Contention Form */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px', height: 'fit-content' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add New Contention
          </h4>

          <form onSubmit={handleAddArgument} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                Argument Contention Title
              </label>
              <input
                type="text"
                value={argTitle}
                onChange={(e) => setArgTitle(e.target.value)}
                placeholder="e.g. State regulations exceed procedural bounds"
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', outline: 'none', fontSize: '0.84rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                Supporting Precedent / Citation
              </label>
              <input
                type="text"
                value={argCitation}
                onChange={(e) => setArgCitation(e.target.value)}
                placeholder="e.g. Article 21, Kesavananda Bharati (1973)"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'rgba(0,0,0,0.15)', color: 'var(--text)', outline: 'none', fontSize: '0.84rem' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '0.86rem', fontWeight: '800', marginTop: '4px', cursor: 'pointer' }}
            >
              Add Argument Node
            </button>
          </form>
        </div>

        {/* Right Panel: Logical Argument Tree Map */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0 }}>
            Argument Outlines Structure
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '350px' }}>
            {userMemory.coreArguments.map((arg, idx) => (
              <div
                key={arg.id}
                style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--gold)' }}>
                    CONTENTION #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteArgument(arg.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#d83838'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-soft)'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <strong style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: '1.3' }}>
                  {arg.title}
                </strong>

                {arg.citation && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BookOpen size={12} style={{ color: 'var(--gold)' }} />
                      Authority: <strong>{arg.citation}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => triggerSimilaritySearch(arg.citation)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      Verify Citation <ExternalLink size={10} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {userMemory.coreArguments.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '30px' }}>
                No core contentions mapped yet. Use the form on the left to structure your argument hierarchy.
              </p>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
