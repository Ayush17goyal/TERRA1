import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  ZoomIn, ZoomOut, Search, X, ChevronLeft, ChevronRight,
  Maximize, Minimize, Moon, Sun, FileText, Loader, AlertCircle, Download,
} from 'lucide-react';
import { exportAnnotatedPdf } from '../utils/exportPdf';
import FindingsSidebar, { type ReviewFinding, SEVERITY_CONFIG } from './FindingsSidebar';
import PdfPageCanvas, { type LineBlock, type PageAnnotation, type AnnotationSpan } from './PdfPageCanvas';
import { API_BASE_URL, API_ORIGIN } from '../../../lib/api';

// ── pdfjs setup ────────────────────────────────────────────────────────────────
// Use Vite asset URL bundling instead of a CDN URL — avoids network/CSP failures
let _pdfjsReady = false;
async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!_pdfjsReady) {
    try {
      // Vite bundles the worker as an asset and gives us its URL at build time
      (pdfjs as any).GlobalWorkerOptions.workerSrc =
        new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;
    } catch {
      // Fallback for environments where import.meta.url is unavailable
      (pdfjs as any).GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${(pdfjs as any).version}/build/pdf.worker.min.js`;
    }
    _pdfjsReady = true;
  }
  return pdfjs;
}

// ── evidence-based annotation matching ────────────────────────────────────────
//
// Rules:
//   underline / highlight  → find block containing evidenceText; compute sub-span offsets
//   comment_marker         → find block containing nearbyText; mark insertion point
//   sidebar_only           → no PDF annotation; finding shows in sidebar only
//
// Validation: if evidenceText is not found verbatim in any extracted block for that page,
// the annotation is DROPPED — no fake redlines.

function findEvidenceInBlocks(
  needle: string,
  blocks: LineBlock[],
): { block: LineBlock; span: AnnotationSpan } | null {
  const needleLower = needle.toLowerCase().trim();
  if (!needleLower) return null;

  for (const block of blocks) {
    const hay = (block.textContent ?? '').toLowerCase();
    const idx = hay.indexOf(needleLower);
    if (idx !== -1) {
      const len = block.textContent!.length;
      return {
        block,
        span: {
          startRatio: idx / len,
          endRatio: Math.min(1, (idx + needleLower.length) / len),
        },
      };
    }
  }

  // Partial match: first 30 chars of needle (handles AI truncation)
  if (needleLower.length > 30) {
    const partial = needleLower.slice(0, 30);
    for (const block of blocks) {
      const hay = (block.textContent ?? '').toLowerCase();
      const idx = hay.indexOf(partial);
      if (idx !== -1) {
        const len = block.textContent!.length;
        const matchEnd = Math.min(idx + needleLower.length, len);
        return {
          block,
          span: { startRatio: idx / len, endRatio: matchEnd / len },
        };
      }
    }
  }

  return null;
}

function buildAnnotationMap(findings: ReviewFinding[], blocks: LineBlock[]): Map<number, PageAnnotation[]> {
  const byPage = new Map<number, LineBlock[]>();
  for (const b of blocks) {
    if (!byPage.has(b.pageNumber)) byPage.set(b.pageNumber, []);
    byPage.get(b.pageNumber)!.push(b);
  }

  const result = new Map<number, PageAnnotation[]>();

  for (const f of findings) {
    const annotType = f.annotationType ?? 'sidebar_only';

    // sidebar_only: never render on PDF
    if (annotType === 'sidebar_only') continue;

    const nonEmpty = (byPage.get(f.page) ?? []).filter(b => b.textContent?.trim());

    if (annotType === 'underline' || annotType === 'highlight') {
      // MUST have evidenceText that actually exists in the document
      const needle = f.evidenceText?.trim();
      if (!needle) continue; // no evidence → no annotation

      const match = findEvidenceInBlocks(needle, nonEmpty);
      if (!match) continue; // evidence not found in extracted text → no fake annotation

      if (!result.has(f.page)) result.set(f.page, []);
      result.get(f.page)!.push({ finding: f, block: match.block, span: match.span });

    } else if (annotType === 'comment_marker') {
      // Find nearbyText as the insertion anchor
      const anchor = f.nearbyText?.trim();
      if (!anchor) continue;

      const match = findEvidenceInBlocks(anchor, nonEmpty);
      if (!match) continue; // anchor not found → skip

      if (!result.has(f.page)) result.set(f.page, []);
      // span for comment_marker: place at end of anchor block (insertion after)
      result.get(f.page)!.push({
        finding: f,
        block: match.block,
        span: { startRatio: 1.0, endRatio: 1.0 }, // insertion point at end of anchor
      });
    }
  }

  return result;
}

interface Popover { finding: ReviewFinding; x: number; y: number }

interface Props { draftId: string; mimeType?: string; focusId?: { id: string; seq: number } }

export default function AnnotationEngine({ draftId, mimeType, focusId }: Props) {
  const { getToken } = useAuth();

  // ── data state ──────────────────────────────────────────────────────────────
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError,   setDataError]   = useState<string | null>(null);
  const [fileUrl,     setFileUrl]      = useState<string | null>(null);
  const [findings,    setFindings]     = useState<ReviewFinding[]>([]);
  const [allLineBlocks, setAllLineBlocks] = useState<LineBlock[]>([]); // BUG 2 FIX: store all blocks for export
  const [pageAnnotations, setPageAnnotations] = useState<Map<number, PageAnnotation[]>>(new Map());

  // ── PDF state ───────────────────────────────────────────────────────────────
  const [pdfDoc,     setPdfDoc]     = useState<any>(null);
  const [numPages,   setNumPages]   = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError,   setPdfError]   = useState<string | null>(null);

  // ── viewer state ────────────────────────────────────────────────────────────
  const [scale,       setScale]       = useState(1.2);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput,   setPageInput]   = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [isDark,      setIsDark]      = useState(false);
  const [isFullscreen,setIsFullscreen]= useState(false);
  const [popover,     setPopover]     = useState<Popover | null>(null);
  const [exporting,   setExporting]   = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const viewerRef  = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  // ── dark-mode palette ───────────────────────────────────────────────────────
  const dm = isDark
    ? { bg: '#0f172a', surface: '#1e293b', border: '#334155', text: '#f1f5f9', muted: '#94a3b8', toolbar: '#1e293b', canvas: '#0f172a' }
    : { bg: '#fff',    surface: '#f9fafb', border: '#e5e7eb', text: '#111827', muted: '#6b7280', toolbar: '#fff',    canvas: '#d1d5db' };

  // ── search: derive matched IDs ──────────────────────────────────────────────
  const matchedIds = useMemo<Set<string>>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set();
    return new Set(
      findings
        .filter(f =>
          f.issue.toLowerCase().includes(q) ||
          f.exactText.toLowerCase().includes(q) ||
          f.legalReasoning.toLowerCase().includes(q) ||
          f.suggestion.toLowerCase().includes(q),
        )
        .map(f => f.id),
    );
  }, [searchQuery, findings]);

  // ── scrollToPage: MUST be declared before any useEffect that references it ──
  // (avoids JavaScript Temporal Dead Zone crash from const + useEffect dep array)
  const scrollToPage = useCallback((p: number) => {
    const el = scrollRef.current?.querySelector(`[data-page="${p}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const [r1, r2, r3] = await Promise.all([
          fetch(`${API_BASE_URL}/draft-analyzer/${draftId}/file-url`, { headers: h }),
          fetch(`${API_BASE_URL}/draft-analyzer/${draftId}/review`,   { headers: h }),
          fetch(`${API_BASE_URL}/draft-analyzer/${draftId}/blocks`,   { headers: h }),
        ]);
        if (!r1.ok || !r2.ok || !r3.ok) throw new Error('Failed to load annotation data');
        const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
        if (cancelled) return;
        // localFile=true means Supabase is disabled; fetch from our own API instead
        const resolvedUrl = d1.url
          ?? (d1.localFile ? `${API_ORIGIN}/api/v1/draft-analyzer/${draftId}/file-data` : null);
        setFileUrl(resolvedUrl);
        setFindings(d2);
        setAllLineBlocks(d3); // BUG 2 FIX: store all blocks (not just matched ones)
        setPageAnnotations(buildAnnotationMap(d2, d3));
        setDataLoading(false);
      } catch (e: any) {
        if (!cancelled) { setDataError(e.message); setDataLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [draftId, getToken]);

  // ── load PDF ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileUrl || mimeType !== 'application/pdf') return;
    let cancelled = false;
    let blobUrl: string | null = null;
    setPdfLoading(true); setPdfError(null);

    async function loadPdf() {
      try {
        const pdfjs = await getPdfjs();
        let src: string = fileUrl!;

        // If the URL is our own API (local file fallback), fetch with auth headers
        // and create a blob URL so pdf.js can load it without CORS/auth issues
        if (fileUrl!.includes('/draft-analyzer/') && fileUrl!.includes('/file-data')) {
          const token = await getToken();
          const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(fileUrl!, { headers: h });
          if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
          src = blobUrl;
        }

        if (cancelled) { if (blobUrl) URL.revokeObjectURL(blobUrl); return; }
        const doc = await (pdfjs as any).getDocument({ url: src }).promise;
        if (!cancelled) { setPdfDoc(doc); setNumPages(doc.numPages); setPdfLoading(false); }
        else if (blobUrl) URL.revokeObjectURL(blobUrl);
      } catch (e: any) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        if (!cancelled) { setPdfError(`Render failed: ${e.message}`); setPdfLoading(false); }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [fileUrl, mimeType, getToken]);

  // ── focus a specific finding from outside (AuditOverview click) ────────────
  // BUG 9 FIX: focusId uses { id, seq } so same-id clicks still re-trigger
  useEffect(() => {
    if (!focusId || !findings.length) return;
    const f = findings.find(x => x.id === focusId.id);
    if (!f) return;
    setActiveId(f.id);
    scrollToPage(f.page);
    document.querySelector(`[data-finding-id="${f.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusId, findings, scrollToPage]);

  // ── fullscreen events ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Escape') { setPopover(null); if (document.fullscreenElement) document.exitFullscreen(); }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setScale(s => Math.min(3.0, +(s + 0.1).toFixed(1))); }
      if (e.key === '-')                   { e.preventDefault(); setScale(s => Math.max(0.5, +(s - 0.1).toFixed(1))); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goPage(1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPage(-1);
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [numPages, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── helpers ──────────────────────────────────────────────────────────────────
  function goPage(delta: number) {
    setCurrentPage(prev => {
      const next = Math.max(1, Math.min(numPages, prev + delta));
      scrollToPage(next);
      setPageInput(String(next));
      return next;
    });
  }

  const commitPageInput = useCallback(() => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 1 && n <= numPages) {
      setCurrentPage(n);
      scrollToPage(n);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, numPages, currentPage, scrollToPage]);

  const handleOnVisible = useCallback((p: number) => {
    setCurrentPage(p);
    setPageInput(String(p));
  }, []);

  const handleFindingClick = useCallback((finding: ReviewFinding) => {
    setActiveId(finding.id);
    scrollToPage(finding.page);
    setPopover(null);
  }, [scrollToPage]);

  const handleAnnotationClick = useCallback((id: string, clientX: number, clientY: number) => {
    const finding = findings.find(f => f.id === id);
    if (!finding) return;
    setActiveId(id);

    // Scroll sidebar card into view
    document.querySelector(`[data-finding-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Position popover: prefer above click, clamp to viewport
    const POP_W = 340, POP_H = 280;
    const x = Math.max(8, Math.min(clientX - POP_W / 2, window.innerWidth - POP_W - 8));
    const y = clientY - POP_H - 12 > 8
      ? clientY - POP_H - 12
      : clientY + 20;
    setPopover({ finding, x: Math.round(x), y: Math.round(y) });
  }, [findings]);

  const handleExport = useCallback(async () => {
    if (!fileUrl || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      // BUG 2 FIX: use allLineBlocks (all extracted blocks), not just annotation-matched ones
      // For local file-data URLs, fetch with auth headers first
      let pdfUrl = fileUrl;
      if (fileUrl.includes('/draft-analyzer/') && fileUrl.includes('/file-data')) {
        const token = await getToken();
        const h: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(fileUrl, { headers: h });
        if (!res.ok) throw new Error(`Failed to fetch PDF for export (${res.status})`);
        const blob = await res.blob();
        pdfUrl = URL.createObjectURL(blob);
      }
      const fileName = fileUrl.split('/').pop()?.split('?')[0] ?? 'document.pdf';
      try {
        await exportAnnotatedPdf(pdfUrl, findings, allLineBlocks, fileName, draftId);
      } finally {
        if (pdfUrl !== fileUrl) URL.revokeObjectURL(pdfUrl);
      }
    } catch (e: any) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }, [fileUrl, findings, allLineBlocks, draftId, exporting, getToken]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) viewerRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0];
  const zoomIn  = () => { const next = ZOOM_LEVELS.find(z => z > scale) ?? 3.0; setScale(next); };
  const zoomOut = () => { const next = [...ZOOM_LEVELS].reverse().find(z => z < scale) ?? 0.5; setScale(next); };
  const fitPage = () => {
    if (!scrollRef.current) return;
    const w = scrollRef.current.clientWidth - 64;
    setScale(Math.max(0.5, Math.min(2.5, +(w / 612).toFixed(2))));
  };

  const isPdf = mimeType === 'application/pdf';

  // ── loading / error screens ─────────────────────────────────────────────────
  if (dataLoading) return (
    <Shell dm={dm} isDark={isDark}>
      <CentreMsg><Loader size={20} className="spin" /><span>Loading annotation data…</span></CentreMsg>
    </Shell>
  );
  if (dataError) return (
    <Shell dm={dm} isDark={isDark}>
      <CentreMsg><AlertCircle size={20} color="#dc2626" /><span style={{ color: '#dc2626' }}>{dataError}</span></CentreMsg>
    </Shell>
  );

  // ── main render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={viewerRef}
      style={{
        display: 'flex', flexDirection: 'column', height: isFullscreen ? '100vh' : '88vh',
        minHeight: '600px', border: `1px solid ${dm.border}`, borderRadius: isFullscreen ? 0 : '12px',
        overflow: 'hidden', background: dm.bg, fontFamily: 'inherit', transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      {/* ── TOOLBAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
        borderBottom: `1px solid ${dm.border}`, background: dm.toolbar, flexShrink: 0,
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '7px', border: `1px solid ${dm.border}`, background: dm.surface, minWidth: 0, flex: '0 1 200px' }}>
          <Search size={12} color={dm.muted} style={{ flexShrink: 0 }} />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search findings…"
            style={{ border: 'none', background: 'transparent', fontSize: '12px', color: dm.text, width: '100%', outline: 'none', minWidth: 0 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={iconBtnStyle(dm)}>
              <X size={11} />
            </button>
          )}
        </div>
        {searchQuery && (
          <span style={{ fontSize: '11px', color: dm.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {matchedIds.size} match{matchedIds.size !== 1 ? 'es' : ''}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Page navigation */}
        {isPdf && numPages > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <Tbtn onClick={() => goPage(-1)} title="Previous page (←)" dm={dm} disabled={currentPage <= 1}>
              <ChevronLeft size={14} />
            </Tbtn>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <input
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={e => { if (e.key === 'Enter') commitPageInput(); }}
                style={{
                  width: '32px', textAlign: 'center', border: `1px solid ${dm.border}`, borderRadius: '5px',
                  background: dm.surface, color: dm.text, fontSize: '12px', fontWeight: 600, padding: '3px 2px', outline: 'none',
                }}
              />
              <span style={{ fontSize: '11px', color: dm.muted }}>/ {numPages}</span>
            </div>
            <Tbtn onClick={() => goPage(1)} title="Next page (→)" dm={dm} disabled={currentPage >= numPages}>
              <ChevronRight size={14} />
            </Tbtn>
          </div>
        )}

        <Sep dm={dm} />

        {/* Zoom */}
        {isPdf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <Tbtn onClick={zoomOut} title="Zoom out (−)" dm={dm}><ZoomOut size={14} /></Tbtn>
            <select
              value={Math.round(scale * 100)}
              onChange={e => setScale(parseInt(e.target.value, 10) / 100)}
              style={{ border: `1px solid ${dm.border}`, borderRadius: '5px', background: dm.surface, color: dm.text, fontSize: '12px', fontWeight: 600, padding: '3px 4px', outline: 'none', cursor: 'pointer' }}
            >
              {[50, 75, 100, 125, 150, 200, 250, 300].map(z => (
                <option key={z} value={z}>{z}%</option>
              ))}
            </select>
            <Tbtn onClick={zoomIn} title="Zoom in (+)" dm={dm}><ZoomIn size={14} /></Tbtn>
            <Tbtn onClick={fitPage} title="Fit to width" dm={dm} style={{ fontSize: '10px', fontWeight: 700, padding: '4px 6px', color: dm.muted }}>
              Fit
            </Tbtn>
          </div>
        )}

        <Sep dm={dm} />

        {/* Export */}
        <Tbtn
          onClick={handleExport}
          title="Export reviewed PDF"
          dm={dm}
          disabled={!fileUrl || exporting || !isPdf}
          style={{ gap: '4px', paddingLeft: '8px', paddingRight: '8px', fontSize: '11px', fontWeight: 700, color: exporting ? dm.muted : '#16a34a' }}
        >
          {exporting
            ? <><Loader size={12} className="spin" /><span>Exporting…</span></>
            : <><Download size={12} /><span>Export PDF</span></>}
        </Tbtn>

        <Sep dm={dm} />

        {/* Dark mode + fullscreen */}
        <Tbtn onClick={() => setIsDark(d => !d)} title={isDark ? 'Light mode' : 'Dark mode'} dm={dm}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </Tbtn>
        <Tbtn onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'} dm={dm}>
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </Tbtn>
      </div>

      {/* ── EXPORT ERROR ──────────────────────────────────────────────────── */}
      {exportError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#fef2f2', borderBottom: `1px solid #fecaca`, flexShrink: 0 }}>
          <AlertCircle size={12} color="#dc2626" />
          <span style={{ fontSize: '11px', color: '#dc2626', flex: 1 }}>{exportError}</span>
          <button onClick={() => setExportError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0, display: 'flex' }}><X size={12} /></button>
        </div>
      )}

      {/* ── BODY: sidebar + canvas ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <FindingsSidebar
          findings={findings}
          activeId={activeId}
          searchQuery={searchQuery}
          matchedIds={matchedIds}
          isDark={isDark}
          onFindingClick={handleFindingClick}
        />

        {/* PDF area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* PDF scroll container */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '36px 28px 80px', background: dm.canvas, transition: 'background 0.2s' }}
            onClick={e => {
              if ((e.target as HTMLElement).closest('svg') === null) setPopover(null);
            }}
          >
            {pdfLoading && (
              <CentreMsg><Loader size={18} className="spin" /><span style={{ color: dm.muted, fontSize: '13px' }}>Rendering PDF…</span></CentreMsg>
            )}
            {pdfError && <FallbackView findings={findings} error={pdfError} dm={dm} />}
            {!isPdf && !pdfError && <FallbackView findings={findings} dm={dm} />}

            {isPdf && pdfDoc && !pdfLoading && Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
              <PdfPageCanvas
                key={p}
                pdfDoc={pdfDoc}
                pageNum={p}
                scale={scale}
                annotations={pageAnnotations.get(p) ?? []}
                activeId={activeId}
                searchQuery={searchQuery}
                matchedIds={matchedIds}
                isDark={isDark}
                onAnnotationClick={handleAnnotationClick}
                onVisible={handleOnVisible}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── ISSUE POPOVER ─────────────────────────────────────────────────── */}
      {popover && (
        <IssuePopover
          finding={popover.finding}
          x={popover.x}
          y={popover.y}
          isDark={isDark}
          dm={dm}
          onClose={() => setPopover(null)}
          onGoToPage={() => { scrollToPage(popover.finding.page); setPopover(null); }}
        />
      )}

      <style>{`
        .spin { animation: ae-spin 0.9s linear infinite; }
        @keyframes ae-spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #94a3b833; border-radius: 999px; }
      `}</style>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function Shell({ dm, isDark, children }: { dm: any; isDark: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', border: `1px solid ${dm.border}`, borderRadius: '12px', background: dm.bg }}>
      {children}
    </div>
  );
}

