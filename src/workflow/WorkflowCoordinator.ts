import type { RuntimeDecisionPacket } from '../llm/types';
import { DecisionPipeline } from './DecisionPipeline';
import { ExecutionPipeline } from './ExecutionPipeline';
import { WorkflowContext } from './WorkflowContext';
import { WorkflowTelemetry } from './WorkflowTelemetry';
import type {
  CurriculumState,
  EducationalValidatorPort,
  LessonState,
  MasteryState,
  MentorWorkflowRequest,
  ProgressUpdatePort,
  PromptAssemblyPort,
  RuntimeOrchestratorPort,
  StudentProfile,
  StudentStatePort,
  WeaknessState,
  WorkflowAuthPort,
  WorkflowDependencies,
  WorkflowEventPort,
  WorkflowExecutionResult,
  WorkflowLoggerPort,
  WorkflowPersistencePort,
  WorkflowStreamEvent,
  WorkflowUser,
} from './WorkflowTypes';

export interface WorkflowCoordinatorOptions {
  dependencies: WorkflowDependencies;
}

export class WorkflowCoordinator {
  private readonly dependencies: WorkflowDependencies;

  constructor(options: WorkflowCoordinatorOptions) {
    this.dependencies = options.dependencies;
  }

  execute(request: MentorWorkflowRequest): Promise<WorkflowExecutionResult> {
    const context = new WorkflowContext(request);
    const telemetry = new WorkflowTelemetry(this.dependencies.telemetry);
    const decisionPipeline = new DecisionPipeline({
      documentProcessor: this.dependencies.documents,
      runtimeOrchestrator: this.dependencies.runtimeOrchestrator,
    });
    const executionPipeline = new ExecutionPipeline({ dependencies: this.dependencies, decisionPipeline, telemetry });
    return executionPipeline.execute(context);
  }

  stream(request: MentorWorkflowRequest): AsyncGenerator<WorkflowStreamEvent> {
    const context = new WorkflowContext({ ...request, mode: 'stream' });
    const telemetry = new WorkflowTelemetry(this.dependencies.telemetry);
    const decisionPipeline = new DecisionPipeline({
      documentProcessor: this.dependencies.documents,
      runtimeOrchestrator: this.dependencies.runtimeOrchestrator,
    });
    const executionPipeline = new ExecutionPipeline({ dependencies: this.dependencies, decisionPipeline, telemetry });
    return executionPipeline.stream(context);
  }
}

export class PassThroughRuntimeOrchestrator implements RuntimeOrchestratorPort {
  async run(packet: RuntimeDecisionPacket): Promise<RuntimeDecisionPacket> {
    return packet;
  }
}

export class NoopPromptAssemblyPort implements PromptAssemblyPort {
  async assemble(): Promise<{ version: string; estimatedTokens: number; warnings: string[] }> {
    return { version: 'preflight-disabled', estimatedTokens: 0, warnings: [] };
  }
}

export class NoopWorkflowPersistence implements WorkflowPersistencePort {
  readonly interactions: unknown[] = [];

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }

  async persistInteraction(record: Parameters<WorkflowPersistencePort['persistInteraction']>[0]): Promise<void> {
    this.interactions.push(record);
  }
}

export class NoopProgressUpdatePort implements ProgressUpdatePort {
  async updateMastery(): Promise<void> {}
  async updateWeaknesses(): Promise<void> {}
  async scheduleRevision(): Promise<void> {}
}

export class NoopWorkflowEventPort implements WorkflowEventPort {
  readonly events: Array<Parameters<WorkflowEventPort['emit']>[0]> = [];

  async emit(event: Parameters<WorkflowEventPort['emit']>[0]): Promise<void> {
    this.events.push(event);
  }
}

export class ConsoleWorkflowLogger implements WorkflowLoggerPort {
  info(data: unknown, message?: string): void { console.info(message ?? 'workflow info', data); }
  warn(data: unknown, message?: string): void { console.warn(message ?? 'workflow warn', data); }
  error(data: unknown, message?: string): void { console.error(message ?? 'workflow error', data); }
  debug(data: unknown, message?: string): void { console.debug(message ?? 'workflow debug', data); }
}

