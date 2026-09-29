import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { IngestedDocumentEntity } from '../entities/ingested-document.entity';
import { GateResult } from '../types/document-graph.types';

// architecture.md §3.3: "Duplicate detection: content-hash computed at Stage 0; an exact
// re-upload of an already-ingested document short-circuits to the existing KnowledgeBaseRecord
// rather than reprocessing and double-counting coverage."
@Injectable()
export class DuplicateDetectionGate {
  constructor(
    @InjectRepository(IngestedDocumentEntity)
    private readonly documents: Repository<IngestedDocumentEntity>,
  ) {}

  hash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async check(userId: string, contentHash: string): Promise<GateResult & { existing?: IngestedDocumentEntity }> {
    const existing = await this.documents.findOne({ where: { userId, contentHash } });
    if (existing) {
      return { passed: false, reason: 'duplicate_document', metadata: { existingDocumentId: existing.id }, existing };
    }
    return { passed: true };
  }
}