function CentreMsg({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6b7280' }}>{children}</div>;
}

function Sep({ dm }: { dm: any }) {
  return <div style={{ width: '1px', height: '20px', background: dm.border, flexShrink: 0, margin: '0 2px' }} />;
}

function Tbtn({ onClick, title, dm, disabled, style: extra, children }: {
  onClick: () => void; title: string; dm: any; disabled?: boolean; style?: React.CSSProperties; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        padding: '5px 6px', borderRadius: '6px', border: `1px solid ${dm.border}`,
        background: dm.surface, color: dm.text, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.4 : 1, transition: 'opacity 0.15s', flexShrink: 0,
        ...extra,
      }}
    >
      {children}
    </button>
  );
}

function iconBtnStyle(dm: any): React.CSSProperties {
  return { background: 'none', border: 'none', cursor: 'pointer', color: dm.muted, padding: '0', display: 'flex', alignItems: 'center', flexShrink: 0 };
}

function IssuePopover({ finding, x, y, isDark, dm, onClose, onGoToPage }: {
  finding: ReviewFinding; x: number; y: number; isDark: boolean; dm: any;
  onClose: () => void; onGoToPage: () => void;
}) {
  const cfg = SEVERITY_CONFIG[finding.severity];
  return (
    <div
      style={{
        position: 'fixed', top: y, left: x, width: '340px', zIndex: 9999,
        background: dm.toolbar, border: `1.5px solid ${isDark ? cfg.darkBorder ?? cfg.border : cfg.border}`,
        borderRadius: '10px', boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden', animation: 'popIn 0.12s ease-out',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 13px 9px', borderBottom: `1px solid ${dm.border}`, background: isDark ? cfg.darkBg ?? cfg.bg : cfg.bg }}>
        <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', background: cfg.color, color: '#fff' }}>
          {cfg.label}
        </span>
        {finding.annotationType && finding.annotationType !== 'sidebar_only' && (
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.3px',
            background: finding.annotationType === 'underline' ? '#fef2f2' : finding.annotationType === 'highlight' ? '#fffbeb' : '#eff6ff',
            color: finding.annotationType === 'underline' ? '#dc2626' : finding.annotationType === 'highlight' ? '#d97706' : '#2563eb',
          }}>
            {finding.annotationType === 'underline' ? 'Redline' : finding.annotationType === 'highlight' ? 'Highlight' : 'Insert Marker'}
          </span>
        )}
        <span style={{ fontSize: '13px', fontWeight: 700, color: dm.text, flex: 1, lineHeight: 1.2 }}>{finding.issue}</span>
        <button onClick={onClose} style={{ ...iconBtnStyle(dm), padding: '2px' }}><X size={14} /></button>
      </div>

      {/* Body */}
      <div style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: '9px', maxHeight: '340px', overflowY: 'auto' }}>
        {/* Evidence text (the exact offending span) */}
        {finding.evidenceText && (
          <p style={{ margin: 0, fontSize: '12px', fontStyle: 'italic', color: dm.muted, lineHeight: 1.5, borderLeft: `3px solid ${cfg.color}`, paddingLeft: '8px' }}>
            "{finding.evidenceText}"
          </p>
        )}
        {finding.annotationType === 'comment_marker' && finding.nearbyText && (
          <div style={{ fontSize: '11px', color: dm.muted, padding: '6px 8px', background: isDark ? '#1e293b' : '#eff6ff', borderRadius: '6px', borderLeft: '3px solid #2563eb' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#2563eb', display: 'block', marginBottom: '3px' }}>Insert after:</span>
            <span style={{ fontStyle: 'italic' }}>"{finding.nearbyText}"</span>
          </div>
        )}

        <PopSection label="Legal Basis" text={finding.legalReasoning} color={cfg.color} dm={dm} />
        <PopSection label="Suggestion"  text={finding.suggestion}      color={dm.muted}   dm={dm} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: `1px solid ${dm.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: dm.muted }}>Confidence</span>
            <div style={{ width: '60px', height: '3px', background: dm.border, borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${finding.confidenceScore * 100}%`, height: '100%', background: cfg.color }} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color }}>{Math.round(finding.confidenceScore * 100)}%</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: dm.muted }}>
              Pg {finding.page}{finding.paragraphNumber ? ` · ¶${finding.paragraphNumber}` : ''}
            </span>
            <button
              onClick={onGoToPage}
              style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Go to page
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes popIn { from { opacity:0; transform:scale(0.94) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </div>
  );
}

