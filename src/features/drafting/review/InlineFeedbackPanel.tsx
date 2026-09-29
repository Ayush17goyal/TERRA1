import { CheckCircle2, Circle, MessageSquareWarning } from 'lucide-react';
import type { InlineFeedbackMarker } from '../types/drafting.types';

export function InlineFeedbackPanel({ markers, activeId, onSelect, onResolve }: { markers: InlineFeedbackMarker[]; activeId?: string; onSelect(id: string): void; onResolve(id: string): void }) {
  return (
    <section className="draft-inline-feedback" aria-label="Inline educational feedback">
      <header><MessageSquareWarning size={16} /><strong>Inline Feedback</strong></header>
      {markers.length === 0 ? <p>No inline issues detected yet. Submit a review for deeper feedback.</p> : markers.map((marker) => (
        <article key={marker.id} className={`${marker.severity} ${marker.id === activeId ? 'active' : ''}`}>
          <button type="button" onClick={() => onSelect(marker.id)}>
            {marker.resolved ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            <strong>{marker.title}</strong>
            <span>Line {marker.line}</span>
          </button>
          {marker.id === activeId && <div><p>{marker.explanation}</p>{marker.principle && <em>{marker.principle}</em>}<button type="button" onClick={() => onResolve(marker.id)}>{marker.resolved ? 'Mark unresolved' : 'Mark resolved'}</button></div>}
        </article>
      ))}
    </section>
  );
}
