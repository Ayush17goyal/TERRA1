export class ChecksumService {
  async sha256(content: Uint8Array): Promise<string> {
    const source = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
    const digest = await crypto.subtle.digest('SHA-256', source);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

