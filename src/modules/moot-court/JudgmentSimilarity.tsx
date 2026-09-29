import React, { useState, useEffect } from 'react'
import { useMootSuite } from './MootSuiteContext'
import {
  Fingerprint,
  Search,
  Scale,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Link2
} from 'lucide-react'

export default function JudgmentSimilarity() {
  const { selectedSimilarityQuery, setSelectedSimilarityQuery, researchHistory, addResearchCitation } = useMootSuite()

  const [query, setQuery] = useState(selectedSimilarityQuery || '')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])

  // If a cross-link sets the query, auto-run the search
  useEffect(() => {
    if (selectedSimilarityQuery && selectedSimilarityQuery !== query) {
      setQuery(selectedSimilarityQuery)
      runSearch(selectedSimilarityQuery)
    }
  }, [selectedSimilarityQuery])

  const similarityDb = [
    {
      caseName: 'Kesavananda Bharati v. State of Kerala (1973)',
      citation: '1973 4 SCC 225',
      similarity: 96,
      bench: '13-Judge Bench',
      ratio: 'Parliament cannot alter the Basic Structure. Judicial review is an essential feature.',
      conflictsWith: 'Golaknath v. State of Punjab (1967) — overruled by this decision.'
    },
    {
      caseName: 'Minerva Mills v. Union of India (1980)',
      citation: '1980 3 SCC 625',
      similarity: 93,
      bench: '5-Judge Bench',
      ratio: 'Judicial review under Article 226/32 is a basic feature. 42nd Amendment sections struck down.',
      conflictsWith: null
    },
    {
      caseName: 'L. Chandra Kumar v. Union of India (1997)',
      citation: '1997 3 SCC 261',
      similarity: 89,
      bench: '7-Judge Bench',
      ratio: 'Power of High Courts under Article 226 is part of the basic structure and cannot be ousted.',
      conflictsWith: null
    },
    {
      caseName: 'Maneka Gandhi v. Union of India (1978)',
      citation: '1978 1 SCC 248',
      similarity: 87,
      bench: '7-Judge Bench',
      ratio: 'Procedure under Article 21 must be fair, just, and reasonable. Golden Triangle doctrine.',
      conflictsWith: 'A.K. Gopalan v. State of Madras (1950) — overruled by this decision.'
    },
    {
      caseName: 'I.R. Coelho v. State of Tamil Nadu (2007)',
      citation: '2007 2 SCC 1',
      similarity: 84,
      bench: '9-Judge Bench',
      ratio: 'Laws in the Ninth Schedule are open to judicial review if they violate basic structure principles.',
      conflictsWith: null
    },
    {
      caseName: 'A.K. Gopalan v. State of Madras (1950)',
      citation: '1950 SCR 88',
      similarity: 62,
      bench: '6-Judge Bench',
      ratio: 'Article 21 only requires procedure established by law (narrow interpretation — later overruled).',
      conflictsWith: 'CONFLICTING with Maneka Gandhi (1978) — this narrow interpretation was overruled.'
    },
    {
      caseName: 'Golaknath v. State of Punjab (1967)',
      citation: '1967 SCR (2) 762',
      similarity: 58,
      bench: '11-Judge Bench',
      ratio: 'Fundamental Rights cannot be amended at all (later overruled by Kesavananda Bharati).',
      conflictsWith: 'CONFLICTING with Kesavananda Bharati (1973) — this absolute position was overruled.'
    }
  ]

  const runSearch = (q: string) => {
    setIsSearching(true)
    setTimeout(() => {
      const lower = q.toLowerCase()
      const filtered = similarityDb.filter(
        c =>
          c.caseName.toLowerCase().includes(lower) ||
          c.citation.toLowerCase().includes(lower) ||
          c.ratio.toLowerCase().includes(lower)
      )
      // Sort by similarity descending
      filtered.sort((a, b) => b.similarity - a.similarity)
      setResults(filtered.length > 0 ? filtered : similarityDb.slice(0, 5))
      setIsSearching(false)
    }, 900)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSelectedSimilarityQuery(query.trim())
    runSearch(query.trim())
  }

  const handleLinkToMemory = (prec: typeof similarityDb[0]) => {
    const exists = researchHistory.some(c => c.caseName === prec.caseName)
    if (exists) return
    addResearchCitation({
      id: `cit-${Date.now()}`,
      caseName: prec.caseName,
      citation: prec.citation,
      similarityScore: prec.similarity,
      relevance: prec.ratio
    })
  }

  const getSimilarityColor = (score: number) => {
    if (score >= 85) return '#2ecc71'
    if (score >= 70) return 'var(--gold)'
    return '#e74c3c'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Fingerprint style={{ color: 'var(--gold)' }} size={22} /> Judgment Similarity Engine™
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
          Run high-accuracy vector-based similarity checks across the precedent database. Identify supporting and conflicting judgments.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--line)', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '8px' }}>
          <Search size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter precedent name, citation, or legal principle to search..."
            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', color: 'var(--text)', fontSize: '0.86rem' }}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSearching}
          style={{ padding: '8px 20px', fontSize: '0.86rem', fontWeight: '800', cursor: 'pointer' }}
        >
          {isSearching ? 'Searching...' : 'Run Similarity'}
        </button>
      </form>

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {results.map((prec, idx) => {
          const simColor = getSimilarityColor(prec.similarity)
          const isConflicting = prec.conflictsWith && prec.conflictsWith.startsWith('CONFLICTING')
          return (
            <div
              key={idx}
              className="glass-card"
              style={{
                padding: '14px 16px',
                background: 'var(--panel)',
                border: `1px solid ${isConflicting ? 'rgba(231,76,60,0.35)' : 'var(--line)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Scale size={14} style={{ color: 'var(--gold)' }} />
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text)' }}>{prec.caseName}</strong>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)' }}>
                    Citation: <strong>{prec.citation}</strong> | Bench: <strong>{prec.bench}</strong>
                  </span>
                </div>

                {/* Similarity Badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '6px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.15)', border: `1px solid ${simColor}` }}>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: '700' }}>Similarity</span>
                  <strong style={{ fontSize: '1.1rem', color: simColor }}>{prec.similarity}%</strong>
                </div>
              </div>

              {/* Ratio */}
              <p style={{ fontSize: '0.8rem', lineHeight: '1.4', color: 'var(--text-soft)', margin: 0, paddingLeft: '10px', borderLeft: `2px solid ${simColor}` }}>
                {prec.ratio}
              </p>

              {/* Conflict alert */}
              {prec.conflictsWith && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  background: isConflicting ? 'rgba(231,76,60,0.06)' : 'rgba(245,193,79,0.04)',
                  border: `1px solid ${isConflicting ? 'rgba(231,76,60,0.2)' : 'var(--line)'}`,
                  color: isConflicting ? '#e74c3c' : 'var(--text-soft)'
                }}>
                  <AlertTriangle size={13} />
                  <span>{prec.conflictsWith}</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleLinkToMemory(prec)}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                >
                  <Link2 size={11} /> Link to Case Memory
                </button>
              </div>
            </div>
          )
        })}

        {results.length === 0 && !isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '40px', border: '1px dashed var(--line)', borderRadius: '10px', color: 'var(--text-soft)', textAlign: 'center' }}>
            <Fingerprint size={28} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '0.84rem' }}>Enter a judgment name or legal principle above to run a similarity vector scan.</span>
          </div>
        )}
      </div>
    </div>
  )
}
