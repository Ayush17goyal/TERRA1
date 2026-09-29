import { z } from 'zod';

export const moduleFormSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(8),
  order: z.coerce.number().int().min(1),
  status: z.enum(['draft', 'published', 'unpublished']),
  prerequisites: z.string().optional(),
  masteryCriteria: z.string().optional(),
});

export const lessonFormSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(3),
  objectives: z.string().min(5),
  prerequisites: z.string().optional(),
  estimatedMinutes: z.coerce.number().int().min(5),
  status: z.enum(['draft', 'published', 'locked']),
});

export const patternFormSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'professional']),
  status: z.enum(['draft', 'review', 'published']),
  checklist: z.string().min(3),
  commonMistakes: z.string().min(3),
  examples: z.string().optional(),
});

export const settingsSchema = z.object({
  model: z.string().min(3),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().int().min(256).max(200000),
  streaming: z.boolean(),
  promptVersion: z.string().min(1),
  embeddingModel: z.string().min(3),
  vectorTopK: z.coerce.number().int().min(1).max(100),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(10000),
  maintenanceMode: z.boolean(),
});

export const roleAssignmentSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'instructor', 'student']),
  permissions: z.string().min(2),
});

export const notificationSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(8),
  audience: z.enum(['all', 'students', 'instructors', 'admins']),
  severity: z.enum(['info', 'warning', 'maintenance']),
  published: z.boolean(),
});
