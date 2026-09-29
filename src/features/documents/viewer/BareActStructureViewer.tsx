import { BookOpen, Gavel, Landmark, ListTree } from 'lucide-react';
import type { ManagedDocument } from '../types/document.types';

export function BareActStructureViewer({ document, onJump }: { document?: ManagedDocument; onJump(nodeId: string): void }) {
  if (!document || document.documentType !== 'bare_act') return <section className="bare-act-structure"><header><ListTree size={16} /><strong>Bare Act Structure</strong></header><p>Select a Bare Act to inspect extracted structure.</p></section>;
  const groups = ['title', 'preamble', 'part', 'chapter', 'section', 'schedule', 'definition', 'offence', 'penalty', 'commencement', 'extent', 'repeal', 'savings', 'rule_making_power'];
  return (
    <section className="bare-act-structure" aria-label="Bare Act extracted structure"><header><ListTree size={16} /><strong>Bare Act Structure</strong></header>{groups.map((group) => {
      const nodes = document.bareActStructure.filter((node) => node.type === group);
      if (!nodes.length) return null;
      return <article key={group}><h4>{icon(group)}{group.replace(/_/g, ' ')}</h4>{nodes.map((node) => <button type="button" key={node.id} onClick={() => onJump(node.id)}>{node.label}</button>)}</article>;
    })}</section>
  );
}

function icon(group: string) {
  if (group === 'offence' || group === 'penalty') return <Gavel size={14} />;
  if (group === 'section') return <BookOpen size={14} />;
  return <Landmark size={14} />;
}
