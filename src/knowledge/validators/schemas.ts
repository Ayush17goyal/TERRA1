import { z } from 'zod';
import type { KnowledgeRetrievalRequest, RetrievalQuery } from '../types';

const knowledgeKindSchema = z.enum([
  'curriculum',
  'lesson',
  'student_state',
  'mastery',
  'weakness',
  'draft_history',
  'revision_history',
  'previous_feedback',
  'pattern',
  'bare_act_component',
  'assessment_rule',
  'capstone_project',
  'prompt_module',
  'teaching_rule',
  'behaviour_rule',
]);

export const knowledgeRetrievalRequestSchema = z.object({
  userId: z.string().optional(),
  courseId: z.string().optional(),
  moduleId: z.string().optional(),
  lessonId: z.string().optional(),
  projectId: z.string().optional(),
  draftId: z.string().optional(),
  userMessage: z.string().min(1),
  normalizedMessage: z.string().optional(),
  intent: z.enum([
    'learning',
    'drafting',
    'review',
    'revision',
    'quiz',
    'assessment',
    'capstone',
    'bare_act_analysis',
    'out_of_scope',
    'mixed',
    'low_confidence',
  ]),
  teachingStrategy: z.enum([
    'teach',
    'question',
    'hint',
    'review',
    'demonstrate',
    'quiz',
    'assessment_feedback',
    'revision_guidance',
    'capstone_review',
    'safe_redirect',
  ]),
  studentLevel: z.enum(['beginner', 'developing', 'intermediate', 'advanced', 'capstone', 'professional_review']),
  currentLessonTitle: z.string().optional(),
  currentModuleTitle: z.string().optional(),
  patternNames: z.array(z.string()).optional(),
  componentTypes: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  difficulty: z.string().optional(),
  masteryState: z.string().optional(),
  tokenBudget: z.number().int().positive().optional(),
  includeKinds: z.array(knowledgeKindSchema).optional(),
});

export const retrievalQuerySchema = z.object({
  text: z.string().min(1),
  intent: knowledgeRetrievalRequestSchema.shape.intent,
  teachingStrategy: knowledgeRetrievalRequestSchema.shape.teachingStrategy,
  studentLevel: knowledgeRetrievalRequestSchema.shape.studentLevel,
  kinds: z.array(knowledgeKindSchema).min(1),
  mode: z.enum(['vector', 'keyword', 'hybrid']),
  filters: z.record(z.string(), z.unknown()),
  limit: z.number().int().positive(),
  tokenBudget: z.number().int().positive(),
  recencyBoost: z.boolean().optional(),
  requiredIds: z.array(z.string()).optional(),
});

export function parseKnowledgeRetrievalRequest(input: KnowledgeRetrievalRequest): KnowledgeRetrievalRequest {
  return knowledgeRetrievalRequestSchema.parse(input) as KnowledgeRetrievalRequest;
}

export function parseRetrievalQuery(input: RetrievalQuery): RetrievalQuery {
  return retrievalQuerySchema.parse(input) as RetrievalQuery;
}

