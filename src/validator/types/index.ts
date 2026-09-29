import type { LLMResponse, RuntimeDecisionPacket } from '../../llm/types';

export type ViolationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING';
export type ValidatorAction = 'approve' | 'repair' | 'request_regeneration' | 'block_response';

export interface ValidationViolation {
  ruleId: string;
  ruleName: string;
  severity: ViolationSeverity;
  message: string;
  evidence?: string;
  repairable: boolean;
}

export interface ValidationContext {
  packet: RuntimeDecisionPacket;
  response: LLMResponse;
  text: string;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  violations: ValidationViolation[];
}

export interface GuardrailRule {
  readonly id: string;
  readonly name: string;
  check(context: ValidationContext): RuleResult;
}

export interface RepairResult {
  repaired: boolean;
  text: string;
  actions: string[];
  violationsRepaired: string[];
}

export interface ValidationTelemetryRecord {
  requestId: string;
  interactionId: string;
  studentId?: string;
  validationTimeMs: number;
  rulesExecuted: string[];
  violations: ValidationViolation[];
  repairActions: string[];
  regenerationRequested: boolean;
  approved: boolean;
  action: ValidatorAction;
}

export interface ValidationOutcome {
  action: ValidatorAction;
  approved: boolean;
  response: LLMResponse;
  repairedText?: string;
  violations: ValidationViolation[];
  ruleResults: RuleResult[];
  telemetry: ValidationTelemetryRecord;
}

export interface RegenerationRequest {
  packet: RuntimeDecisionPacket;
  response: LLMResponse;
  violations: ValidationViolation[];
  reason: string;
}

export interface RegenerationResult {
  requested: boolean;
  reason: string;
  violations: ValidationViolation[];
}
