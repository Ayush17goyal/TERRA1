import type { DraftReviewResult, InlineFeedbackMarker } from '../types/drafting.types';
import { lineColumnAt, nowIso, uid } from './draftingUtils';

const issuePatterns: Array<{ title: string; expression: RegExp; explanation: string; principle: string }> = [
  { title: 'Missing duty-holder', expression: /\bshall\b(?![^.\n]{0,80}\b(person|authority|officer|government|board|registrar|licensee)\b)/i, explanation: 'A duty must identify who bears the obligation.', principle: 'Obligations should name the legal actor clearly.' },
  { title: 'Undefined term', expression: /\b(the|such)\s+[A-Z][A-Za-z]+\b/, explanation: 'Capitalised or special terms should be defined or used consistently.', principle: 'Definitions prevent interpretive drift.' },
  { title: 'Vague operative language', expression: /\bmay\s+take\s+necessary\s+steps\b|\bas\s+soon\s+as\s+possible\b|\bappropriate\s+action\b/i, explanation: 'Vague operative phrases weaken enforceability.', principle: 'Operative clauses should state concrete power, condition, and consequence.' },
  { title: 'Overbroad delegation', expression: /\bmay\s+make\s+rules\s+for\s+.*\bany\b/i, explanation: 'Delegated powers need a bounded subject matter.', principle: 'Rule-making powers should be tethered to the Act.' },
  { title: 'Weak commencement clause', expression: /\bcommence\b(?![^.\n]{0,100}\b(date|notification|appointed)\b)/i, explanation: 'Commencement clauses should specify how and when the Act comes into force.', principle: 'Temporal operation must be administratively certain.' },
  { title: 'Broken cross-reference', expression: /\bsection\s+\d+[A-Z]?\b/i, explanation: 'Cross-references should be checked against the current structure.', principle: 'Internal references must remain accurate after revision.' },
];

export function parseReviewResponse(rawText: string, projectId: string, componentId: string, draftText: string): DraftReviewResult {
  const section = (name: string) => extractSection(rawText, name);
  return {
    id: uid('review'),
    projectId,
    componentId,
    createdAt: nowIso(),
    learningObjective: section('Learning objective')[0],
    strengths: section('Strengths'),
    draftingIssues: section('Weaknesses').concat(section('Drafting issues')),
    educationalExplanations: section('Educational explanations').concat(section('Suggested improvements')),
    legislativePrinciples: section('Legislative drafting principles'),
    suggestedRevisionTasks: section('Suggested revision tasks').concat(section('Next action')),
    nextAction: section('Next action')[0],
    markers: inferMarkers(draftText),
    rawText,
  };
}

export function inferMarkers(text: string): InlineFeedbackMarker[] {
  const markers: InlineFeedbackMarker[] = [];
  for (const pattern of issuePatterns) {
    const match = pattern.expression.exec(text);
    if (!match || match.index === undefined) continue;
    const pos = lineColumnAt(text, match.index);
    markers.push({
      id: uid('marker'),
      line: pos.line,
      column: pos.column,
      severity: pattern.title.includes('Broken') || pattern.title.includes('Overbroad') ? 'error' : 'warning',
      title: pattern.title,
      explanation: pattern.explanation,
      principle: pattern.principle,
      resolved: false,
    });
  }
  return markers;
}

function extractSection(text: string, title: string): string[] {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\n)(?:#{1,3}\\s*)?${escaped}:?\\s*\\n([\\s\\S]*?)(?=\\n(?:#{1,3}\\s*)?[A-Z][A-Za-z ]{2,}:?\\s*\\n|$)`, 'i');
  const match = regex.exec(text);
  if (!match) return [];
  return match[1].split('\\n').map((line) => line.trim()).filter(Boolean).map((line) => line.replace(/^[-*]\s+|^\d+[.)]\s+/, '').trim()).filter(Boolean);
}
