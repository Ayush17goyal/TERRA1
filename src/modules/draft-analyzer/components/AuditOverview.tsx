import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Scale, ChevronDown, ChevronRight, Loader, AlertCircle, ArrowUpRight, CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { type ReviewFinding, SEVERITY_CONFIG } from './FindingsSidebar';
import { API_BASE_URL } from '../../../lib/api';

// ── 8-stage audit status types ────────────────────────────────────────────────
type StageStatus = 'pending' | 'running' | 'passed' | 'warned' | 'failed' | 'error' | 'timeout';

interface StageResult {
  status: StageStatus;
  findingCount: number;
  message: string;
  completedAt?: number;
}

interface AuditStatus {
  scoreReady: boolean;
  stages: Record<string, StageResult>;
  findingCount: number;
}

const STAGE_META: Array<{ key: string; label: string; description: string }> = [
  { key: 'structural',       label: 'Structural Validation',         description: 'Title, date, parties, signature, placeholders' },
  { key: 'clause',           label: 'Clause Validation',             description: 'Governing law, definitions, obligations, remedies' },
  { key: 'draftQuality',     label: 'Draft Quality',                 description: 'Grammar, ambiguity, undefined terms, weak drafting' },
  { key: 'crossReference',   label: 'Cross-Reference Validation',    description: 'Internal clause refs, schedules, annexures' },
  { key: 'compliance',       label: 'Compliance Validation',         description: 'Indian law compliance, statutory requirements' },
  { key: 'govtVerification', label: 'Government Source Verification',description: 'Verified against official Indian legislation' },
  { key: 'legalSearch',      label: 'Verified Legal Search',         description: 'Case law, precedents, statutory interpretation' },
  { key: 'gptReasoning',     label: 'GPT Evidence-Based Reasoning',  description: 'AI legal analysis over collected evidence' },
];

// ── ValidationStagePanel ──────────────────────────────────────────────────────
function StatusIcon({ status }: { status: StageStatus }) {
  if (status === 'pending') return <Clock size={14} color="#9ca3af" />;
  if (status === 'running') return <Loader size={14} color="#2563eb" style={{ animation: 'ao-spin 0.9s linear infinite' }} />;
  if (status === 'passed')  return <CheckCircle2 size={14} color="#16a34a" />;
  if (status === 'warned')  return <ShieldAlert size={14} color="#d97706" />;
  if (status === 'failed')  return <XCircle size={14} color="#dc2626" />;
  if (status === 'timeout') return <Clock size={14} color="#d97706" />;
  return <AlertCircle size={14} color="#9ca3af" />;
}

function statusColor(s: StageStatus): string {
  if (s === 'passed')  return '#16a34a';
  if (s === 'warned')  return '#d97706';
  if (s === 'failed')  return '#dc2626';
  if (s === 'running') return '#2563eb';
  return '#9ca3af';
}

