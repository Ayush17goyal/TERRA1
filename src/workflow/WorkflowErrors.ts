import type { WorkflowErrorPayload, WorkflowStageName } from './WorkflowTypes';

export class WorkflowError extends Error {
  readonly code: string;
  readonly stage?: WorkflowStageName;
  readonly recoverable: boolean;
  readonly details?: unknown;

  constructor(code: string, message: string, options: { stage?: WorkflowStageName; recoverable?: boolean; details?: unknown; cause?: unknown } = {}) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.stage = options.stage;
    this.recoverable = options.recoverable ?? false;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  toPayload(): WorkflowErrorPayload {
    return {
      code: this.code,
      message: this.message,
      stage: this.stage,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

export class WorkflowCancelledError extends WorkflowError {
  constructor(stage?: WorkflowStageName) {
    super('WORKFLOW_CANCELLED', 'The mentor workflow was cancelled.', { stage, recoverable: true });
    this.name = 'WorkflowCancelledError';
  }
}

export class WorkflowTimeoutError extends WorkflowError {
  constructor(stage: WorkflowStageName, timeoutMs: number) {
    super('WORKFLOW_TIMEOUT', `The mentor workflow stage timed out after ${timeoutMs}ms.`, {
      stage,
      recoverable: true,
      details: { timeoutMs },
    });
    this.name = 'WorkflowTimeoutError';
  }
}

export function toWorkflowError(error: unknown, stage?: WorkflowStageName): WorkflowError {
  if (error instanceof WorkflowError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new WorkflowError('WORKFLOW_STAGE_FAILED', message, { stage, recoverable: false, cause: error });
}
