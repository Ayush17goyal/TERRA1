import type { SupportedFileKind, UploadedDocumentInput } from '../types';

export class FileTypeDetector {
  detect(input: UploadedDocumentInput): SupportedFileKind {
    const name = input.fileName.toLowerCase();
    const mime = input.mimeType.toLowerCase();
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (mime.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx';
    if (mime.includes('markdown') || name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
    if (mime.includes('text') || name.endsWith('.txt')) return 'txt';
    throw new Error(`Unsupported document type: ${input.mimeType} (${input.fileName})`);
  }
}
