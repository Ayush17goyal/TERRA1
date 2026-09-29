import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { IngestedDocumentEntity } from './entities/ingested-document.entity';
import { DocumentKnowledgeRecordEntity } from './entities/document-knowledge-record.entity';
import { DuplicateDetectionGate } from './gates/duplicate-detection.gate';
import { DocumentEngineQueueService } from './document-engine-queue.service';
import { MAX_UPLOAD_BYTES, STORAGE_ROOT_SUBDIR, SUPPORTED_EXTENSIONS } from './document-engine.constants';
import { VirusScannerService } from '../../hardening/security/virus-scanner.service';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class DocumentEngineService {
  constructor(
    @InjectRepository(IngestedDocumentEntity)
    private readonly documents: Repository<IngestedDocumentEntity>,
    @InjectRepository(DocumentKnowledgeRecordEntity)
    private readonly knowledgeRecords: Repository<DocumentKnowledgeRecordEntity>,
    private readonly duplicateGate: DuplicateDetectionGate,
    private readonly queue: DocumentEngineQueueService,
    private readonly virusScanner: VirusScannerService,
  ) {}

  async submit(userId: string, file: UploadedFileLike, documentTypeHint?: string): Promise<IngestedDocumentEntity> {
    if (!file) {
      throw new BadRequestException('Multipart file payload missing');
    }

    const scan = await this.virusScanner.scanBuffer(file.buffer, file.originalname);
    if (!scan.clean) {
      throw new BadRequestException(`Upload rejected by virus scanner (${scan.engine}): ${scan.details || 'unsafe file'}`);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File exceeds maximum upload size of ${MAX_UPLOAD_BYTES} bytes`);
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Format not supported. Please upload one of: ${SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}.`,
      );
    }

    const contentHash = this.duplicateGate.hash(file.buffer);
    const duplicate = await this.duplicateGate.check(userId, contentHash);
    if (!duplicate.passed) {
      // architecture.md §3.3: short-circuit to the existing record rather than reprocessing.
      return duplicate.existing!;
    }

    const safeUserId = this.safePathSegment(userId);
    const uploadDir = path.resolve(process.cwd(), ...STORAGE_ROOT_SUBDIR, safeUserId);
    fs.mkdirSync(uploadDir, { recursive: true });

    // The id is generated client-side (rather than left to the DB default) so the storage path
    // can be computed and the file written to disk before the very first insert — storagePath
    // is a required column, and inserting the row first with it unset (then updating it in a
    // second save once the id was known) violated that NOT NULL constraint at runtime.
    const id = crypto.randomUUID();
    const safeFileName = this.safePathSegment(file.originalname);
    const storagePath = path.join(uploadDir, `${id}-${safeFileName}`);
    fs.writeFileSync(storagePath, file.buffer);

    const document = this.documents.create({
      id,
      userId,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      contentHash,
      status: 'queued',
      documentTypeHint: documentTypeHint || null,
      stageProgress: {},
      storagePath,
    });
    await this.documents.save(document);

    this.queue.enqueue(document.id);
    return document;
  }

  async listForUser(userId: string): Promise<IngestedDocumentEntity[]> {
    return this.documents.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async getStatus(userId: string, documentId: string): Promise<IngestedDocumentEntity> {
    const document = await this.documents.findOne({ where: { id: documentId, userId } });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async getKnowledgeRecord(userId: string, documentId: string): Promise<DocumentKnowledgeRecordEntity> {
    const document = await this.getStatus(userId, documentId);
    if (!['completed', 'needs_review', 'building_knowledge', 'knowledge_ready'].includes(document.status)) {
      throw new BadRequestException(`Document is not yet ready (status: ${document.status})`);
    }
    const record = await this.knowledgeRecords.findOne({ where: { documentId } });
    if (!record) throw new NotFoundException('Knowledge base record not found');
    return record;
  }

  private safePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
  }
}


