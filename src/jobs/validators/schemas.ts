import { z } from 'zod';
import type { JobEnvelope, MentorEvent } from '../types';

export const queueNameSchema = z.enum([
  'EmbeddingQueue',
  'DocumentIndexQueue',
  'KnowledgeRefreshQueue',
  'MasteryUpdateQueue',
  'WeaknessAnalysisQueue',
  'RevisionSchedulingQueue',
  'PromptLogQueue',
  'TelemetryQueue',
  'AnalyticsQueue',
  'CacheInvalidationQueue',
  'NotificationQueue',
]);

export const mentorEventNameSchema = z.enum([
  'StudentMessageReceived',
  'ResponseGenerated',
  'ResponseValidated',
  'LessonCompleted',
  'SkillMastered',
  'WeaknessDetected',
  'DraftSubmitted',
  'DraftReviewed',
  'RevisionSubmitted',
  'AssessmentCompleted',
  'QuizCompleted',
  'CapstoneReviewed',
  'DocumentUploaded',
  'BareActIndexed',
  'EmbeddingsGenerated',
  'KnowledgeUpdated',
  'PromptExecuted',
  'TelemetryRecorded',
]);

export const jobEnvelopeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  queueName: queueNameSchema,
  payload: z.record(z.string(), z.unknown()),
  attemptsMade: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  status: z.enum(['waiting', 'active', 'completed', 'failed', 'dead_lettered']),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  correlationId: z.string().optional(),
});

export const mentorEventSchema = z.object({
  id: z.string().min(1),
  name: mentorEventNameSchema,
  payload: z.record(z.string(), z.unknown()),
  occurredAt: z.string().min(1),
  correlationId: z.string().optional(),
  studentId: z.string().optional(),
  interactionId: z.string().optional(),
});

export function parseJobEnvelope<TPayload extends Record<string, unknown>>(job: JobEnvelope<TPayload>): JobEnvelope<TPayload> {
  return jobEnvelopeSchema.parse(job) as JobEnvelope<TPayload>;
}

export function parseMentorEvent<TPayload extends Record<string, unknown>>(event: MentorEvent<TPayload>): MentorEvent<TPayload> {
  return mentorEventSchema.parse(event) as MentorEvent<TPayload>;
}
