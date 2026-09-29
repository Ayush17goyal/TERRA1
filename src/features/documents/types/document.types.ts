export type ManagedDocumentType = 'bare_act' | 'student_draft' | 'assignment' | 'rubric' | 'teacher_material' | 'notes' | 'unknown';
export type ManagedFileKind = 'pdf' | 'docx' | 'txt' | 'markdown';
export type ProcessingStatus = 'queued' | 'uploading' | 'validating' | 'processing' | 'extracting' | 'indexing' | 'indexed' | 'failed' | 'duplicate' | 'archived';
export type Visibility = 'private' | 'course' | 'platform';

export interface DocumentVersion {
  id: string;
  version: number;
  fileName: string;
  uploadedAt: string;
  sizeBytes: number;
  checksum?: string;
  changeSummary: string;
  textPreview?: string;
}

export interface BareActNode {
  id: string;
  type: 'title' | 'preamble' | 'part' | 'chapter' | 'section' | 'sub_section' | 'schedule' | 'definition' | 'rule_making_power' | 'offence' | 'penalty' | 'savings' | 'repeal' | 'commencement' | 'extent';
  label: string;
  text: string;
  order: number;
}

export interface AiDocumentAnalysis {
  classification: ManagedDocumentType;
  confidence: number;
  extractedPatterns: string[];
  indexedChunks: number;
  draftingComponents: string[];
  processingSummary: string;
  errors: string[];
}

export interface ManagedDocument {
  id: string;
  title: string;
  description?: string;
  fileName: string;
  fileKind: ManagedFileKind;
  mimeType: string;
  documentType: ManagedDocumentType;
  ownerId: string;
  ownerName: string;
  tags: string[];
  category: string;
  moduleId?: string;
  lessonId?: string;
  visibility: Visibility;
  sizeBytes: number;
  version: number;
  status: ProcessingStatus;
  indexingStatus: ProcessingStatus;
  uploadedAt: string;
  updatedAt: string;
  checksum?: string;
  objectUrl?: string;
  textContent?: string;
  pageCount?: number;
  bookmarks: string[];
  bareActStructure: BareActNode[];
  analysis: AiDocumentAnalysis;
  versions: DocumentVersion[];
  archived?: boolean;
}

export interface UploadJob {
  id: string;
  file?: File;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  progress: number;
  status: ProcessingStatus;
  checksum?: string;
  duplicateOf?: string;
  error?: string;
  documentId?: string;
}

export interface DocumentFilters {
  query: string;
  documentType: 'all' | ManagedDocumentType;
  status: 'all' | ProcessingStatus;
  category: string;
  tag: string;
  moduleId?: string;
  lessonId?: string;
  semantic: boolean;
  sortBy: 'relevance' | 'uploadedAt' | 'title' | 'type' | 'status' | 'size';
  sortDirection: 'asc' | 'desc';
}

export interface ProcessingMetric {
  label: string;
  value: number;
  status: 'healthy' | 'warning' | 'error';
}

export interface DocumentTelemetryEvent {
  id: string;
  message: string;
  status: ProcessingStatus;
  createdAt: string;
  documentId?: string;
}

