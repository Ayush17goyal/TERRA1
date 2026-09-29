import { ResponseParser } from '../services/ResponseParser';
import type { LLMStreamEvent, LLMToolCall, OpenAIResponseResult, RuntimeDecisionPacket } from '../types';

export class ResponseStreamer {
  private readonly parser = new ResponseParser();

  async *stream(
    body: ReadableStream<Uint8Array>,
    packet: RuntimeDecisionPacket,
    buildCompletion: (text: string, raw: OpenAIResponseResult, toolCalls: LLMToolCall[], streamDurationMs: number) => Promise<LLMStreamEvent>
  ): AsyncGenerator<LLMStreamEvent> {
    const started = Date.now();
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let text = '';
    const toolCalls: LLMToolCall[] = [];
    let finalRaw: OpenAIResponseResult = {};

    try {
      while (true) {
        if (packet.abortSignal?.aborted) {
          yield { type: 'cancellation', requestId: packet.requestId, interactionId: packet.interactionId, timestamp: Date.now() };
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const data = this.extractData(event);
          if (!data || data === '[DONE]') continue;
          const parsed = JSON.parse(data) as Record<string, unknown>;
          const eventType = String(parsed.type ?? '');

          if (eventType.includes('delta')) {
            const delta = String(parsed.delta ?? '');
            if (delta) {
              text += delta;
              yield { type: 'text_delta', requestId: packet.requestId, interactionId: packet.interactionId, delta, timestamp: Date.now() };
            }
          } else if (eventType.includes('function_call') || eventType.includes('tool')) {
            const call = this.toolCallFromEvent(parsed);
            if (call) {
              toolCalls.push(call);
              yield { type: 'tool_event', requestId: packet.requestId, interactionId: packet.interactionId, toolCall: call, timestamp: Date.now() };
            }
          } else if (eventType.includes('completed')) {
            finalRaw = parsed.response as OpenAIResponseResult ?? parsed as OpenAIResponseResult;
            if (!text) text = this.parser.text(finalRaw);
          }
        }
      }

      yield await buildCompletion(text, finalRaw, toolCalls, Date.now() - started);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      yield { type: 'error', requestId: packet.requestId, interactionId: packet.interactionId, error: normalized, timestamp: Date.now() };
    } finally {
      reader.releaseLock();
    }
  }

  private extractData(event: string): string | undefined {
    return event
      .split('\n')
      .find((line) => line.startsWith('data:'))
      ?.slice('data:'.length)
      .trim();
  }

  private toolCallFromEvent(event: Record<string, unknown>): LLMToolCall | undefined {
    const name = event.name ?? event.tool_name;
    if (!name) return undefined;
    const args = typeof event.arguments === 'string' ? JSON.parse(event.arguments || '{}') : event.arguments ?? {};
    return {
      id: String(event.call_id ?? event.id ?? crypto.randomUUID()),
      name: String(name),
      arguments: args as Record<string, unknown>,
    };
  }
}

