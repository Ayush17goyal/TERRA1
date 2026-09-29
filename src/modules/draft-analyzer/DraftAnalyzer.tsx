import { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, Upload, Scale, Sparkles, AlertCircle, CheckCircle, X, Layers, Brain, RotateCcw as RefreshIcon } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useDraftUpload } from './hooks/useDraftUpload';
import type { Draft } from './types/draft-analyzer.types';
import AnnotationEngine from './components/AnnotationEngine';
import AuditOverview from './components/AuditOverview';
import { API_BASE_URL } from '../../lib/api';
import type { ReviewFinding } from './components/FindingsSidebar';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt'];

type PipelinePhase = 'idle' | 'extracting' | 'reviewing' | 'done' | 'error';
type StageState = 'waiting' | 'running' | 'success' | 'failed' | 'timeout';
type CompletionStatus = 'running' | 'complete' | 'complete_with_warnings' | 'failed';

interface PipelineStage {
  label: string;
  state: StageState;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  findingCount?: number;
  message: string;
}

type PipelineStageName =
  | 'extraction' | 'structural' | 'govtVerification'
  | 'legalSearch' | 'gptReasoning' | 'mergeResults' | 'auditReport';

interface PipelineProgress {
  phase: PipelinePhase;
  extractPct: number;
  reviewPct: number;
  batchTotal: number;
  batchDone: number;
  batchFailed: number;
  batchRetried: number;
  message: string;
  error?: string;
  // new fields
  completionStatus?: CompletionStatus;
  pipelineStages?: Record<PipelineStageName, PipelineStage>;
  auditScore?: number | null;
  hasTimeouts?: boolean;
}

const POLL_INTERVAL_MS = 1_500;

