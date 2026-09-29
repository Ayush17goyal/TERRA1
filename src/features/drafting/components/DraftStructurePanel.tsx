import { CheckCircle2, Circle, FileText } from 'lucide-react';
import type { DraftComponent } from '../types/drafting.types';

export function DraftStructurePanel({ components, activeId, onSelect }: { components: DraftComponent[]; activeId?: string; onSelect(id: string): void }) {
  return (
    <section className="draft-structure-panel" aria-label="Draft structure">
      <header><FileText size={16} /><strong>Act Structure</strong></header>
      <nav>
        {components.map((component) => (
          <button type="button" key={component.id} className={component.id === activeId ? 'active' : ''} onClick={() => onSelect(component.id)}>
            {component.text.trim() || component.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
            <span>{component.order + 1}. {component.label}</span>
            <em>{component.status.replace(/_/g, ' ')}</em>
          </button>
        ))}
      </nav>
    </section>
  );
}
