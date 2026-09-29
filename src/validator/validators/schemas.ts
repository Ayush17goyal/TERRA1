import { z } from 'zod';

export const violationSeveritySchema = z.enum(['INFO', 'WARNING', 'ERROR', 'BLOCKING']);
export const validatorActionSchema = z.enum(['approve', 'repair', 'request_regeneration', 'block_response']);

export const validationViolationSchema = z.object({
  ruleId: z.string().min(1),
  ruleName: z.string().min(1),
  severity: violationSeveritySchema,
  message: z.string().min(1),
  evidence: z.string().optional(),
  repairable: z.boolean(),
});

export const validationTelemetryRecordSchema = z.object({
  requestId: z.string().min(1),
  interactionId: z.string().min(1),
  studentId: z.string().optional(),
  validationTimeMs: z.number().nonnegative(),
  rulesExecuted: z.array(z.string()),
  violations: z.array(validationViolationSchema),
  repairActions: z.array(z.string()),
  regenerationRequested: z.boolean(),
  approved: z.boolean(),
  action: validatorActionSchema,
});
