import { Clock, Save } from 'lucide-react';
import type { DraftVersion, RevisionRecord } from '../types/drafting.types';

export function VersionHistory({ versions, revisions, activeVersionId, onSelect }: { versions: DraftVersion[]; revisions: RevisionRecord[]; activeVersionId?: string; onSelect(id: string): void }) {
  return (
    <section className="draft-version-history" aria-label="Version and revision history">
      <header><Clock size={16} /><strong>History</strong></header>
      <div>
        {versions.map((version) => (
          <button key={version.id} type="button" className={version.id === activeVersionId ? 'active' : ''} onClick={() => onSelect(version.id)}>
            <Save size={13} /><span>{version.label}</span><em>{version.wordCount} words · {new Date(version.createdAt).toLocaleString()}</em>
          </button>
        ))}
      </div>
      <h4>Revision timeline</h4>
      {revisions.length ? revisions.map((revision) => <article key={revision.id}><strong>{new Date(revision.createdAt).toLocaleString()}</strong><p>{revision.notes || 'Revision submitted.'}</p><span>{revision.resolvedFeedbackIds.length} resolved · {revision.unresolvedFeedbackIds.length} unresolved</span></article>) : <p className="draft-muted">No revisions submitted yet.</p>}
    </section>
  );
}
