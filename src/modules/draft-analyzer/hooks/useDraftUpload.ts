import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { API_BASE_URL } from '../../../lib/api';
import type { Draft, UploadState } from '../types/draft-analyzer.types';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Only PDF, DOCX, and TXT files are supported.';
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Invalid file type. Please upload a PDF, DOCX, or TXT file.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File too large. Maximum size is 25 MB (yours: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
  }
  if (file.size === 0) {
    return 'File is empty.';
  }
  return null;
}

export function useDraftUpload() {
  const { getToken } = useAuth();
  const [uploadState, setUploadState] = useState<UploadState>({
    phase: 'idle',
    progress: 0,
    draft: null,
    error: null,
  });

  const reset = useCallback(() => {
    setUploadState({ phase: 'idle', progress: 0, draft: null, error: null });
  }, []);

  const uploadDraft = useCallback(
    (file: File): Promise<Draft> => {
      return new Promise(async (resolve, reject) => {
        const validationError = validateFile(file);
        if (validationError) {
          setUploadState({ phase: 'error', progress: 0, draft: null, error: validationError });
          return reject(new Error(validationError));
        }

        let token: string | null = null;
        try {
          token = await getToken();
        } catch {
          const msg = 'Authentication failed. Please refresh the page.';
          setUploadState({ phase: 'error', progress: 0, draft: null, error: msg });
          return reject(new Error(msg));
        }

        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadState((prev) => ({ ...prev, phase: 'uploading', progress: pct }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let draft: Draft;
            try {
              draft = JSON.parse(xhr.responseText);
            } catch {
              const msg = 'Server returned an unexpected response.';
              setUploadState({ phase: 'error', progress: 0, draft: null, error: msg });
              return reject(new Error(msg));
            }
            setUploadState({ phase: 'success', progress: 100, draft, error: null });
            resolve(draft);
          } else {
            let msg = `Upload failed (${xhr.status}).`;
            try {
              const body = JSON.parse(xhr.responseText);
              if (body?.message) msg = body.message;
            } catch { /* ignore */ }
            setUploadState({ phase: 'error', progress: 0, draft: null, error: msg });
            reject(new Error(msg));
          }
        });

        xhr.addEventListener('error', () => {
          const msg = 'Network error during upload. Check your connection.';
          setUploadState({ phase: 'error', progress: 0, draft: null, error: msg });
          reject(new Error(msg));
        });

        xhr.addEventListener('abort', () => {
          const msg = 'Upload was cancelled.';
          setUploadState({ phase: 'error', progress: 0, draft: null, error: msg });
          reject(new Error(msg));
        });

        setUploadState({ phase: 'uploading', progress: 0, draft: null, error: null });
        xhr.open('POST', `${API_BASE_URL}/draft-analyzer/upload`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
    },
    [getToken],
  );

  return { uploadDraft, uploadState, reset };
}
