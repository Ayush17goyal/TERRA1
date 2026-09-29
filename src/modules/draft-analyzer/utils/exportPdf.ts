import {
  PDFDocument, PDFName, PDFArray, PDFString, PDFNumber,
  rgb, StandardFonts, type PDFFont,
} from 'pdf-lib';
import type { ReviewFinding } from '../components/FindingsSidebar';
import type { LineBlock } from '../components/PdfPageCanvas';

// ── helpers ─────────────────────────────────────────────────────────────────────

function severityRgb(sev: string): [number, number, number] {
  switch (sev) {
    case 'critical': return [0.863, 0.149, 0.149];
    case 'high':     return [0.918, 0.349, 0.047];
    case 'medium':   return [0.851, 0.467, 0.024];
    case 'low':      return [0.086, 0.639, 0.290];
    default:         return [0.145, 0.388, 0.922];
  }
}

function severityLabel(sev: string) {
  return sev.charAt(0).toUpperCase() + sev.slice(1);
}

// BUG 3 FIX: if a single word is wider than maxWidth, force-break it character
// by character rather than looping forever with `line = word` never shrinking.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      // If the word itself exceeds maxWidth, break it character by character
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let fragment = '';
        for (const ch of word) {
          const next = fragment + ch;
          if (font.widthOfTextAtSize(next, size) <= maxWidth) {
            fragment = next;
          } else {
            if (fragment) lines.push(fragment);
            fragment = ch;
          }
        }
        line = fragment;
      } else {
        line = word;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function overallScore(findings: ReviewFinding[]): number {
  if (!findings.length) return 100;
  const w: Record<string, number> = { critical: 14, high: 7, medium: 3, low: 1, info: 0.3 };
  const penalty = findings.reduce((s, f) => s + (w[f.severity] ?? 0), 0);
  return Math.max(0, Math.round(100 - Math.min(penalty, 100)));
}

function scoreLabel(s: number) {
  if (s >= 85) return 'COMPLIANT';
  if (s >= 70) return 'LOW RISK';
  if (s >= 55) return 'MODERATE RISK';
  if (s >= 35) return 'HIGH RISK';
  return 'CRITICAL RISK';
}

function generateReviewId(draftId: string): string {
  const date = new Date();
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const suffix = draftId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `LGX-${y}${m}${d}-${suffix}`;
}

function formatTimestamp(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST';
}

// ── summary page builder ─────────────────────────────────────────────────────────

async function addSummaryPages(
  pdfDoc: PDFDocument,
  findings: ReviewFinding[],
  fileName: string,
  draftId: string,
): Promise<void> {
  const W = 595, H = 842; // A4
  const ML = 48, MR = 48, MT = 52; // margins
  const contentW = W - ML - MR;

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const score = overallScore(findings);
  const reviewId = generateReviewId(draftId);
  const timestamp = formatTimestamp();

  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;

  // ── helper: draw a line of text, return new y ──────────────────────────────
  function text(
    page: ReturnType<typeof pdfDoc.addPage>,
    str: string,
    x: number,
    y: number,
    { font = regular, size = 10, color = rgb(0.2, 0.2, 0.2) } = {},
  ) {
    page.drawText(str, { x, y, font, size, color });
    return y - size * 1.55;
  }

  function hRule(page: ReturnType<typeof pdfDoc.addPage>, y: number, opacity = 0.2) {
    page.drawRectangle({ x: ML, y, width: contentW, height: 0.75, color: rgb(0.5, 0.4, 0.1), opacity });
    return y - 10;
  }

  // ══ PAGE 1: cover + score ══════════════════════════════════════════════════
  const cover = pdfDoc.addPage([W, H]);
  let cy = H - MT;

  // Gold header bar
  cover.drawRectangle({ x: 0, y: H - 44, width: W, height: 44, color: rgb(0.706, 0.353, 0.035) });
  cover.drawText('LEGATRIXON', { x: ML, y: H - 29, font: bold, size: 16, color: rgb(1, 1, 1) });
  cover.drawText('AI Legal Audit Report', { x: ML + 120, y: H - 29, font: regular, size: 14, color: rgb(1, 0.95, 0.85) });

  cy = H - 44 - 32;

  // Title
  cover.drawText('Reviewed Document Audit', { x: ML, y: cy, font: bold, size: 22, color: rgb(0.1, 0.08, 0.02) });
  cy -= 14;
  const nameLines = wrapText(fileName, regular, 11, contentW);
  for (const l of nameLines) {
    cover.drawText(l, { x: ML, y: cy, font: oblique, size: 11, color: rgb(0.45, 0.4, 0.3) });
    cy -= 15;
  }
  cy -= 8;
  cy = hRule(cover, cy, 0.35);
  cy -= 4;

  // Metadata grid
  const meta = [
    ['Review ID',  reviewId],
    ['Generated',  timestamp],
    ['Total Findings', String(findings.length)],
    ['Overall Score',  `${score} / 100 — ${scoreLabel(score)}`],
  ];
  for (const [label, value] of meta) {
    cover.drawText(label, { x: ML, y: cy, font: bold, size: 10, color: rgb(0.55, 0.45, 0.15) });
    cover.drawText(value, { x: ML + 130, y: cy, font: regular, size: 10, color: rgb(0.15, 0.12, 0.05) });
    cy -= 17;
  }
  cy -= 8;
  cy = hRule(cover, cy);
  cy -= 10;

  // Severity summary boxes
  const SEV_ROWS: Array<{ sev: string; label: string }> = [
    { sev: 'critical', label: 'Critical' },
    { sev: 'high',     label: 'High'     },
    { sev: 'medium',   label: 'Medium'   },
    { sev: 'low',      label: 'Low'      },
    { sev: 'info',     label: 'Info'     },
  ];
  cover.drawText('Severity Breakdown', { x: ML, y: cy, font: bold, size: 12, color: rgb(0.2, 0.15, 0.05) });
  cy -= 18;

  const boxW = (contentW - 16) / 5;
  SEV_ROWS.forEach(({ sev, label }, i) => {
    const [r, g, b] = severityRgb(sev);
    const cnt = counts[sev] ?? 0;
    const bx = ML + i * (boxW + 4);
    cover.drawRectangle({ x: bx, y: cy - 42, width: boxW, height: 48, color: rgb(r * 0.15 + 0.85, g * 0.15 + 0.85, b * 0.15 + 0.85), borderColor: rgb(r, g, b), borderWidth: 1.2 });
    cover.drawText(String(cnt), { x: bx + boxW / 2 - (cnt > 9 ? 8 : 5), y: cy - 16, font: bold, size: 20, color: rgb(r, g, b) });
    cover.drawText(label, { x: bx + boxW / 2 - regular.widthOfTextAtSize(label, 8) / 2, y: cy - 32, font: regular, size: 8, color: rgb(r * 0.7, g * 0.7, b * 0.7) });
  });
  cy -= 62;
  cy = hRule(cover, cy);
  cy -= 10;

  // Disclaimer
  cover.drawText(
    'This report was generated by LEGATRIXON AI (Senior Advocate Review Engine). It is for informational',
    { x: ML, y: cy, font: oblique, size: 8.5, color: rgb(0.5, 0.5, 0.5) },
  );
  cy -= 12;
  cover.drawText(
    'purposes only and does not constitute legal advice. Consult a qualified advocate before relying on this audit.',
    { x: ML, y: cy, font: oblique, size: 8.5, color: rgb(0.5, 0.5, 0.5) },
  );
  cy -= 28;
  cy = hRule(cover, cy);
  cy -= 12;

  // ── Findings list (may span multiple pages) ──────────────────────────────────
  let fPage = pdfDoc.addPage([W, H]);
  let fy = H - MT;

  function pageHeader(pg: ReturnType<typeof pdfDoc.addPage>) {
    pg.drawRectangle({ x: 0, y: H - 28, width: W, height: 28, color: rgb(0.97, 0.96, 0.93) });
    pg.drawText(`LEGATRIXON — Findings Detail  ·  ${reviewId}`, {
      x: ML, y: H - 19, font: regular, size: 8.5, color: rgb(0.5, 0.42, 0.22),
    });
    return H - 28 - 20;
  }

  function pageFooter(pg: ReturnType<typeof pdfDoc.addPage>, pgNum: number) {
    pg.drawText(`Page ${pgNum}  ·  Generated ${timestamp}`, {
      x: ML, y: 22, font: regular, size: 8, color: rgb(0.65, 0.65, 0.65),
    });
    pg.drawText('LEGATRIXON AI Legal Audit', {
      x: W - MR - regular.widthOfTextAtSize('LEGATRIXON AI Legal Audit', 8), y: 22,
      font: regular, size: 8, color: rgb(0.65, 0.65, 0.65),
    });
  }

  fy = pageHeader(fPage);
  fPage.drawText('Detailed Findings', { x: ML, y: fy, font: bold, size: 14, color: rgb(0.1, 0.08, 0.02) });
  fy -= 22;

  let pageIdx = 2;
  pageFooter(fPage, pageIdx);

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const [r, g, b] = severityRgb(f.severity);
    const sevColor = rgb(r, g, b);
    const cardH = estimateFindingCardHeight(f, regular, contentW);

    if (fy - cardH < 52) {
      // new page
      pageIdx++;
      fPage = pdfDoc.addPage([W, H]);
      fy = pageHeader(fPage);
      fy -= 10;
      pageFooter(fPage, pageIdx);
    }

    // Card background
    fPage.drawRectangle({
      x: ML - 4, y: fy - cardH + 4, width: contentW + 8, height: cardH + 6,
      color: rgb(r * 0.04 + 0.96, g * 0.04 + 0.96, b * 0.04 + 0.96),
      borderColor: rgb(r * 0.6 + 0.4, g * 0.6 + 0.4, b * 0.6 + 0.4),
      borderWidth: 0.8,
    });

    // Severity stripe
    fPage.drawRectangle({ x: ML - 4, y: fy - cardH + 4, width: 4, height: cardH + 6, color: sevColor });

    // Index + severity badge
    const indexStr = `${i + 1}.`;
    fPage.drawText(indexStr, { x: ML + 4, y: fy - 1, font: bold, size: 10, color: rgb(0.4, 0.4, 0.4) });
    const badge = ` ${severityLabel(f.severity).toUpperCase()} `;
    const badgeW = bold.widthOfTextAtSize(badge, 8) + 2;
    fPage.drawRectangle({ x: ML + 20, y: fy - 3, width: badgeW, height: 12, color: sevColor });
    fPage.drawText(badge, { x: ML + 21, y: fy - 1, font: bold, size: 8, color: rgb(1, 1, 1) });

    // Category badge (if present)
    if (f.category) {
      const catLabel = f.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const catX = ML + 20 + badgeW + 6;
      fPage.drawText(catLabel, { x: catX, y: fy - 1, font: regular, size: 8, color: rgb(0.4, 0.35, 0.15) });
    }

    // Page + line ref
    const ref = `Page ${f.page}  ·  Line ${f.line}`;
    fPage.drawText(ref, {
      x: ML + MR + contentW - regular.widthOfTextAtSize(ref, 8.5),
      y: fy - 1, font: regular, size: 8.5, color: rgb(0.5, 0.5, 0.5),
    });
    fy -= 16;

    // Issue title
    const issueLines = wrapText(f.issue, bold, 11, contentW - 12);
    for (const l of issueLines) {
      fPage.drawText(l, { x: ML + 4, y: fy, font: bold, size: 11, color: rgb(0.1, 0.08, 0.02) });
      fy -= 14;
    }
    fy -= 2;

    // Evidence text or insert-after anchor
    const annotType = (f as any).annotationType ?? 'underline';
    const quoteText = annotType === 'comment_marker'
      ? (f as any).nearbyText ? `[Insert after] "${(f as any).nearbyText}"` : '[Missing clause — no anchor text]'
      : `"${(f as any).evidenceText || f.exactText}"`;
    const qtLines = wrapText(quoteText, oblique, 9, contentW - 16);
    for (const l of qtLines.slice(0, 2)) {
      fPage.drawText(l, { x: ML + 8, y: fy, font: oblique, size: 9, color: annotType === 'comment_marker' ? rgb(0.14, 0.39, 0.92) : rgb(0.45, 0.45, 0.45) });
      fy -= 12;
    }
    fy -= 3;

    // Legal basis
    fPage.drawText('Legal Basis:', { x: ML + 4, y: fy, font: bold, size: 8.5, color: sevColor });
    fy -= 12;
    const lbLines = wrapText(f.legalReasoning, regular, 8.5, contentW - 20);
    for (const l of lbLines.slice(0, 3)) {
      fPage.drawText(l, { x: ML + 12, y: fy, font: regular, size: 8.5, color: rgb(0.25, 0.22, 0.15) });
      fy -= 11;
    }
    fy -= 2;

    // Suggestion
    fPage.drawText('Suggestion:', { x: ML + 4, y: fy, font: bold, size: 8.5, color: rgb(0.1, 0.45, 0.2) });
    fy -= 12;
    const sgLines = wrapText(f.suggestion, regular, 8.5, contentW - 20);
    for (const l of sgLines.slice(0, 2)) {
      fPage.drawText(l, { x: ML + 12, y: fy, font: regular, size: 8.5, color: rgb(0.15, 0.35, 0.15) });
      fy -= 11;
    }

    fy -= 16;
  }
}

