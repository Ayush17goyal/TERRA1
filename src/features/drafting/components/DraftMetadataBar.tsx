import { Clock, GraduationCap, Layers, Target } from 'lucide-react';
import type { DraftComponent, DraftingProject, SaveStatus } from '../types/drafting.types';

export function DraftMetadataBar({ project, component, saveStatus }: { project: DraftingProject | undefined; component: DraftComponent | undefined; saveStatus: SaveStatus }) {
  if (!project) return null;
  return (
    <section className="draft-metadata-bar" aria-label="Draft metadata">
      <div><strong>{project.title}</strong><span>{project.project}</span></div>
      <span><Layers size={14} />{component?.label ?? 'No component'}</span>
      <span><Target size={14} />{project.status}</span>
      <span><GraduationCap size={14} />{project.masteryStatus}</span>
      <span><Clock size={14} />{saveStatus} · {new Date(project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </section>
  );
}