export class RequestUserAuthPort implements WorkflowAuthPort {
  async authenticate(request: MentorWorkflowRequest): Promise<WorkflowUser> {
    if (request.user) return request.user;
    throw new Error('Authenticated user required for mentor workflow execution.');
  }
}

export class StaticStudentStatePort implements StudentStatePort {
  async loadStudentProfile(user: WorkflowUser, request: MentorWorkflowRequest): Promise<StudentProfile> {
    const level = typeof request.body.studentLevel === 'string' ? request.body.studentLevel : 'beginner';
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      level: ['beginner', 'developing', 'intermediate', 'advanced', 'capstone', 'professional_review'].includes(level) ? level as StudentProfile['level'] : 'beginner',
      activeCourseId: typeof request.body.courseId === 'string' ? request.body.courseId : undefined,
    };
  }

  async loadCurriculumState(profile: StudentProfile, request: MentorWorkflowRequest): Promise<CurriculumState> {
    return {
      courseId: profile.activeCourseId,
      moduleId: typeof request.body.moduleId === 'string' ? request.body.moduleId : undefined,
      lessonId: typeof request.body.lessonId === 'string' ? request.body.lessonId : undefined,
    };
  }

  async loadLessonState(_profile: StudentProfile, curriculum: CurriculumState): Promise<LessonState> {
    return { lessonId: curriculum.lessonId, moduleId: curriculum.moduleId, status: curriculum.lessonId ? 'in_progress' : 'not_started', attempts: 0 };
  }

  async loadMastery(): Promise<MasteryState> {
    return { masteredSkills: [], developingSkills: [], confidenceEstimate: 'developing' };
  }

  async loadWeaknesses(): Promise<WeaknessState> {
    return { knownWeaknesses: [], repeatedMistakes: [], revisionNeeded: false, stuckStatus: false };
  }
}

export function createWorkflowDependencies(overrides: Partial<WorkflowDependencies> & Pick<WorkflowDependencies, 'knowledgeRetrieval' | 'llm' | 'validator'>): WorkflowDependencies {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    const missing = [
      !overrides.auth ? 'auth' : '',
      !overrides.studentState ? 'studentState' : '',
      !overrides.runtimeOrchestrator ? 'runtimeOrchestrator' : '',
      !overrides.knowledgeRetrieval ? 'knowledgeRetrieval' : '',
      !overrides.promptAssembly ? 'promptAssembly' : '',
      !overrides.llm ? 'llm' : '',
      !overrides.validator ? 'validator' : '',
      !overrides.persistence ? 'persistence' : '',
      !overrides.progress ? 'progress' : '',
      !overrides.events ? 'events' : '',
      !overrides.telemetry ? 'telemetry' : '',
      !overrides.logger ? 'logger' : '',
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(`Workflow dependencies are not production-ready: missing required dependencies [${missing.join(', ')}].`);
    }
  }
  return {
    auth: overrides.auth ?? new RequestUserAuthPort(),
    studentState: overrides.studentState ?? new StaticStudentStatePort(),
    runtimeOrchestrator: overrides.runtimeOrchestrator ?? new PassThroughRuntimeOrchestrator(),
    knowledgeRetrieval: overrides.knowledgeRetrieval,
    promptAssembly: overrides.promptAssembly ?? new NoopPromptAssemblyPort(),
    llm: overrides.llm,
    validator: overrides.validator as EducationalValidatorPort,
    persistence: overrides.persistence ?? new NoopWorkflowPersistence(),
    progress: overrides.progress ?? new NoopProgressUpdatePort(),
    documents: overrides.documents,
    events: overrides.events ?? new NoopWorkflowEventPort(),
    telemetry: overrides.telemetry,
    logger: overrides.logger,
  };
}

export function assertWorkflowReady(context: WorkflowContext): void {
  context.snapshot();
}

