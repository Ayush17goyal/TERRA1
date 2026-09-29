import type { DraftComponentType } from '../types/drafting.types';

export const DRAFT_COMPONENTS: Array<{ type: DraftComponentType; label: string }> = [
  { type: 'title', label: 'Title' },
  { type: 'preamble', label: 'Preamble' },
  { type: 'definitions', label: 'Definitions' },
  { type: 'commencement', label: 'Commencement' },
  { type: 'extent', label: 'Extent' },
  { type: 'application', label: 'Application' },
  { type: 'duties', label: 'Duties' },
  { type: 'powers', label: 'Powers' },
  { type: 'procedures', label: 'Procedures' },
  { type: 'offences', label: 'Offences' },
  { type: 'penalties', label: 'Penalties' },
  { type: 'appeals', label: 'Appeals' },
  { type: 'rule_making_powers', label: 'Rule-making Powers' },
  { type: 'schedules', label: 'Schedules' },
  { type: 'repeals', label: 'Repeals' },
  { type: 'savings', label: 'Savings' },
  { type: 'transitional_provisions', label: 'Transitional Provisions' },
];

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function lineColumnAt(text: string, index: number): { line: number; column: number } {
  const slice = text.slice(0, Math.max(0, index));
  const lines = slice.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function normalizeDraftText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[\t ]+$/gm, '').replace(/\n{4,}/g, '\n\n\n');
}
