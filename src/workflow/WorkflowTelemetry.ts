import type { StageTiming, WorkflowState, WorkflowTelemetryPort, WorkflowTelemetrySpan } from './WorkflowTypes';

class NoopSpan implements WorkflowTelemetrySpan {
  setAttribute(): void {}
  recordException(): void {}
  end(): void {}
}

export class NoopWorkflowTelemetry implements WorkflowTelemetryPort {
  startSpan(): WorkflowTelemetrySpan { return new NoopSpan(); }
  recordMetric(): void {}
}

export class WorkflowTelemetry {
  private readonly timings: StageTiming[] = [];
  private readonly stateChanges: Array<{ state: WorkflowState; at: number }> = [];
  private readonly sink: WorkflowTelemetryPort;

  constructor(sink: WorkflowTelemetryPort = new NoopWorkflowTelemetry()) {
    this.sink = sink;
  }

  startSpan(name: string, attributes?: Record<string, unknown>): WorkflowTelemetrySpan {
    return this.sink.startSpan(name, attributes);
  }

  recordState(state: WorkflowState): void {
    this.stateChanges.push({ state, at: Date.now() });
    this.sink.recordMetric('mentor_workflow_state_change', 1, { state });
  }

  async time<T>(stage: StageTiming['stage'], operation: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await operation();
      const endedAt = Date.now();
      this.timings.push({ stage, startedAt, endedAt, durationMs: endedAt - startedAt, success: true });
      this.sink.recordMetric('mentor_workflow_stage_duration_ms', endedAt - startedAt, { stage, success: true });
      return result;
    } catch (error) {
      const endedAt = Date.now();
      this.timings.push({
        stage,
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        success: false,
        errorCode: error instanceof Error ? error.name : 'UnknownError',
      });
      this.sink.recordMetric('mentor_workflow_stage_duration_ms', endedAt - startedAt, { stage, success: false });
      throw error;
    }
  }

  getTimings(): StageTiming[] {
    return [...this.timings];
  }
}
