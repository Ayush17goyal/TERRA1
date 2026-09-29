import { z } from 'zod';
import type { UploadedDocumentInput } from '../types';

export const pipelineDocumentTypeSchema = z.enum(['bare_act', 'student_draft', 'assignment', 'rubric', 'teacher_material', 'notes', 'unknown']);

export const uploadedDocumentInputSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  content: z.instanceof(Uint8Array),
  userId: z.string().min(1),
  projectId: z.string().optional(),
  declaredType: pipelineDocumentTypeSchema.optional(),
  jurisdiction: z.string().optional(),
});

export function parseUploadedDocumentInput(input: UploadedDocumentInput): UploadedDocumentInput {
  return uploadedDocumentInputSchema.parse(input);
}
