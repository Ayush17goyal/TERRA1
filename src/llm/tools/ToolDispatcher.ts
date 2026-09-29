import type { LLMToolCall, LLMToolResult } from '../types';

export type ToolHandler = (args: Record<string, unknown>, call: LLMToolCall) => Promise<unknown>;

export class ToolDispatcher {
  private readonly handlers = new Map<string, ToolHandler>();

  register(name: string, handler: ToolHandler): void {
    this.handlers.set(name, handler);
  }

  async dispatch(call: LLMToolCall): Promise<LLMToolResult> {
    const handler = this.handlers.get(call.name);
    if (!handler) {
      throw new Error(`No tool handler registered for ${call.name}`);
    }

    return {
      toolCallId: call.id,
      output: await handler(call.arguments, call),
    };
  }

  async dispatchAll(calls: LLMToolCall[]): Promise<LLMToolResult[]> {
    return Promise.all(calls.map((call) => this.dispatch(call)));
  }
}
