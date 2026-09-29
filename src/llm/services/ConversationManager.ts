export interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: string;
}

export class ConversationManager {
  private readonly conversations = new Map<string, ConversationMessage[]>();
  private readonly maxMessages: number;

  constructor(maxMessages = 20) {
    this.maxMessages = maxMessages;
  }

  append(sessionId: string | undefined, message: ConversationMessage): void {
    if (!sessionId) return;
    const messages = [...(this.conversations.get(sessionId) ?? []), message].slice(-this.maxMessages);
    this.conversations.set(sessionId, messages);
  }

  get(sessionId: string | undefined): ConversationMessage[] {
    if (!sessionId) return [];
    return this.conversations.get(sessionId) ?? [];
  }
}
