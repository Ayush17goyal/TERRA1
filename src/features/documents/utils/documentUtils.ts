import type { BareActNode, ManagedDocumentType, ManagedFileKind } from '../types/document.types';

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function readableBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function detectFileKind(fileName: string, mimeType = ''): ManagedFileKind {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf') || mimeType.includes('pdf')) return 'pdf';
  if (name.endsWith('.docx') || mimeType.includes('word')) return 'docx';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
  return 'txt';
}

export function inferDocumentType(fileName: string): ManagedDocumentType {
  const name = fileName.toLowerCase();
  if (name.includes('bare') || name.includes('act')) return 'bare_act';
  if (name.includes('draft')) return 'student_draft';
  if (name.includes('assignment')) return 'assignment';
  if (name.includes('rubric')) return 'rubric';
  if (name.includes('handout') || name.includes('teacher')) return 'teacher_material';
  if (name.includes('note')) return 'notes';
  return 'unknown';
}

export async function checksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function extractBareActStructure(text: string): BareActNode[] {
  const nodes: BareActNode[] = [];
  const lines = text.split('\n');
  const patterns: Array<{ type: BareActNode['type']; regex: RegExp }> = [
    { type: 'preamble', regex: /^\s*preamble\b/i },
    { type: 'part', regex: /^\s*part\s+[ivxlcdm\d]+/i },
    { type: 'chapter', regex: /^\s*chapter\s+[ivxlcdm\d]+/i },
    { type: 'section', regex: /^\s*(section\s+)?\d+[a-z]?\.?\s+/i },
    { type: 'schedule', regex: /^\s*schedule\b/i },
    { type: 'definition', regex: /\bmeans\b|\bincludes\b/i },
    { type: 'commencement', regex: /\bcommencement\b|\bcome into force\b/i },
    { type: 'extent', regex: /\bextent\b|\bextends to\b/i },
    { type: 'offence', regex: /\boffence\b|\bpunishable\b/i },
    { type: 'penalty', regex: /\bpenalty\b|\bfine\b|\bimprisonment\b/i },
    { type: 'rule_making_power', regex: /\bmake rules\b|\brule-making\b/i },
    { type: 'savings', regex: /\bsaving\b|\bsavings\b/i },
    { type: 'repeal', regex: /\brepeal\b/i },
  ];
  lines.forEach((line, index) => {
    const match = patterns.find((item) => item.regex.test(line));
    if (match) nodes.push({ id: `node-${index}`, type: match.type, label: line.trim().slice(0, 90), text: line.trim(), order: index });
  });
  if (lines[0]?.trim()) nodes.unshift({ id: 'node-title', type: 'title', label: lines[0].trim().slice(0, 90), text: lines[0].trim(), order: -1 });
  return nodes.slice(0, 240);
}

export function acceptedDocument(file: File): boolean {
  const name = file.name.toLowerCase();
  return ['.pdf', '.docx', '.txt', '.md', '.markdown'].some((suffix) => name.endsWith(suffix));
}