function ValidationStagePanel({ auditStatus }: { auditStatus: AuditStatus | null }) {
  const [open, setOpen] = useState(false);

  if (!auditStatus) return null;

  const { stages, scoreReady } = auditStatus;
  const completedCount = Object.values(stages).filter(s => s.status !== 'pending' && s.status !== 'running').length;
  const totalCount = STAGE_META.length;
  const hasError = Object.values(stages).some(s => s.status === 'error' || s.status === 'failed');

  return (
    <div style={{
      border: `1.5px solid ${scoreReady ? (hasError ? '#fca5a5' : '#86efac') : '#bfdbfe'}`,
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '20px',
      background: scoreReady ? (hasError ? '#fff7f7' : '#f0fdf4') : '#eff6ff',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '12px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          {scoreReady
            ? (hasError ? <AlertCircle size={16} color="#dc2626" /> : <CheckCircle2 size={16} color="#16a34a" />)
            : <Loader size={16} color="#2563eb" style={{ animation: 'ao-spin 0.9s linear infinite' }} />
          }
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: scoreReady ? (hasError ? '#dc2626' : '#15803d') : '#1d4ed8' }}>
              {scoreReady
                ? (hasError ? 'VALIDATION COMPLETE — ISSUES FOUND' : 'ALL VALIDATION STAGES COMPLETE')
                : `VALIDATION IN PROGRESS — ${completedCount}/${totalCount} STAGES DONE`
              }
            </span>
            {!scoreReady && (
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#3b82f6' }}>
                Score will be calculated after all 8 stages complete
              </p>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ width: '80px', height: '5px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{
            width: `${(completedCount / totalCount) * 100}%`, height: '100%',
            background: scoreReady ? (hasError ? '#dc2626' : '#16a34a') : '#2563eb',
            borderRadius: '999px', transition: 'width 0.4s ease',
          }} />
        </div>
        {open ? <ChevronDown size={13} color="#6b7280" /> : <ChevronRight size={13} color="#6b7280" />}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #e5e7eb' }}>
          {STAGE_META.map((meta, i) => {
            const stage = stages[meta.key];
            const status: StageStatus = stage?.status ?? 'pending';
            const cnt = stage?.findingCount ?? 0;
            const msg = stage?.message ?? meta.description;
            return (
              <div
                key={meta.key}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '9px 16px',
                  borderBottom: i < STAGE_META.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: status === 'running' ? '#eff6ff' : 'transparent',
                }}
              >
                <div style={{ paddingTop: '1px', flexShrink: 0 }}>
                  <StatusIcon status={status} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>
                      Stage {i + 1} — {meta.label}
                    </span>
                    {cnt > 0 && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '1px 5px',
                        borderRadius: '999px', background: `${statusColor(status)}22`,
                        color: statusColor(status), border: `1px solid ${statusColor(status)}55`,
                      }}>
                        {cnt} issue{cnt !== 1 ? 's' : ''}
                      </span>
                    )}
                    {status === 'passed' && (
                      <span style={{ fontSize: '9px', fontWeight: 600, color: '#16a34a' }}>✓ Clear</span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#6b7280', lineHeight: 1.4 }}>{msg}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── category-based classification (uses real AI category field, with keyword fallback) ─
const kw = (text: string, ...terms: string[]) =>
  terms.some(t => text.toLowerCase().includes(t));

const isMissing = (f: ReviewFinding) => {
  if (f.category === 'missing_clause' || f.category === 'boilerplate' || f.category === 'consideration') return true;
  return kw(f.issue + f.legalReasoning, 'missing', 'absent', 'omit', 'lack', 'no provision',
    'not includ', 'not defin', 'no clause', 'without', 'undefined');
};

const isDefinition = (f: ReviewFinding) => {
  if (f.category === 'definition') return true;
  return kw(f.issue + f.legalReasoning + f.exactText,
    'definition', 'defined term', 'undefined term', 'define', 'glossary', 'interpretation clause');
};

const isCommercial = (f: ReviewFinding) => {
  if (f.category === 'liability' || f.category === 'void_provision' || f.category === 'consideration') return true;
  return kw(f.issue + f.legalReasoning,
    'contract', 'commerc', 'liabilit', 'indemnit', 'warrant', 'consideration',
    'payment', 'damage', 'breach', 'terminat', 'arbitrat', 'sebi', 'fema',
    'ibc', 'compan', 'partner', 'enforce', 'penalt', 'liquidat', 'force majeure');
};

const isLitigation = (f: ReviewFinding) => {
  if (f.category === 'procedure' || f.category === 'jurisdiction' || f.category === 'party_defect') return true;
  return kw(f.issue + f.legalReasoning,
    'suit', 'plaint', 'petition', 'writ', 'court', 'tribunal', 'jurisdict',
    'cpc', 'bnss', 'crpc', 'limitation', 'cause of action', 'evidence',
    'procedure', 'high court', 'supreme court', 'appeal', 'filing', 'relief');
};

const isFormatting = (f: ReviewFinding) => {
  if ((f.category as string) === 'formatting') return true;
  if (f.category && (f.category as string) !== 'formatting') return false; // don't keyword-match categorized findings
  return f.severity === 'info' ||
    kw(f.issue + f.suggestion,
      'format', 'layout', 'style', 'grammar', 'punctuat', 'language',
      'recital', 'heading', 'numbering', 'boilerplate', 'capitaliz', 'spacing',
      'sentence', 'wording', 'draft', 'unclear');
};

const isCrossRef = (f: ReviewFinding) => {
  if (f.category === 'citation_error') return true;
  return kw(f.issue + f.legalReasoning,
    'citation', 'cit.', 'cross-reference', 'wrong section', 'incorrect section',
    'non-existent', 'refers to', 'schedule', 'annexure', 'exhibit', 'appendix',
    'reference error', 'mismatch', 'incorrect clause');
};

// ── derived metrics ─────────────────────────────────────────────────────────────
// Deductions per finding severity (must match the audit spec)
const SCORE_DEDUCTIONS: Record<string, number> = { critical: 15, high: 10, medium: 5, low: 2, info: 1 };

function overallScore(fs: ReviewFinding[]): number {
  // Never default to 100 when findings are empty — that means the review is not yet complete
  // or the AI returned nothing (which is treated as Analysis Incomplete, not perfect).
  if (!fs.length) return -1; // sentinel: render "Analysis Incomplete"
  const penalty = fs.reduce((s, f) => s + (SCORE_DEDUCTIONS[f.severity] ?? 0), 0);
  return Math.max(0, Math.round(100 - Math.min(penalty, 100)));
}

function clauseCoverage(missing: ReviewFinding[], totalFindings: number): number {
  if (totalFindings === 0) return -1; // Analysis Incomplete — not 100%
  if (!missing.length) return 100;
  const penalty = missing.reduce((s, f) => s + (SCORE_DEDUCTIONS[f.severity] ?? 0), 0);
  return Math.max(0, 100 - Math.min(penalty, 100));
}

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
function riskLevel(fs: ReviewFinding[]): RiskLevel {
  const c = fs.filter(f => f.severity === 'critical').length;
  const h = fs.filter(f => f.severity === 'high').length;
  if (c >= 1) return 'CRITICAL';
  if (h >= 3) return 'HIGH';
  if (h >= 1) return 'MEDIUM';
  return 'LOW';
}

const RISK_COLOR: Record<RiskLevel, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#16a34a',
};
const RISK_BG: Record<RiskLevel, string> = {
  CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fffbeb', LOW: '#f0fdf4',
};

function scoreColor(s: number) {
  if (s >= 85) return '#16a34a';
  if (s >= 70) return '#65a30d';
  if (s >= 55) return '#d97706';
  if (s >= 35) return '#ea580c';
  return '#dc2626';
}
function scoreLabel(s: number) {
  if (s >= 85) return 'COMPLIANT';
  if (s >= 70) return 'LOW RISK';
  if (s >= 55) return 'MODERATE RISK';
  if (s >= 35) return 'HIGH RISK';
  return 'CRITICAL RISK';
}

// ── ScoreRing ───────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const R = 46, C = 2 * Math.PI * R;
  const color = scoreColor(score);
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={R} fill="none" stroke="#e5e7eb" strokeWidth="9" />
      <circle
        cx="60" cy="60" r={R} fill="none"
        stroke={color} strokeWidth="9"
        strokeDasharray={`${(score / 100) * C} ${C}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="60" y="56" textAnchor="middle" fill={color} fontSize="26" fontWeight="800" fontFamily="inherit">{score}</text>
      <text x="60" y="70" textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="inherit">/ 100</text>
    </svg>
  );
}

// ── SeverityBar ─────────────────────────────────────────────────────────────────
function SeverityBar({ findings }: { findings: ReviewFinding[] }) {
  const total = findings.length || 1;
  const rows: Array<{ sev: 'critical' | 'high' | 'medium' | 'low' | 'info'; label: string }> = [
    { sev: 'critical', label: 'Critical' },
    { sev: 'high',     label: 'High'     },
    { sev: 'medium',   label: 'Medium'   },
    { sev: 'low',      label: 'Low'      },
    { sev: 'info',     label: 'Info'     },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '100%' }}>
      {rows.map(({ sev, label }) => {
        const cnt = findings.filter(f => f.severity === sev).length;
        const pct = Math.round((cnt / total) * 100);
        const cfg = SEVERITY_CONFIG[sev];
        return (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', width: '52px' }}>{label}</span>
            <div style={{ flex: 1, height: '7px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: cfg.color, minWidth: '20px', textAlign: 'right' }}>{cnt}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── MetricCard ──────────────────────────────────────────────────────────────────
function MetricCard({
  title, value, sub, color, bg, findings, onFindingClick,
}: {
  title: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
  bg?: string;
  findings: ReviewFinding[];
  onFindingClick: (f: ReviewFinding) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
      {/* Card header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', padding: '13px 14px', background: 'none',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{title}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: color ?? '#111827', lineHeight: 1 }}>{value}</span>
            {sub && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{sub}</span>}
          </div>
        </div>
        {findings.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{findings.length} finding{findings.length !== 1 ? 's' : ''}</span>
            {open ? <ChevronDown size={13} color="#9ca3af" /> : <ChevronRight size={13} color="#9ca3af" />}
          </div>
        )}
        {findings.length === 0 && (
          <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>✓ Clear</span>
        )}
      </button>

      {/* Expanded findings */}
      {open && findings.length > 0 && (
        <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', maxHeight: '280px', overflowY: 'auto' }}>
          {findings.map(f => {
            const cfg = SEVERITY_CONFIG[f.severity];
            return (
              <button
                key={f.id}
                onClick={() => onFindingClick(f)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  borderBottom: '1px solid #f3f4f6', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '8px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px',
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                  textTransform: 'uppercase', flexShrink: 0, marginTop: '2px',
                }}>
                  {cfg.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{f.issue}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#6b7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    "{f.exactText}"
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, color: '#2563eb' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>Pg {f.page}</span>
                  <ArrowUpRight size={11} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── RiskCard ────────────────────────────────────────────────────────────────────
function RiskCard({
  title, level, findings, onFindingClick,
}: {
  title: string;
  level: RiskLevel;
  findings: ReviewFinding[];
  onFindingClick: (f: ReviewFinding) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = RISK_COLOR[level];
  const bg    = RISK_BG[level];

  return (
    <div style={{ border: `1.5px solid ${color}33`, borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 5px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: '18px', fontWeight: 800, color, lineHeight: 1 }}>{level}</span>
          </div>
        </div>
        {findings.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>{findings.length} finding{findings.length !== 1 ? 's' : ''}</span>
            {open ? <ChevronDown size={13} color="#9ca3af" /> : <ChevronRight size={13} color="#9ca3af" />}
          </div>
        )}
      </button>

      {open && findings.length > 0 && (
        <div style={{ borderTop: `1px solid ${color}22`, background: bg, maxHeight: '260px', overflowY: 'auto' }}>
          {findings.map(f => {
            const cfg = SEVERITY_CONFIG[f.severity];
            return (
              <button
                key={f.id}
                onClick={() => onFindingClick(f)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  borderBottom: '1px solid #e5e7eb', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '8px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ffffff88')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px',
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                  textTransform: 'uppercase', flexShrink: 0, marginTop: '2px',
                }}>
                  {cfg.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{f.issue}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#6b7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    "{f.exactText}"
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, color: '#2563eb' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>Pg {f.page}</span>
                  <ArrowUpRight size={11} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Max time to poll for scoreReady before giving up (5 minutes)
const MAX_POLL_MS = 5 * 60 * 1000;

// ── AuditOverview ───────────────────────────────────────────────────────────────
interface Props {
  draftId: string;
  onFindingClick: (finding: ReviewFinding) => void;
  onAuditComplete?: (findingCount: number) => void;
}

export default function AuditOverview({ draftId, onFindingClick, onAuditComplete }: Props) {
  const { getToken } = useAuth();
  const [findings,      setFindings]      = useState<ReviewFinding[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [auditStatus,   setAuditStatus]   = useState<AuditStatus | null>(null);
  const [statusPolling, setStatusPolling] = useState(true);
  const pollStartRef = useRef<number>(Date.now());
  const onAuditCompleteRef = useRef(onAuditComplete);
  onAuditCompleteRef.current = onAuditComplete;

  // Initial findings load (shows whatever is currently in DB immediately)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/draft-analyzer/${draftId}/review`, { headers: h });
        if (!res.ok) throw new Error(`Failed to load review (${res.status})`);
        const data: ReviewFinding[] = await res.json();
        if (!cancelled) { setFindings(data); setLoading(false); }
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [draftId, getToken]);

  // Poll audit-status until scoreReady or max timeout
  const fetchAuditStatus = useCallback(async () => {
    // Hard timeout: stop polling after MAX_POLL_MS regardless
    if (Date.now() - pollStartRef.current > MAX_POLL_MS) {
      setStatusPolling(false);
      setAuditStatus(prev => prev ? { ...prev, scoreReady: true } : null);
      return;
    }

    try {
      const token = await getToken();
      const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/draft-analyzer/${draftId}/audit-status`, { headers: h });
      if (!res.ok) return;
      const data: AuditStatus & { findingCount?: number } = await res.json();
      setAuditStatus(data);

      if (data.scoreReady) {
        setStatusPolling(false);
        // Refresh findings now that all stages are done
        const token2 = await getToken();
        const h2: Record<string, string> = token2 ? { Authorization: `Bearer ${token2}` } : {};
        const res2 = await fetch(`${API_BASE_URL}/draft-analyzer/${draftId}/review`, { headers: h2 });
        if (res2.ok) {
          const freshFindings: ReviewFinding[] = await res2.json();
          setFindings(freshFindings);
          onAuditCompleteRef.current?.(freshFindings.length);
        }
      }
    } catch { /* ignore transient polling errors */ }
  }, [draftId, getToken]);

  useEffect(() => {
    if (!statusPolling) return;
    pollStartRef.current = Date.now();
    fetchAuditStatus();
    const id = setInterval(fetchAuditStatus, 3000);
    return () => clearInterval(id);
  }, [statusPolling, fetchAuditStatus]);

  // ── derived metrics ──────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const missing     = findings.filter(isMissing);
    const definitions = findings.filter(isDefinition);
    const commercial  = findings.filter(isCommercial);
    const litigation  = findings.filter(isLitigation);
    const formatting  = findings.filter(isFormatting);
    const crossRef    = findings.filter(isCrossRef);
    const coverage    = clauseCoverage(missing, findings.length);
    const score       = overallScore(findings);
    return { missing, definitions, commercial, litigation, formatting, crossRef, coverage, score };
  }, [findings]);

  // ── render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '12px', color: '#6b7280' }}>
        <Loader size={18} style={{ animation: 'ao-spin 0.9s linear infinite' }} />
        <span style={{ fontSize: '13px' }}>Loading audit results…</span>
        <style>{`@keyframes ao-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '24px', color: '#dc2626' }}>
        <AlertCircle size={16} />
        <span style={{ fontSize: '13px' }}>{error}</span>
      </div>
    );
  }

  const { score, coverage, missing, definitions, commercial, litigation, formatting, crossRef } = metrics;
  const commRisk = riskLevel(commercial);
  const litiRisk = riskLevel(litigation);

  // Score is only valid when all 8 stages complete AND there are actual findings
  const scoreReady = auditStatus?.scoreReady ?? false;
  // score === -1 means zero findings — treat as Analysis Incomplete (not 100/100)
  const analysisIncomplete = score === -1 || !scoreReady;
  const displayScore = scoreReady ? score : -1;

  return (
    <div style={{ fontFamily: 'inherit' }}>
      <style>{`@keyframes ao-spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── 8-Stage Validation Panel ─────────────────────────────────────────── */}
      <ValidationStagePanel auditStatus={auditStatus} />

      {/* ── Score + severity ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', alignItems: 'center', padding: '24px 28px', background: 'linear-gradient(135deg, #fffbf0 0%, #fef9ec 100%)', border: '1px solid #e8d5a3', borderRadius: '12px', marginBottom: '20px' }}>
        {/* Score ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          {analysisIncomplete ? (
            <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '9px solid #e5e7eb', flexDirection: 'column', gap: 4 }}>
              {!scoreReady
                ? <Loader size={28} color="#2563eb" style={{ animation: 'ao-spin 0.9s linear infinite' }} />
                : <AlertCircle size={28} color="#d97706" />
              }
              <span style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', lineHeight: 1.2 }}>
                {!scoreReady ? 'PENDING' : 'NO DATA'}
              </span>
            </div>
          ) : (
            <ScoreRing score={displayScore} />
          )}
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.8px', color: analysisIncomplete ? (scoreReady ? '#d97706' : '#2563eb') : scoreColor(displayScore), textTransform: 'uppercase' }}>
            {!scoreReady ? 'VALIDATING…' : analysisIncomplete ? 'ANALYSIS INCOMPLETE' : scoreLabel(displayScore)}
          </span>
          <span style={{ fontSize: '10px', color: '#9ca3af' }}>
            {!scoreReady
              ? 'Awaiting all validation stages'
              : analysisIncomplete
                ? 'No findings returned'
                : `${findings.length} finding${findings.length !== 1 ? 's' : ''} identified`
            }
          </span>
        </div>

        {/* Severity bar */}
        <div>
          <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Severity Distribution
          </p>
          <SeverityBar findings={findings} />
        </div>
      </div>

      {/* ── Issue counts row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
          const cnt = findings.filter(f => f.severity === sev).length;
          const cfg = SEVERITY_CONFIG[sev];
          const sevFindings = findings.filter(f => f.severity === sev);
          return (
            <MetricCard
              key={sev}
              title={`${cfg.label} Issues`}
              value={cnt}
              color={cfg.color}
              findings={sevFindings}
              onFindingClick={onFindingClick}
            />
          );
        })}
      </div>

      {/* ── Analysis grid row 1 ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        {/* Clause Coverage */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '13px 14px', background: '#fff' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Clause Coverage
          </p>
          <span style={{ fontSize: '26px', fontWeight: 800, color: coverage === -1 ? '#d97706' : scoreColor(coverage), lineHeight: 1 }}>{coverage === -1 ? '—' : `${coverage}%`}</span>
          <div style={{ marginTop: '8px', height: '5px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: coverage === -1 ? '0%' : `${coverage}%`, height: '100%', background: coverage === -1 ? '#d97706' : scoreColor(coverage), borderRadius: '999px', transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#9ca3af' }}>
            {missing.length} missing clause{missing.length !== 1 ? 's' : ''} detected
          </p>
        </div>

        {/* Definitions Found */}
        <MetricCard
          title="Definitions Found"
          value={definitions.length === 0 ? '✓' : definitions.length}
          sub={definitions.length === 0 ? 'No issues' : 'definition issues'}
          color={definitions.length === 0 ? '#16a34a' : '#d97706'}
          findings={definitions}
          onFindingClick={onFindingClick}
        />

        {/* Missing Clauses */}
        <MetricCard
          title="Missing Clauses"
          value={missing.length}
          sub={missing.length === 0 ? 'none detected' : 'provisions absent'}
          color={missing.length === 0 ? '#16a34a' : missing.some(f => f.severity === 'critical') ? '#dc2626' : '#ea580c'}
          findings={missing}
          onFindingClick={onFindingClick}
        />
      </div>

      {/* ── Risk row ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <RiskCard
          title="Commercial Risk"
          level={commRisk}
          findings={commercial}
          onFindingClick={onFindingClick}
        />
        <RiskCard
          title="Litigation Risk"
          level={litiRisk}
          findings={litigation}
          onFindingClick={onFindingClick}
        />
      </div>

      {/* ── Formatting + Cross-ref row ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <MetricCard
          title="Formatting Issues"
          value={formatting.length}
          sub={formatting.length === 0 ? 'none' : 'style & language issues'}
          color={formatting.length === 0 ? '#16a34a' : '#6b7280'}
          findings={formatting}
          onFindingClick={onFindingClick}
        />
        <MetricCard
          title="Cross-reference Errors"
          value={crossRef.length}
          sub={crossRef.length === 0 ? 'none' : 'citation / ref errors'}
          color={crossRef.length === 0 ? '#16a34a' : '#ea580c'}
          findings={crossRef}
          onFindingClick={onFindingClick}
        />
      </div>
    </div>
  );
}