function PopSection({ label, text, color, dm }: { label: string; text: string; color: string; dm: any }) {
  return (
    <div>
      <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color, display: 'block', marginBottom: '3px' }}>{label}</span>
      <p style={{ margin: 0, fontSize: '11px', color: dm.subtext ?? dm.text, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

function FallbackView({ findings, error, dm }: { findings: ReviewFinding[]; error?: string; dm: any }) {
  const header = error
    ? 'PDF rendering failed — findings listed below.'
    : findings.length === 0
      ? 'No legal issues found in this document. The AI panel reviewed every clause and found nothing to flag.'
      : `PDF viewer unavailable — ${findings.length} finding${findings.length !== 1 ? 's' : ''} listed below.`;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', background: dm.toolbar, borderRadius: '10px', padding: '28px', border: `1px solid ${dm.border}` }}>
      {error && (
        <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '16px' }}>
          <AlertCircle size={13} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '12px', color: '#dc2626' }}>{error}</span>
        </div>
      )}
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: dm.muted, lineHeight: 1.5 }}>{header}</p>
      {findings.map(f => {
        const cfg = SEVERITY_CONFIG[f.severity];
        return (
          <div key={f.id} style={{ padding: '11px', marginBottom: '7px', border: `1px solid ${dm.border}`, borderRadius: '8px', background: dm.surface }}>
            <div style={{ display: 'flex', gap: '7px', marginBottom: '5px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', padding: '1px 5px', borderRadius: '3px', background: cfg.bg }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: '10px', color: dm.muted }}>Page {f.page} · Line {f.line}</span>
            </div>
            <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 600, color: dm.text }}>{f.issue}</p>
            <p style={{ margin: '0 0 3px', fontSize: '11px', color: dm.muted, fontStyle: 'italic' }}>"{f.exactText}"</p>
            <p style={{ margin: 0, fontSize: '11px', color: dm.text }}>{f.suggestion}</p>
          </div>
        );
      })}
    </div>
  );
}
