import type { LLMToolCall, OpenAIResponseResult } from '../types';

export class ResponseParser {
  text(response: OpenAIResponseResult): string {
    if (typeof response.output_text === 'string') {
      return response.output_text;
    }

    const output = Array.isArray(response.output) ? response.output : [];
    return output.map((item) => this.textFromOutputItem(item)).filter(Boolean).join('\n');
  }

  json(response: OpenAIResponseResult): unknown {
    const text = this.text(response).trim();
    if (!text) {
      throw new Error('Structured response was empty.');
    }
    return JSON.parse(this.stripCodeFence(text));
  }

  toolCalls(response: OpenAIResponseResult): LLMToolCall[] {
    const output = Array.isArray(response.output) ? response.output : [];
    return output.flatMap((item) => this.toolCallsFromOutputItem(item));
  }

  private textFromOutputItem(item: unknown): string {
    const object = item as Record<string, unknown>;
    if (typeof object.content === 'string') return object.content;
    if (Array.isArray(object.content)) {
      return object.content.map((part) => {
        const p = part as Record<string, unknown>;
        return typeof p.text === 'string' ? p.text : '';
      }).join('');
    }
    if (typeof object.text === 'string') return object.text;
    return '';
  }

  private toolCallsFromOutputItem(item: unknown): LLMToolCall[] {
    const object = item as Record<string, unknown>;
    if (object.type !== 'function_call') return [];
    const rawArguments = typeof object.arguments === 'string' ? JSON.parse(object.arguments || '{}') : object.arguments ?? {};
    return [{
      id: String(object.call_id ?? object.id ?? crypto.randomUUID()),
      name: String(object.name),
      arguments: rawArguments as Record<string, unknown>,
    }];
  }

  private stripCodeFence(text: string): string {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
}
