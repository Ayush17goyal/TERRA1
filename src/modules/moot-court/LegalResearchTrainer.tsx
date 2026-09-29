import React, { useState } from 'react'
import { useMootSuite } from './MootSuiteContext'
import {
  Search,
  Plus,
  BookOpen,
  Scale,
  Award,
  Link2,
  Trash2,
  GitPullRequest,
  CheckCircle2,
  ExternalLink
} from 'lucide-react'

export default function LegalResearchTrainer() {
  const { researchHistory, addResearchCitation, setActiveSubTab, setSelectedSimilarityQuery } = useMootSuite()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Local static library of landmark precedents to query
  const precedentLibrary = [
    {
      caseName: 'Kesavananda Bharati v. State of Kerala (1973)',
      citation: '1973 4 SCC 225',
      court: 'Supreme Court of India',
      bench: '13-Judge constitutional bench',
      ratio: 'Constituent amending power under Article 368 cannot alter or destroy the Basic Structure of the Constitution.',
      similarity: 94
    },
    {
      caseName: 'Minerva Mills v. Union of India (1980)',
      citation: '1980 3 SCC 625',
      court: 'Supreme Court of India',
      bench: '5-Judge constitutional bench',
      ratio: 'Judicial review and the harmony between fundamental rights and state directive principles are basic features of the Constitution.',
      similarity: 91
    },
    {
      caseName: 'Maneka Gandhi v. Union of India (1978)',
      citation: '1978 1 SCC 248',
      court: 'Supreme Court of India',
      bench: '7-Judge constitutional bench',
      ratio: 'The procedure established by law under Article 21 must comply with principles of natural justice and be fair, just, and reasonable.',
      similarity: 88
    },
    {
      caseName: 'L. Chandra Kumar v. Union of India (1997)',
      citation: '1997 3 SCC 261',
      court: 'Supreme Court of India',
      bench: '7-Judge constitutional bench',
      ratio: 'The power of judicial review vested in High Courts under Article 226 and this Court under Article 32 is an essential feature forming the basic structure.',
      similarity: 89
    },
    {
      caseName: 'I.R. Coelho v. State of Tamil Nadu (2007)',
      citation: '2007 2 SCC 1',
      court: 'Supreme Court of India',
      bench: '9-Judge constitutional bench',
      ratio: 'Any law placed under the Ninth Schedule that violates Part III fundamental rights as tested by the basic structure doctrine is open to review.',
      similarity: 85
    }
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    
    setTimeout(() => {
      const q = searchQuery.toLowerCase()
      const filtered = precedentLibrary.filter(c => 
        c.caseName.toLowerCase().includes(q) || 
        c.citation.toLowerCase().includes(q) ||
        c.ratio.toLowerCase().includes(q)
      )
      setSearchResults(filtered)
      setIsSearching(false)
    }, 800)
  }

  const handleLinkPrecedent = (prec: typeof precedentLibrary[0]) => {
    // Check if already linked to prevent duplicate entries
    const exists = researchHistory.some(c => c.caseName === prec.caseName)
    if (exists) {
      alert('This precedent is already linked to your case memory!')
      return
    }

    const newCitation = {
      id: `cit-${Date.now()}`,
      caseName: prec.caseName,
      citation: prec.citation,
      similarityScore: prec.similarity,
      relevance: prec.ratio
    }
    
    addResearchCitation(newCitation)
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
          <Search style={{ color: 'var(--gold)' }} size={22} /> Legal Research Trainer™
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
          Practice querying landmark precedents, verify authority metrics, and build citation graphs.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        
        {/* Left Column: Precedent Retrieval Panel */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={16} /> Precedent Database Query
          </h4>

          {/* Search form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Query precedents (e.g. Basic structure, Judicial review, Article 21...)"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                background: 'rgba(0,0,0,0.15)',
                color: 'var(--text)',
                outline: 'none',
                fontSize: '0.84rem'
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.84rem', fontWeight: '800', cursor: 'pointer' }}
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Results List */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '280px' }}>
            {searchResults.map((prec, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--text)' }}>
                    {prec.caseName}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gold)', background: 'rgba(245,193,79,0.08)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                    {prec.citation}
                  </span>
                </div>

                <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)' }}>
                  Court: <strong>{prec.court}</strong> | Authority: <strong>{prec.bench}</strong>
                </span>

                <p style={{ fontSize: '0.78rem', lineHeight: '1.4', color: 'var(--text-soft)', margin: 0, paddingLeft: '8px', borderLeft: '2px solid var(--gold)' }}>
                  {prec.ratio}
                </p>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleLinkPrecedent(prec)}
                    className="btn btn-ghost"
                    style={{
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Link2 size={11} /> Link to Memory
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerSimilaritySearch(prec.caseName)}
                    className="btn btn-outline"
                    style={{
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Inspect Precedent <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            ))}

            {searchResults.length === 0 && !isSearching && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '30px' }}>
                Query the database to load relevant landmark authority references.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Active Linked Citations List */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitPullRequest size={16} /> Linked Case Citations
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '350px' }}>
            {researchHistory.map((cit) => (
              <div
                key={cit.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(245, 193, 79, 0.02)',
                  border: '1px solid var(--line)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {cit.caseName}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--gold)', background: 'var(--gold-soft)', padding: '1px 5px', borderRadius: '4px' }}>
                    {cit.citation}
                  </span>
                </div>
                
                <p style={{ fontSize: '0.76rem', color: 'var(--text-soft)', margin: '4px 0 0 0', lineHeight: '1.35' }}>
                  {cit.relevance}
                </p>

                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle2 size={11} /> Linked to active briefs
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => triggerSimilaritySearch(cit.caseName)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--gold)', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    Inspect Similarity <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            ))}

            {researchHistory.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '30px' }}>
                No citations linked. Search precedents on the left and link them.
              </p>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