function estimateFindingCardHeight(f: ReviewFinding, _font: PDFFont, maxW: number): number {
  // rough estimate: title (2 lines) + quote (2 lines) + basis (3 lines) + suggestion (2 lines) + padding
  const titleLines = Math.ceil(f.issue.length / (maxW / 6.5));
  const qtLines    = Math.min(2, Math.ceil(f.exactText.length / (maxW / 5.5)));
  const lbLines    = Math.min(3, Math.ceil(f.legalReasoning.length / (maxW / 5.0)));
  const sgLines    = Math.min(2, Math.ceil(f.suggestion.length / (maxW / 5.0)));
  return 16 + titleLines * 14 + 5 + qtLines * 12 + 5 + 12 + lbLines * 11 + 4 + 12 + sgLines * 11 + 16;
}

// ── main export function ─────────────────────────────────────────────────────────

export async function exportAnnotatedPdf(
  fileUrl: string,
  findings: ReviewFinding[],
  blocks: LineBlock[],
  fileName: string,
  draftId: string,
): Promise<void> {
  // Fetch original PDF bytes
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const pdfBytes = await res.arrayBuffer();

  // Load with pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // Build block lookup: pageNumber -> sorted blocks
  const blocksByPage = new Map<number, LineBlock[]>();
  for (const b of blocks) {
    if (!blocksByPage.has(b.pageNumber)) blocksByPage.set(b.pageNumber, []);
    blocksByPage.get(b.pageNumber)!.push(b);
  }

  // Annotate each finding on its page
  // BUG 1 FIX: line numbers are 1-based indices into FILTERED (non-empty) blocks
  for (const finding of findings) {
    const page = pages[finding.page - 1];
    if (!page) continue;
    const nonEmpty = (blocksByPage.get(finding.page) ?? []).filter(b => b.textContent?.trim());
    const block = nonEmpty[finding.line - 1];
    if (!block) continue;

    const { height: pageH } = page.getSize();
    const [r, g, b] = severityRgb(finding.severity);

    // Convert top-left block coords → pdf-lib bottom-left
    const bBottom = pageH - (block.y + block.height);
    const bLeft   = block.x;
    const bWidth  = Math.max(block.width, 20);

    // ── Red underline ──────────────────────────────────────────────────────
    page.drawRectangle({
      x: bLeft,
      y: bBottom - 1.5,
      width: bWidth,
      height: 2,
      color: rgb(r, g, b),
      opacity: 0.88,
    });

    // ── Sticky-note annotation (clickable comment in PDF readers) ──────────
    const annotTypePdf = (finding as any).annotationType ?? 'underline';
    const evidenceLine = annotTypePdf === 'comment_marker'
      ? `Insert after: "${(finding as any).nearbyText ?? ''}"`
      : `Evidence: "${(finding as any).evidenceText || finding.exactText}"`;
    const content = [
      `[${finding.severity.toUpperCase()}] [${annotTypePdf.replace('_', ' ').toUpperCase()}] ${finding.issue}`,
      '',
      evidenceLine,
      '',
      `Legal Basis: ${finding.legalReasoning}`,
      '',
      `Suggestion: ${finding.suggestion}`,
      '',
      `Confidence: ${Math.round(finding.confidenceScore * 100)}%  |  LEGATRIXON AI`,
    ].join('\n');

    // Place annotation icon at right end of underline
    const noteX = bLeft + bWidth;
    const noteY = bBottom;

    const annot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [noteX - 16, noteY, noteX + 4, noteY + 16],
      Contents: PDFString.of(content),
      T: PDFString.of('LEGATRIXON AI'),
      C: [PDFNumber.of(r), PDFNumber.of(g), PDFNumber.of(b)],
      Open: false,
      Name: 'Comment',
      Subj: PDFString.of(finding.issue),
      CA: PDFNumber.of(0.9),
      F: PDFNumber.of(4), // print flag
    });
    const annotRef = pdfDoc.context.register(annot);

    const annotsKey = PDFName.of('Annots');
    const existing = page.node.lookup(annotsKey);
    if (existing instanceof PDFArray) {
      existing.push(annotRef);
    } else {
      page.node.set(annotsKey, pdfDoc.context.obj([annotRef]));
    }
  }

  // Add summary pages at end
  await addSummaryPages(pdfDoc, findings, fileName, draftId);

  // Save and trigger download
  const exported = await pdfDoc.save();
  const blob = new Blob([exported as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = fileName.replace(/\.pdf$/i, '');
  a.download = `LEGATRIXON_Review_${safeName}_${generateReviewId(draftId)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
