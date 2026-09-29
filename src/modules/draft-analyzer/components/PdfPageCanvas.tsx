import { useEffect, useRef, useState } from 'react';
import type { ReviewFinding } from './FindingsSidebar';
import { SEVERITY_CONFIG } from './FindingsSidebar';

export interface LineBlock {
  id: string;
  pageNumber: number;
  blockIndex: number;
  textContent: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number | null;
}

export interface AnnotationSpan {
  startRatio: number; // 0.0–1.0 position within block width
  endRatio: number;
}

export interface PageAnnotation {
  finding: ReviewFinding;
  block: LineBlock;
  span: AnnotationSpan;
}

interface Props {
  pdfDoc: any;
  pageNum: number;
  scale: number;
  annotations: PageAnnotation[];
  activeId: string | null;
  searchQuery: string;
  matchedIds: Set<string>;
  isDark: boolean;
  onAnnotationClick: (id: string, clientX: number, clientY: number) => void;
  onVisible: (pageNum: number) => void;
}

// Severity → semi-transparent hex fill (for highlight rect)
const SEVERITY_FILL: Record<string, string> = {
  critical: '#dc262628',
  high:     '#ea580c22',
  medium:   '#d9770618',
  low:      '#16a34a14',
  info:     '#2563eb10',
};

// Letter badge for margin bubble
const SEV_LETTER: Record<string, string> = {
  critical: 'C', high: 'H', medium: 'M', low: 'L', info: 'I',
};

