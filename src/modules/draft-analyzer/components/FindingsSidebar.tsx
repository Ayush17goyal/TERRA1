import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, Info } from 'lucide-react';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type FindingCategory =
  | 'missing_clause' | 'void_provision' | 'ambiguity' | 'procedure'
  | 'definition' | 'liability' | 'party_defect' | 'jurisdiction'
  | 'citation_error' | 'boilerplate' | 'formatting' | 'consideration'
  | null;

export type AnnotationType = 'underline' | 'highlight' | 'comment_marker' | 'sidebar_only';

export interface ReviewFinding {
  id: string;
  draftId: string;
  page: number;
  line: number;
  paragraphNumber: number | null;
  exactText: string;
  evidenceText: string | null;
  nearbyText: string | null;
  annotationType: AnnotationType | null;
  severity: FindingSeverity;
  category: FindingCategory;
  issue: string;
  legalReasoning: string;
  suggestion: string;
  confidenceScore: number;
  batchIndex: number;
  createdAt: string;
}

export const SEVERITY_CONFIG: Record<FindingSeverity, { color: string; bg: string; border: string; label: string; darkBg: string; darkBorder: string }> = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Critical', darkBg: '#2d1111', darkBorder: '#7f1d1d' },
  high:     { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'High',     darkBg: '#2d1a0a', darkBorder: '#7c2d12' },
  medium:   { color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Medium',   darkBg: '#2d2200', darkBorder: '#78350f' },
  low:      { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Low',      darkBg: '#0d2d1a', darkBorder: '#14532d' },
  info:     { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Info',     darkBg: '#0d1a2d', darkBorder: '#1e3a8a' },
};

const SEV_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

interface Props {
  findings: ReviewFinding[];
  activeId: string | null;
  searchQuery: string;
  matchedIds: Set<string>;
  isDark: boolean;
  onFindingClick: (finding: ReviewFinding) => void;
}

export default function FindingsSidebar({ findings, activeId, searchQuery, matchedIds, isDark, onFindingClick }: Props) {
  const [sevFilter, setSevFilter] = useState<FindingSeverity | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dm = isDark
    ? { bg: '#111827', surface: '#1f2937', border: '#374151', text: '#f9fafb', muted: '#9ca3af', subtext: '#d1d5db' }
    : { bg: '#fff',     surface: '#f9fafb', border: '#e5e7eb', text: '#111827', muted: '#6b7280', subtext: '#374151' };

  const counts = findings.reduce((a, f) => { a[f.severity] = (a[f.severity] ?? 0) + 1; return a; }, {} as Record<string, number>);

  const hasSearch = searchQuery.trim().length > 0;

  const visible = findings.filter(f => {
    const passFilter = sevFilter === 'all' || f.severity === sevFilter;
    const passSearch = !hasSearch || matchedIds.has(f.id);
    return passFilter && passSearch;
  });

  return (
    <div style={{ width: '300px', minWidth: '260px', height: '100%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${dm.border}`, background: dm.bg, transition: 'background 0.2s, border-color 0.2s' }}>

      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${dm.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: dm.text }}>Legal Findings</span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: isDark ? '#2d1111' : '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            {hasSearch ? `${matchedIds.size} / ${findings.length}` : `${findings.length}`}
          </span>
        </div>

        {/* Severity chips */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {SEV_ORDER.map(sev => {
            const cnt = counts[sev] ?? 0;
            if (!cnt) return null;
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <button
                key={sev}
                onClick={() => setSevFilter(v => v === sev ? 'all' : sev)}
                style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', cursor: 'pointer',
                  background: sevFilter === sev ? cfg.color : (isDark ? cfg.darkBg : cfg.bg),
                  color: sevFilter === sev ? '#fff' : cfg.color,
                  border: `1px solid ${isDark ? cfg.darkBorder : cfg.border}`,
                }}
              >
                {cnt} {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Findings list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: dm.muted, fontSize: '12px' }}>
            {hasSearch ? 'No findings match your search.' : 'No findings.'}
          </div>
        ) : (
          visible.map(finding => {
            const cfg = SEVERITY_CONFIG[finding.severity];
            const isActive   = activeId === finding.id;
            const isExpanded = expandedId === finding.id;
            const isMatched  = !hasSearch || matchedIds.has(finding.id);

            return (
              <div
                key={finding.id}
                data-finding-id={finding.id}
                onClick={() => {
                  onFindingClick(finding);
                  setExpandedId(isExpanded ? null : finding.id);
                }}
                style={{
                  padding: '9px 10px', marginBottom: '5px', borderRadius: '8px', cursor: 'pointer',
                  border: isActive ? `1.5px solid ${cfg.color}` : `1px solid ${dm.border}`,
                  background: isActive ? (isDark ? cfg.darkBg : cfg.bg) : (isDark ? '#1f2937' : '#fafafa'),
                  outline: hasSearch && isMatched && !isActive ? `2px solid ${cfg.color}33` : 'none',
                  transition: 'all 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px', flexShrink: 0, marginTop: '1px',
                    textTransform: 'uppercase', letterSpacing: '0.4px',
                    background: isDark ? cfg.darkBg : cfg.bg, color: cfg.color, border: `1px solid ${isDark ? cfg.darkBorder : cfg.border}`,
                  }}>
                    {cfg.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 600, color: dm.text, lineHeight: 1.3 }}>
                      {finding.issue}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', color: dm.muted }}>
                        Page {finding.page}{finding.paragraphNumber ? ` · ¶${finding.paragraphNumber}` : ''}
                      </span>
                      {finding.annotationType && finding.annotationType !== 'sidebar_only' && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px',
                          background: finding.annotationType === 'underline' ? '#fef2f2'
                            : finding.annotationType === 'highlight' ? '#fffbeb'
                            : '#eff6ff',
                          color: finding.annotationType === 'underline' ? '#dc2626'
                            : finding.annotationType === 'highlight' ? '#d97706'
                            : '#2563eb',
                          textTransform: 'uppercase', letterSpacing: '0.3px',
                        }}>
                          {finding.annotationType === 'underline' ? 'Redline'
                            : finding.annotationType === 'highlight' ? 'Highlight'
                            : 'Insert'}
                        </span>
                      )}
                      {finding.annotationType === 'sidebar_only' && (
                        <span style={{ fontSize: '9px', color: dm.muted, fontStyle: 'italic' }}>Sidebar only</span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: dm.muted, flexShrink: 0, marginTop: '2px' }}>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                </div>

                <p style={{
                  margin: '5px 0 0', fontSize: '11px', color: dm.muted, fontStyle: 'italic', lineHeight: 1.4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap',
                }}>
                  "{finding.exactText}"
                </p>

                {isExpanded && (
                  <div style={{ marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <SidebarDetail icon={<AlertCircle size={10} />} label="Legal Basis" text={finding.legalReasoning} color={cfg.color} isDark={isDark} dm={dm} />
                    <SidebarDetail icon={<Info size={10} />} label="Suggestion" text={finding.suggestion} color={dm.subtext} isDark={isDark} dm={dm} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span style={{ fontSize: '10px', color: dm.muted }}>Confidence</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '56px', height: '3px', background: dm.border, borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${finding.confidenceScore * 100}%`, height: '100%', background: cfg.color }} />
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color }}>{Math.round(finding.confidenceScore * 100)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SidebarDetail({ icon, label, text, color, isDark, dm }: { icon: React.ReactNode; label: string; text: string; color: string; isDark: boolean; dm: any }) {
  return (
    <div style={{ padding: '7px 8px', background: isDark ? '#111827' : '#f3f4f6', borderRadius: '6px', border: `1px solid ${dm.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', color }}>
        {icon}
        <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: '11px', color: dm.subtext, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}
