import { GitCompareArrows } from 'lucide-react';
import type { DraftVersion } from '../types/drafting.types';
import { diffLines } from '../utils/diff';

export function VersionComparison({ previous, currentText }: { previous?: DraftVersion; currentText: string }) {
  const rows = diffLines(previous?.text ?? '', currentText);
  return (
    <section className="draft-version-compare" aria-label="Version comparison">
      <header><GitCompareArrows size={16} /><strong>Version Comparison</strong><span>{previous?.label ?? 'No saved version selected'}</span></header>
      <div className="draft-diff-grid">
        <div className="draft-diff-heading">Previous</div><div className="draft-diff-heading">Current</div>
        {rows.map((row) => (
          <div className={`draft-diff-row ${row.type}`} key={row.id}>
            <pre><b>{row.lineNumber}</b>{row.previous ?? ''}</pre>
            <pre><b>{row.lineNumber}</b>{row.current ?? ''}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
