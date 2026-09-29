import type { DocumentRecord, DocumentRepository } from '../types';

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly records = new Map<string, DocumentRecord>();

  async findByChecksum(checksum: string, userId: string): Promise<DocumentRecord | undefined> {
    return [...this.records.values()].find((record) => record.checksum === checksum && record.userId === userId);
  }

  async create(record: DocumentRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async update(id: string, patch: Partial<DocumentRecord>): Promise<void> {
    const current = this.records.get(id);
    if (!current) throw new Error(`Document not found: ${id}`);
    this.records.set(id, { ...current, ...patch, updatedAt: new Date().toISOString() });
  }

  async nextVersion(checksum: string, userId: string): Promise<number> {
    const versions = [...this.records.values()]
      .filter((record) => record.checksum === checksum && record.userId === userId)
      .map((record) => record.version);
    return versions.length ? Math.max(...versions) + 1 : 1;
  }
}