export default function PdfPageCanvas({
  pdfDoc, pageNum, scale, annotations, activeId,
  searchQuery, matchedIds, isDark,
  onAnnotationClick, onVisible,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageProxy, setPageProxy] = useState<any>(null);
  const [rendered, setRendered]   = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Lazy render: trigger when near viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setRendered(true); },
      { rootMargin: '800px' },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Current-page tracker
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.intersectionRatio > 0.4) onVisible(pageNum); },
      { threshold: [0.4] },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  // Fetch page proxy once
  useEffect(() => {
    if (!pdfDoc) return;
    pdfDoc.getPage(pageNum).then(setPageProxy).catch(console.error);
  }, [pdfDoc, pageNum]);

  // Render PDF page to canvas
  useEffect(() => {
    if (!rendered || !pageProxy || !canvasRef.current) return;
    const viewport = pageProxy.getViewport({ scale });
    const canvas   = canvasRef.current;
    const ctx      = canvas.getContext('2d')!;
    const w = Math.floor(viewport.width);
    const h = Math.floor(viewport.height);
    canvas.width  = w;
    canvas.height = h;
    setCanvasSize({ w, h });

    renderTaskRef.current?.cancel();
    const task = pageProxy.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    task.promise.catch((e: any) => {
      if (e?.name !== 'RenderingCancelledException') console.error('PDF render:', e);
    });
    return () => { renderTaskRef.current?.cancel(); };
  }, [rendered, pageProxy, scale]);

  const vw = canvasSize.w || Math.floor(612 * scale);
  const vh = canvasSize.h || Math.floor(792 * scale);
  const hasSearch = searchQuery.trim().length > 0;

  // Margin width for annotation bubbles (right side)
  const MARGIN = Math.round(28 * scale);

  return (
    <div
      ref={containerRef}
      data-page={pageNum}
      style={{
        position: 'relative',
        width: vw + MARGIN,
        height: vh,
        margin: '0 auto 40px',
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.5)'
          : '0 4px 24px rgba(0,0,0,0.15)',
        background: 'transparent',
        borderRadius: '2px',
        display: 'flex',
      }}
    >
      {/* PDF canvas */}
      <div style={{ position: 'relative', width: vw, height: vh, background: '#fff', borderRadius: '2px 0 0 2px', flexShrink: 0 }}>
        <canvas ref={canvasRef} style={{ display: 'block', borderRadius: '2px 0 0 2px' }} />

        {/* Main annotation SVG overlay */}
        {rendered && canvasSize.w > 0 && (
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: '2px 0 0 2px', overflow: 'visible' }}
            viewBox={`0 0 ${vw} ${vh}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {annotations.map(({ finding, block, span }) => {
              const blockX = block.x * scale;
              const blockY = block.y * scale;
              const blockW = Math.max(block.width * scale, 30);
              const blockH = Math.max((block.height || block.fontSize || 12) * scale, 10);

              // Compute sub-block span using character ratios
              const spanX = blockX + span.startRatio * blockW;
              const spanW = Math.max((span.endRatio - span.startRatio) * blockW, 8);

              const isActive  = activeId === finding.id;
              const isMatched = !hasSearch || matchedIds.has(finding.id);
              const cfg   = SEVERITY_CONFIG[finding.severity];
              const color = cfg.color;
              const fill  = SEVERITY_FILL[finding.severity] ?? '#dc262628';
              const opacity = hasSearch && !isMatched ? 0.1 : 1;
              const annotType = finding.annotationType ?? 'underline';

              return (
                <g
                  key={finding.id}
                  style={{ cursor: 'pointer', pointerEvents: 'all', opacity }}
                  onClick={(e) => onAnnotationClick(finding.id, e.clientX, e.clientY)}
                >
                  {/* ── UNDERLINE: incorrect/defective text ───────────────── */}
                  {annotType === 'underline' && (
                    <>
                      {/* Subtle tint behind the evidence span */}
                      <rect x={spanX - 1} y={blockY - 1} width={spanW + 2} height={blockH + 2} fill={fill} rx={1} />
                      {isActive && (
                        <rect x={spanX - 2} y={blockY - 2} width={spanW + 4} height={blockH + 4} fill={color} opacity={0.15} rx={2} />
                      )}
                      {/* Wavy-style double underline (two thin rects) */}
                      <rect x={spanX} y={blockY + blockH - 2} width={spanW} height={isActive ? 2.5 : 2} fill={color} opacity={0.9} rx={0.5} />
                      <rect x={spanX} y={blockY + blockH + 1} width={spanW} height={1} fill={color} opacity={0.4} rx={0.5} />
                    </>
                  )}

                  {/* ── HIGHLIGHT: ambiguous/risky language ───────────────── */}
                  {annotType === 'highlight' && (
                    <>
                      {/* Strong semi-transparent highlight over span */}
                      <rect
                        x={spanX - 1}
                        y={blockY - 1}
                        width={spanW + 2}
                        height={blockH + 2}
                        fill={color}
                        opacity={isActive ? 0.30 : 0.20}
                        rx={2}
                      />
                      {/* Bottom accent line */}
                      <rect x={spanX} y={blockY + blockH} width={spanW} height={isActive ? 2 : 1.5} fill={color} opacity={0.7} rx={0.5} />
                    </>
                  )}

                  {/* ── COMMENT MARKER: missing clause insertion point ─────── */}
                  {annotType === 'comment_marker' && (
                    <>
                      {/* Vertical insertion line at end of anchor block */}
                      <rect
                        x={blockX + blockW + 2}
                        y={blockY}
                        width={isActive ? 3 : 2}
                        height={blockH}
                        fill={color}
                        opacity={isActive ? 0.9 : 0.65}
                        rx={1}
                      />
                      {/* Insertion arrow (▶) */}
                      <polygon
                        points={`${blockX + blockW + 6},${blockY + blockH / 2 - 5} ${blockX + blockW + 6},${blockY + blockH / 2 + 5} ${blockX + blockW + 11},${blockY + blockH / 2}`}
                        fill={color}
                        opacity={isActive ? 1 : 0.75}
                      />
                      {/* Dashed horizontal guide line */}
                      <line
                        x1={blockX}
                        y1={blockY + blockH + 1}
                        x2={blockX + blockW}
                        y2={blockY + blockH + 1}
                        stroke={color}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        opacity={0.5}
                      />
                    </>
                  )}

                  {/* Invisible hit area for all types */}
                  <rect
                    x={annotType === 'comment_marker' ? blockX : spanX - 4}
                    y={blockY - 2}
                    width={annotType === 'comment_marker' ? blockW + 16 : spanW + 8}
                    height={blockH + 4}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Right-margin bubble strip */}
      {rendered && annotations.length > 0 && (
        <div
          style={{
            width: MARGIN,
            height: vh,
            position: 'relative',
            background: isDark ? '#0f172a' : '#f8f8f8',
            borderLeft: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
            borderRadius: '0 2px 2px 0',
            flexShrink: 0,
          }}
        >
          {annotations.map(({ finding, block }) => {
            const y     = block.y * scale;
            const h     = Math.max((block.height || block.fontSize || 12) * scale, 10);
            const midY  = y + h / 2;
            const isActive  = activeId === finding.id;
            const isMatched = !hasSearch || matchedIds.has(finding.id);
            const cfg   = SEVERITY_CONFIG[finding.severity];
            const color = cfg.color;
            const opacity = hasSearch && !isMatched ? 0.15 : 1;
            const bubbleR = isActive ? 10 : 8;
            const annotType = finding.annotationType ?? 'underline';
            // Icon: U=underline, H=highlight, +=insert marker
            const icon = annotType === 'comment_marker' ? '+'
              : annotType === 'highlight' ? SEV_LETTER[finding.severity]
              : SEV_LETTER[finding.severity];

            return (
              <div
                key={finding.id}
                title={`[${annotType.replace('_', ' ')}] ${finding.issue}`}
                onClick={(e) => onAnnotationClick(finding.id, e.clientX, e.clientY)}
                style={{
                  position: 'absolute',
                  top: Math.max(4, Math.min(vh - bubbleR * 2 - 4, midY - bubbleR)),
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: bubbleR * 2,
                  height: bubbleR * 2,
                  borderRadius: annotType === 'comment_marker' ? '3px' : '50%',
                  background: isActive ? color : (isDark ? cfg.darkBg : cfg.bg),
                  border: `${isActive ? 2 : 1.5}px solid ${color}`,
                  borderStyle: annotType === 'comment_marker' ? 'dashed' : 'solid',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: `${bubbleR * (annotType === 'comment_marker' ? 0.9 : 0.75)}px`,
                  fontWeight: 800,
                  color: isActive ? '#fff' : color,
                  opacity,
                  transition: 'all 0.12s ease',
                  zIndex: isActive ? 2 : 1,
                  boxShadow: isActive ? `0 0 0 3px ${color}30` : 'none',
                }}
              >
                {icon}
              </div>
            );
          })}
        </div>
      )}

      {/* Page label */}
      <div style={{
        position: 'absolute',
        bottom: '-26px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '11px',
        color: isDark ? '#6b7280' : '#9ca3af',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        letterSpacing: '0.3px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>{pageNum}</span>
        {annotations.length > 0 && (
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: '999px',
            background: isDark ? '#7f1d1d' : '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
          }}>
            {annotations.length} issue{annotations.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
