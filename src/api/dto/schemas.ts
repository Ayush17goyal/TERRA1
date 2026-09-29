import { z } from 'zod';

const optionalStringArray = z.array(z.string()).optional();

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  moduleId: z.string().optional(),
  lessonId: z.string().optional(),
  projectId: z.string().optional(),
  studentLevel: z.enum(['beginner', 'developing', 'intermediate', 'advanced', 'capstone', 'professional_review']).default('beginner'),
  jurisdiction: z.string().optional(),
  patternNames: optionalStringArray,
  componentTypes: optionalStringArray,
});

export const draftReviewRequestSchema = chatRequestSchema.extend({
  draftText: z.string().min(1),
  draftObjective: z.string().optional(),
  componentType: z.string().optional(),
});

export const draftRevisionRequestSchema = draftReviewRequestSchema.extend({
  previousFeedback: z.string().optional(),
  draftId: z.string().optional(),
});

export const lessonActionRequestSchema = z.object({
  courseId: z.string().optional(),
  moduleId: z.string().min(1),
  lessonId: z.string().min(1),
  lessonTitle: z.string().optional(),
});

export const quizStartRequestSchema = lessonActionRequestSchema.extend({
  difficulty: z.string().optional(),
});

export const quizSubmitRequestSchema = quizStartRequestSchema.extend({
  answers: z.array(z.record(z.string(), z.unknown())),
});

export const assessmentRequestSchema = lessonActionRequestSchema.extend({
  assessmentId: z.string().min(1),
  submission: z.record(z.string(), z.unknown()).optional(),
});

export const capstoneReviewRequestSchema = draftReviewRequestSchema.extend({
  actStructure: z.string().optional(),
  completedComponents: z.array(z.string()).optional(),
  pendingComponents: z.array(z.string()).optional(),
});

export const bareActAnalysisRequestSchema = chatRequestSchema.extend({
  bareActTitle: z.string().optional(),
  excerpt: z.string().optional(),
  analysisFocus: z.string().optional(),
}).refine((value) => Boolean(value.bareActTitle || value.excerpt), {
  message: 'bareActTitle or excerpt is required.',
});

export const documentUploadRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
  documentType: z.enum(['bare_act', 'student_draft', 'assignment_prompt', 'teacher_note', 'other']).default('other'),
  projectId: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
export type DraftReviewRequestDto = z.infer<typeof draftReviewRequestSchema>;
export type DraftRevisionRequestDto = z.infer<typeof draftRevisionRequestSchema>;
export type LessonActionRequestDto = z.infer<typeof lessonActionRequestSchema>;
export type QuizStartRequestDto = z.infer<typeof quizStartRequestSchema>;
export type QuizSubmitRequestDto = z.infer<typeof quizSubmitRequestSchema>;
export type AssessmentRequestDto = z.infer<typeof assessmentRequestSchema>;
export type CapstoneReviewRequestDto = z.infer<typeof capstoneReviewRequestSchema>;
export type BareActAnalysisRequestDto = z.infer<typeof bareActAnalysisRequestSchema>;
export type DocumentUploadRequestDto = z.infer<typeof documentUploadRequestSchema>;
