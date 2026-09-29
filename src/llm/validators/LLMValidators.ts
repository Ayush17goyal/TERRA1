import { z } from 'zod';
import type { RuntimeDecisionPacket } from '../types';

export const runtimeDecisionPacketSchema = z.object({
  requestId: z.string().min(1),
  interactionId: z.string().min(1),
  studentId: z.string().optional(),
  sessionId: z.string().optional(),
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
  promptRequest: z.object({
    userMessage: z.string().min(1),
    intent: z.string(),
    teachingStrategy: z.string(),
  }).passthrough(),
  retrieval: z.unknown().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  tools: z.array(z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    parameters: z.record(z.string(), z.unknown()),
  })).optional(),
  structuredOutput: z.unknown().optional(),
  cachePolicy: z.object({
    allowPromptCache: z.boolean().optional(),
    allowResponseCache: z.boolean().optional(),
    ttlMs: z.number().int().positive().optional(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  abortSignal: z.unknown().optional(),
});

export function validateRuntimeDecisionPacket(packet: RuntimeDecisionPacket): RuntimeDecisionPacket {
  return runtimeDecisionPacketSchema.parse(packet) as RuntimeDecisionPacket;
}

export function validateStructuredResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
