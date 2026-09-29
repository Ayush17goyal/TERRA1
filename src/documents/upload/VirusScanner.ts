import type { UploadedDocumentInput, VirusScanner } from '../types';

export class NoopVirusScanner implements VirusScanner {
  async scan(input: UploadedDocumentInput): Promise<{ safe: boolean; reason?: string }> {
    if (input.content.byteLength === 0) return { safe: false, reason: 'Empty file.' };
    return { safe: true };
  }
}
