import { Archive, Copy, Edit3, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { DraftingProject } from '../types/drafting.types';

export function ProjectManager({ projects, activeId, onSelect, onCreate, onRename, onArchive, onDuplicate, onDelete }: {
  projects: DraftingProject[];
  activeId?: string;
  onSelect(id: string): void;
  onCreate(): void;
  onRename(id: string, title: string): void;
  onArchive(id: string): void;
  onDuplicate(id: string): void;
  onDelete(id: string): void;
}) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const save = (id: string) => { onRename(id, title); setEditingId(undefined); };
  return (
    <aside className="draft-project-panel" aria-label="Drafting projects">
      <header><strong>Projects</strong><button type="button" onClick={onCreate}><Plus size={14} />New</button></header>
      <div className="draft-project-list">
        {projects.map((project) => {
          const completed = project.components.filter((component) => component.completed || component.text.trim()).length;
          return (
            <article key={project.id} className={project.id === activeId ? 'active' : ''}>
              {editingId === project.id ? <input value={title} autoFocus onChange={(event) => setTitle(event.target.value)} onBlur={() => save(project.id)} onKeyDown={(event) => { if (event.key === 'Enter') save(project.id); }} /> : <button type="button" onClick={() => onSelect(project.id)}><strong>{project.title}</strong><span>{completed}/{project.components.length} components · {project.status}</span></button>}
              <nav aria-label={`${project.title} actions`}>
                <button type="button" onClick={() => { setEditingId(project.id); setTitle(project.title); }}><Edit3 size={13} /></button>
                <button type="button" onClick={() => onDuplicate(project.id)}><Copy size={13} /></button>
                <button type="button" onClick={() => onArchive(project.id)}><Archive size={13} /></button>
                <button type="button" onClick={() => onDelete(project.id)}><Trash2 size={13} /></button>
              </nav>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
