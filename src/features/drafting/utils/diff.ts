export type DiffPartType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface DiffLine {
  id: string;
  type: DiffPartType;
  previous?: string;
  current?: string;
  lineNumber: number;
}

export function diffLines(previousText: string, currentText: string): DiffLine[] {
  const previous = previousText.split('\n');
  const current = currentText.split('\n');
  const max = Math.max(previous.length, current.length);
  const rows: DiffLine[] = [];
  for (let index = 0; index < max; index += 1) {
    const before = previous[index];
    const after = current[index];
    let type: DiffPartType = 'unchanged';
    if (before === undefined) type = 'added';
    else if (after === undefined) type = 'removed';
    else if (before !== after) type = 'modified';
    rows.push({ id: `diff-${index}`, type, previous: before, current: after, lineNumber: index + 1 });
  }
  return rows;
}
