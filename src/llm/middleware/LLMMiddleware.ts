import type { RuntimeDecisionPacket } from '../types';
import { validateRuntimeDecisionPacket } from '../validators/LLMValidators';

export interface AuthContext {
  userId?: string;
  roles?: string[];
}

export type LLMNext<T> = (packet: RuntimeDecisionPacket) => Promise<T>;
export type LLMMiddleware<T> = (packet: RuntimeDecisionPacket, next: LLMNext<T>) => Promise<T>;

export class ValidationMiddleware {
  async handle<T>(packet: RuntimeDecisionPacket, next: LLMNext<T>): Promise<T> {
    return next(validateRuntimeDecisionPacket(packet));
  }
}

export class AuthenticationMiddleware {
  async handle<T>(packet: RuntimeDecisionPacket, next: LLMNext<T>): Promise<T> {
    if (!packet.studentId && packet.intent !== 'out_of_scope') {
      throw new Error('Authenticated studentId is required for LLM execution.');
    }
    return next(packet);
  }
}

export class AuthorizationMiddleware {
  async handle<T>(packet: RuntimeDecisionPacket, next: LLMNext<T>): Promise<T> {
    if (packet.promptRequest.safety?.assessmentMode && packet.promptRequest.safety.allowedAssistanceLevel === 'answer') {
      throw new Error('Assessment mode cannot authorize direct answer generation.');
    }
    return next(packet);
  }
}

export class MiddlewarePipeline {
  private readonly middleware: Array<{ handle<T>(packet: RuntimeDecisionPacket, next: LLMNext<T>): Promise<T> }>;

  constructor(middleware: Array<{ handle<T>(packet: RuntimeDecisionPacket, next: LLMNext<T>): Promise<T> }> = []) {
    this.middleware = middleware;
  }

  execute<T>(packet: RuntimeDecisionPacket, terminal: LLMNext<T>): Promise<T> {
    const chain = this.middleware.reduceRight<LLMNext<T>>(
      (next, middleware) => (current) => middleware.handle(current, next),
      terminal
    );
    return chain(packet);
  }
}
