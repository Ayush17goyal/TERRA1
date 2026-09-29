import type { DraftingProject } from '../types/drafting.types';
import { DRAFT_COMPONENTS, countWords, nowIso, uid } from '../utils/draftingUtils';

const STORAGE_KEY = 'legatrixon.bare-act-drafting.workspace.v1';
const RECOVERY_KEY = 'legatrixon.bare-act-drafting.recovery.v1';

export function loadProjects(): DraftingProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as DraftingProject[] : [];
    return Array.isArray(parsed) && parsed.length ? parsed : [createProject('Untitled Bare Act Project')];
  } catch {
    return [createProject('Untitled Bare Act Project')];
  }
}

export function saveProjects(projects: DraftingProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function saveRecovery(project: DraftingProject): void {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify({ project, savedAt: nowIso() }));
}

export function loadRecovery(): { project: DraftingProject; savedAt: string } | undefined {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function createProject(title: string): DraftingProject {
  const id = uid('project');
  const now = nowIso();
  const components = DRAFT_COMPONENTS.map((component, index) => ({ id: uid('component'), type: component.type, label: component.label, status: index === 0 ? 'drafting' as const : 'not_started' as const, completed: false, order: index, text: '' }));
  const first = components[0];
  return {
    id,
    title,
    project: 'Bare Act drafting practice',
    lesson: 'Legislative drafting workspace',
    currentComponentId: first.id,
    status: 'drafting',
    reviewStatus: 'idle',
    masteryStatus: 'developing',
    archived: false,
    createdAt: now,
    updatedAt: now,
    components,
    versions: [{ id: uid('version'), projectId: id, componentId: first.id, label: 'Initial version', text: '', createdAt: now, wordCount: 0, characterCount: 0 }],
    reviews: [],
    revisions: [],
  };
}

export function makeVersion(projectId: string, componentId: string, text: string, label = 'Saved version') {
  return { id: uid('version'), projectId, componentId, label, text, createdAt: nowIso(), wordCount: countWords(text), characterCount: text.length };
}