export default function DraftAnalyzer() {
  const { getToken } = useAuth();
  const { uploadDraft, uploadState, reset } = useDraftUpload();
  const [pastedText, setPastedText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>('idle');
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress | null>(null);
  const [auditComplete, setAuditComplete] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  // BUG 9 FIX: use { id, seq } so clicking the same finding twice still re-triggers scroll
  const [focusFindingId, setFocusFindingId] = useState<{ id: string; seq: number } | undefined>(undefined);
  const annotationRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeRunningRef = useRef(false); // BUG 7 FIX: prevents double-click race

  const handleFile = useCallback(
    (file: File) => {
      setPipelinePhase('idle');
      setPipelineError(null);
      setPipelineProgress(null);
      setAuditComplete(false);
      setShowAnnotations(false);
      uploadDraft(file).catch(() => {});
    },
    [uploadDraft],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile],
  );

  // Stop any running poll when component unmounts; clear running flag so BUG 8 abort check works
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    analyzeRunningRef.current = false; // BUG 8 FIX: signals post-getToken code to abort
  }, []);

  const handleAnalyze = useCallback(async () => {
    const draft = uploadState.draft;
    if (!draft) return;

    // BUG 7 FIX: guard against double-click race during async getToken() gap
    if (analyzeRunningRef.current) return;
    analyzeRunningRef.current = true;

    // Clear any previous poll
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;

    setPipelinePhase('extracting');
    setPipelineError(null);
    setPipelineProgress(null);
    setAuditComplete(false);
    setShowAnnotations(false);

    try {
      const token = await getToken();

      // BUG 8 FIX: if component unmounted while awaiting getToken, abort
      if (!analyzeRunningRef.current) return;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Kick off background pipeline — returns immediately
      const startRes = await fetch(`${API_BASE_URL}/draft-analyzer/${draft.id}/analyze`, {
        method: 'POST', headers,
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        throw new Error(err.message || `Failed to start analysis (${startRes.status})`);
      }

      // Poll progress every POLL_INTERVAL_MS until done or error
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/draft-analyzer/${draft.id}/progress`, { headers });
          if (!res.ok) return;
          const progress: PipelineProgress = await res.json();

          setPipelineProgress(progress);
          setPipelinePhase(progress.phase);

          if (progress.phase === 'done' || progress.phase === 'error') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            analyzeRunningRef.current = false;
            if (progress.phase === 'error') {
              setPipelineError(progress.error ?? 'Unknown error');
            }
          }
        } catch {
          // transient poll failure — keep polling
        }
      }, POLL_INTERVAL_MS);
    } catch (err: any) {
      analyzeRunningRef.current = false;
      setPipelinePhase('error');
      setPipelineError(err.message);
    }
  }, [uploadState.draft, getToken]);

  const canAnalyze =
    uploadState.phase === 'success' || pastedText.trim().length > 50;
  const isRunning = pipelinePhase === 'extracting' || pipelinePhase === 'reviewing';

  const uploadedDraft: Draft | null = uploadState.draft;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', fontFamily: 'inherit' }}>
      {/* Header card */}
      <div style={{
        background: 'linear-gradient(135deg, #fffbf0 0%, #fef9ec 100%)',
        border: '1px solid #e8d5a3',
        borderRadius: '12px',
        padding: '28px 32px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={14} color="#b45309" />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', color: '#b45309', textTransform: 'uppercase' }}>
            Senior Advocate Audit
          </span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a18', margin: '0 0 8px 0' }}>
          AI Draft Analyzer
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, maxWidth: '600px', lineHeight: 1.6 }}>
          Upload your PDF, DOCX, or text files, or paste drafts directly to receive a comprehensive,
          section-by-section legal audit on clause completeness, litigation risk, and citation accuracy.
        </p>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left: Upload panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <FileText size={16} color="#374151" />
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                Pleading &amp; Agreement Upload
              </span>
            </div>

            {/* Drop zone */}
            {uploadState.phase === 'idle' || uploadState.phase === 'error' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                style={{
                  border: `2px dashed ${dragOver ? '#b45309' : uploadState.phase === 'error' ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '10px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? '#fffbf0' : uploadState.phase === 'error' ? '#fef2f2' : '#f9fafb',
                  transition: 'all 0.15s ease',
                }}
              >
                <Upload size={28} color={uploadState.phase === 'error' ? '#dc2626' : '#9ca3af'} style={{ margin: '0 auto 10px' }} />
                <p style={{ fontWeight: 600, fontSize: '14px', color: '#374151', margin: '0 0 4px' }}>
                  Upload Draft File
                </p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                  PDF, DOCX, or TXT formats
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                />
              </div>
            ) : uploadState.phase === 'uploading' ? (
              <UploadProgress progress={uploadState.progress} />
            ) : uploadState.phase === 'success' && uploadedDraft ? (
              <UploadSuccess draft={uploadedDraft} onReset={reset} />
            ) : null}

            {/* Error message */}
            {uploadState.phase === 'error' && uploadState.error && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginTop: '12px',
                padding: '10px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
              }}>
                <AlertCircle size={14} color="#dc2626" style={{ marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: '#dc2626', lineHeight: 1.4 }}>{uploadState.error}</span>
              </div>
            )}

            {/* Paste text */}
            <div style={{ marginTop: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#b45309', margin: '0 0 8px' }}>
                Or Paste Draft Text Directly
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your clauses, plaints, bail petitions, or commercial agreements here..."
                style={{
                  width: '100%',
                  minHeight: '160px',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#374151',
                  background: '#f9fafb',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Pipeline status */}
          {(pipelinePhase === 'extracting' || pipelinePhase === 'reviewing') && (
            <PipelineStageList progress={pipelineProgress} />
          )}
          {pipelinePhase === 'done' && pipelineProgress?.completionStatus === 'complete_with_warnings' && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: '#fffbf0', border: '1px solid #fde68a', borderRadius: '8px' }}>
              <AlertCircle size={14} color="#b45309" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '12px', color: '#92400e' }}>Analysis Completed with Warnings — some verification stages timed out</span>
            </div>
          )}
          {pipelinePhase === 'error' && pipelineError && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
              <AlertCircle size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '12px', color: '#dc2626' }}>{pipelineError}</span>
            </div>
          )}

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || isRunning || pipelinePhase === 'done'}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: isRunning ? '#d97706' : canAnalyze && pipelinePhase !== 'done' ? '#92400e' : '#e5e7eb',
              color: canAnalyze ? '#fff' : '#9ca3af',
              fontSize: '14px',
              fontWeight: 600,
              cursor: canAnalyze && !isRunning && pipelinePhase !== 'done' ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.15s ease',
            }}
          >
            <Sparkles size={15} />
            {isRunning ? 'Analyzing…' : pipelinePhase === 'done' ? 'Analysis Complete' : 'Audit Pleading & Analyze Risks'}
          </button>

          {/* View Annotations button — only shown after AUDIT STAGES complete */}
          {pipelinePhase === 'done' && uploadedDraft && (
            auditComplete ? (
              <button
                onClick={() => setShowAnnotations(v => !v)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1.5px solid #2563eb',
                  background: showAnnotations ? '#2563eb' : '#eff6ff',
                  color: showAnnotations ? '#fff' : '#2563eb',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Layers size={15} />
                {showAnnotations ? 'Hide Annotated Document' : 'View Annotated Document'}
              </button>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 12px', background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: '8px', fontSize: '12px', color: '#1d4ed8',
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #2563eb', borderTopColor: 'transparent', animation: 'da-spin 0.8s linear infinite', flexShrink: 0 }} />
                Finalising audit — annotated document will appear when all stages complete…
              </div>
            )
          )}
        </div>

        {/* Right: Audit overview */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '20px',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Scale size={16} color="#374151" />
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>Audit Overview</span>
          </div>

          {pipelinePhase === 'done' && uploadedDraft ? (
            <AuditOverview
              draftId={uploadedDraft.id}
              onAuditComplete={(count) => {
                setAuditComplete(true);
                // If there are no findings, still mark complete but keep annotations hidden
                if (count > 0) setShowAnnotations(false); // let user choose to open
              }}
              onFindingClick={(finding: ReviewFinding) => {
                if (!auditComplete) return; // don't navigate before audit finishes
                setFocusFindingId(prev => ({ id: finding.id, seq: (prev?.seq ?? 0) + 1 }));
                setShowAnnotations(true);
                setTimeout(() => {
                  annotationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
              }}
            />
          ) : uploadState.phase === 'success' && uploadedDraft ? (
            <UploadedSummary draft={uploadedDraft} pipelinePhase={pipelinePhase} />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              gap: '12px',
            }}>
              <FileText size={40} color="#d1d5db" />
              <p style={{ margin: 0, fontSize: '13px', textAlign: 'center', color: '#9ca3af' }}>
                Paste or upload a draft to trigger the Senior Advocate review board.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Annotation Engine — only shown after all audit stages complete */}
      {showAnnotations && uploadedDraft && pipelinePhase === 'done' && auditComplete && (
        <div ref={annotationRef} style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={16} color="#2563eb" />
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>Annotated Document</span>
          </div>
          <AnnotationEngine draftId={uploadedDraft.id} mimeType={uploadedDraft.mimeType} focusId={focusFindingId} />
        </div>
      )}
    </div>
  );
}

const STAGE_ORDER: PipelineStageName[] = [
  'extraction', 'structural', 'govtVerification', 'legalSearch', 'gptReasoning', 'mergeResults', 'auditReport',
];

const STATE_ICON: Record<StageState, string> = {
  waiting: '⌛',
  running: '⟳',
  success: '✓',
  failed:  '✕',
  timeout: '⊗',
};

const STATE_COLOR: Record<StageState, string> = {
  waiting: '#9ca3af',
  running: '#b45309',
  success: '#16a34a',
  failed:  '#dc2626',
  timeout: '#d97706',
};

function PipelineStageList({ progress }: { progress: PipelineProgress | null }) {
  const stages = progress?.pipelineStages;
  const msg = progress?.message ?? 'Starting audit…';

  return (
    <div style={{ padding: '14px 16px', background: '#fffbf0', border: '1px solid #fde68a', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '4px' }}>
        <div style={{
          width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
          border: '2px solid #b45309', borderTopColor: 'transparent',
          animation: 'da-spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>{msg}</span>
      </div>

      {/* Stage rows */}
      {STAGE_ORDER.map(key => {
        const s = stages?.[key];
        const state: StageState = s?.state ?? 'waiting';
        const label = s?.label ?? key;
        const dur = s?.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)}s` : null;
        const isRunning = state === 'running';

        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '13px', width: '16px', textAlign: 'center', flexShrink: 0,
              color: STATE_COLOR[state],
              animation: isRunning ? 'da-spin 0.9s linear infinite' : 'none',
              display: 'inline-block',
            }}>
              {STATE_ICON[state]}
            </span>
            <span style={{ fontSize: '12px', color: state === 'waiting' ? '#9ca3af' : '#374151', flex: 1 }}>
              {label}
              {s?.findingCount != null && s.findingCount > 0 && (
                <span style={{ marginLeft: '5px', fontSize: '10px', color: '#b45309', fontWeight: 600 }}>
                  ({s.findingCount})
                </span>
              )}
            </span>
            {dur && (
              <span style={{ fontSize: '10px', color: '#9ca3af', flexShrink: 0 }}>{dur}</span>
            )}
          </div>
        );
      })}

      <style>{`@keyframes da-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function UploadProgress({ progress }: { progress: number }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
      <Upload size={24} color="#b45309" style={{ margin: '0 auto 12px' }} />
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>
        Uploading…
      </p>
      <div style={{
        width: '100%',
        height: '6px',
        background: '#e5e7eb',
        borderRadius: '999px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: '#b45309',
          borderRadius: '999px',
          transition: 'width 0.1s linear',
        }} />
      </div>
      <p style={{ fontSize: '12px', color: '#9ca3af', margin: '8px 0 0' }}>{progress}%</p>
    </div>
  );
}

function UploadSuccess({ draft, onReset }: { draft: Draft; onReset: () => void }) {
  const kb = (draft.fileSize / 1024).toFixed(1);
  const ext = draft.fileName.split('.').pop()?.toUpperCase() ?? 'FILE';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px',
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '10px',
    }}>
      <CheckCircle size={20} color="#16a34a" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#15803d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {draft.fileName}
        </p>
        <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
          {ext} · {kb} KB · Ready for analysis
        </p>
      </div>
      <button
        onClick={onReset}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
        title="Remove file"
      >
        <X size={16} color="#6b7280" />
      </button>
    </div>
  );
}

function UploadedSummary({ draft, pipelinePhase }: { draft: Draft; pipelinePhase: string }) {
  const ext = draft.fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
  const sizeMb = (draft.fileSize / (1024 * 1024)).toFixed(2);

  const statusLabel =
    pipelinePhase === 'done' ? 'Reviewed' :
    pipelinePhase === 'reviewing' ? 'Reviewing…' :
    pipelinePhase === 'extracting' ? 'Extracting…' :
    'Uploaded';

  const reviewLabel =
    pipelinePhase === 'done' ? 'Complete' :
    pipelinePhase === 'reviewing' ? 'In Progress' :
    'Pending';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        padding: '14px',
        background: pipelinePhase === 'done' ? '#f0fdf4' : '#fffbf0',
        border: `1px solid ${pipelinePhase === 'done' ? '#bbf7d0' : '#fde68a'}`,
        borderRadius: '10px',
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: pipelinePhase === 'done' ? '#15803d' : '#92400e', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {pipelinePhase === 'done' ? 'Review Complete' : 'Document Received'}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {draft.fileName}
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
          {ext} · {sizeMb} MB
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {[
          { label: 'Status', value: statusLabel },
          { label: 'Document ID', value: draft.id.split('-')[0].toUpperCase() },
          { label: 'Review', value: reviewLabel },
          { label: 'Storage', value: 'Saved' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: '10px 12px',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}>
            <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              {label}
            </p>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>{value}</p>
          </div>
        ))}
      </div>

      {pipelinePhase !== 'done' && (
        <div style={{
          padding: '12px',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#0369a1',
          lineHeight: 1.5,
        }}>
          Document saved. Click <strong>Audit Pleading &amp; Analyze Risks</strong> to begin the senior advocate review.
        </div>
      )}
    </div>
  );
}
