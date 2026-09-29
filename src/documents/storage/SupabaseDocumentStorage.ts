import type { DocumentStorage, StoredDocumentObject, UploadedDocumentInput } from '../types';

export interface SupabaseStorageLike {
  storage: {
    from(bucket: string): {
      upload(path: string, body: Uint8Array, options?: Record<string, unknown>): Promise<{ data?: { path?: string }; error?: unknown }>;
      getPublicUrl(path: string): { data?: { publicUrl?: string } };
    };
  };
}

export class SupabaseDocumentStorage implements DocumentStorage {
  private readonly client: SupabaseStorageLike;
  private readonly bucket: string;

  constructor(client: SupabaseStorageLike, bucket = 'mentor-documents') {
    this.client = client;
    this.bucket = bucket;
  }

  async upload(input: UploadedDocumentInput, documentId: string, version: number): Promise<StoredDocumentObject> {
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${input.userId}/${documentId}/v${version}/${safeName}`;
    const bucket = this.client.storage.from(this.bucket);
    const { error } = await bucket.upload(storagePath, input.content, {
      contentType: input.mimeType,
      upsert: true,
    });
    if (error) throw new Error(`Supabase upload failed: ${JSON.stringify(error)}`);
    return {
      storagePath,
      publicUrl: bucket.getPublicUrl(storagePath).data?.publicUrl,
      sizeBytes: input.content.byteLength,
    };
  }
}
