export type DraftStatus = 'pending' | 'processing' | 'reviewed' | 'failed';

export interface Draft {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string | null;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
}

export type UploadPhase = 'idle' | 'uploading' | 'success' | 'error';

export interface UploadState {
  phase: UploadPhase;
  progress: number;
  draft: Draft | null;
  error: string | null;
}
