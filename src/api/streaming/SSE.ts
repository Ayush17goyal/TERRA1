export interface SSEEvent {
  event: string;
  data: unknown;
  id?: string;
}

export class SSE {
  static encode(event: SSEEvent): string {
    const lines: string[] = [];
    if (event.id) lines.push(`id: ${event.id}`);
    lines.push(`event: ${event.event}`);
    lines.push(`data: ${JSON.stringify(event.data)}`);
    lines.push('');
    return lines.join('\n') + '\n';
  }

  static response(stream: ReadableStream<Uint8Array>): Response {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }
}
