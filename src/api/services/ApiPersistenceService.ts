import type { PersistenceAdapter } from '../types';

export class InMemoryPersistenceAdapter implements PersistenceAdapter {
  private readonly interactions: Record<string, unknown>[] = [];
  private readonly progress: Record<string, unknown>[] = [];
  private readonly documents: Record<string, unknown>[] = [];

  async saveInteraction(record: Record<string, unknown>): Promise<void> {
    this.interactions.push(record);
  }

  async saveProgress(record: Record<string, unknown>): Promise<void> {
    this.progress.push(record);
  }

  async getStudentResource(kind: 'progress' | 'mastery' | 'projects' | 'history', userId: string): Promise<unknown> {
    if (kind === 'history') return this.interactions.filter((record) => record.studentId === userId);
    if (kind === 'progress' || kind === 'mastery') return this.progress.filter((record) => record.studentId === userId);
    return [];
  }

  async getKnowledgeResource(kind: 'pattern' | 'lesson' | 'module', id: string): Promise<unknown> {
    return { id, kind };
  }

  async saveDocumentUpload(record: Record<string, unknown>): Promise<void> {
    this.documents.push(record);
  }
}
