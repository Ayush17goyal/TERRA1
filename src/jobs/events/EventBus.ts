import type { MentorEvent, MentorEventName } from '../types';
import { parseMentorEvent } from '../validators/schemas';

export type EventHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = (event: MentorEvent<TPayload>) => Promise<void> | void;

export class EventBus {
  private readonly handlers = new Map<MentorEventName, EventHandler[]>();
  private readonly globalHandlers: EventHandler[] = [];

  on<TPayload extends Record<string, unknown>>(name: MentorEventName, handler: EventHandler<TPayload>): void {
    const handlers = this.handlers.get(name) ?? [];
    handlers.push(handler as EventHandler);
    this.handlers.set(name, handlers);
  }

  onAny(handler: EventHandler): void {
    this.globalHandlers.push(handler);
  }

  async emit<TPayload extends Record<string, unknown>>(event: Omit<MentorEvent<TPayload>, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string }): Promise<MentorEvent<TPayload>> {
    const parsed = parseMentorEvent({
      id: event.id ?? crypto.randomUUID(),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
      name: event.name,
      payload: event.payload,
      correlationId: event.correlationId,
      studentId: event.studentId,
      interactionId: event.interactionId,
    });
    const handlers = [...(this.handlers.get(parsed.name) ?? []), ...this.globalHandlers];
    await Promise.all(handlers.map((handler) => handler(parsed)));
    return parsed;
  }
}
