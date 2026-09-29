import type { MentorEvent } from '../types';
import { QueueRegistry } from '../queues/QueueRegistry';

export class JobDispatchService {
  private readonly registry: QueueRegistry;

  constructor(registry: QueueRegistry) {
    this.registry = registry;
  }

  async dispatchEvent(event: MentorEvent): Promise<void> {
    const payload = {
      ...event.payload,
      eventId: event.id,
      eventName: event.name,
      correlationId: event.correlationId,
      studentId: event.studentId,
      interactionId: event.interactionId,
    };

    switch (event.name) {
      case 'DocumentUploaded':
        await this.registry.get('DocumentIndexQueue').add('chunk-document', payload);
        break;
      case 'DraftSubmitted':
        await this.registry.get('DocumentIndexQueue').add('index-draft', payload);
        break;
      case 'ResponseGenerated':
      case 'PromptExecuted':
        await this.registry.get('PromptLogQueue').add('log-prompt', payload);
        await this.registry.get('TelemetryQueue').add('record-telemetry', payload);
        break;
      case 'ResponseValidated':
        await this.registry.get('TelemetryQueue').add('record-validation', payload);
        break;
      case 'LessonCompleted':
      case 'SkillMastered':
      case 'AssessmentCompleted':
      case 'QuizCompleted':
        await this.registry.get('MasteryUpdateQueue').add('update-mastery', payload);
        await this.registry.get('AnalyticsQueue').add('aggregate-learning', payload);
        break;
      case 'WeaknessDetected':
      case 'DraftReviewed':
      case 'RevisionSubmitted':
        await this.registry.get('WeaknessAnalysisQueue').add('update-weaknesses', payload);
        await this.registry.get('RevisionSchedulingQueue').add('schedule-revision', payload);
        break;
      case 'CapstoneReviewed':
        await this.registry.get('AnalyticsQueue').add('aggregate-capstone', payload);
        break;
      case 'BareActIndexed':
      case 'EmbeddingsGenerated':
      case 'KnowledgeUpdated':
        await this.registry.get('KnowledgeRefreshQueue').add('refresh-knowledge', payload);
        await this.registry.get('CacheInvalidationQueue').add('invalidate-knowledge-cache', payload);
        break;
      case 'StudentMessageReceived':
      case 'TelemetryRecorded':
        await this.registry.get('TelemetryQueue').add('record-event', payload);
        break;
      default:
        await this.registry.get('TelemetryQueue').add('record-event', payload);
    }
  }
}
