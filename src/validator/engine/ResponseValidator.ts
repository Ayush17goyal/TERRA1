import type { LLMResponse, RuntimeDecisionPacket } from '../../llm/types';
import {
  AcademicIntegrityCheck,
  AssessmentBoundaryCheck,
  BareActBoundaryCheck,
  BehaviourComplianceCheck,
  ConsistencyCheck,
  CurriculumAlignmentCheck,
  EducationalValueCheck,
  HallucinationCheck,
  LearningObjectiveCheck,
  LegalAdviceBoundaryCheck,
  LegislativeConventionCheck,
  NextActionCheck,
  NoGhostwritingCheck,
  OutputFormatCheck,
  StudentLevelCheck,
  TeachingStrategyCheck,
  TokenBudgetCheck,
} from '../rules';
import type {
  GuardrailRule,
  RegenerationRequest,
  RegenerationResult,
  RepairResult,
  RuleResult,
  ValidationContext,
  ValidationOutcome,
  ValidationViolation,
  ValidatorAction,
} from '../types';
import { validationTelemetryRecordSchema } from '../validators/schemas';
import { ValidationActionPolicy } from '../policies/ValidationActionPolicy';
import { ResponseRepairer } from '../repair/ResponseRepairer';
import { ValidatorTelemetry } from '../telemetry/ValidatorTelemetry';

export interface ResponseValidatorOptions {
  rules?: GuardrailRule[];
  actionPolicy?: ValidationActionPolicy;
  repairer?: ResponseRepairer;
  telemetry?: ValidatorTelemetry;
  regenerationRequester?: (request: RegenerationRequest) => Promise<RegenerationResult> | RegenerationResult;
}

export class ResponseValidator {
  private readonly rules: GuardrailRule[];
  private readonly actionPolicy: ValidationActionPolicy;
  private readonly repairer: ResponseRepairer;
  private readonly telemetry: ValidatorTelemetry;
  private readonly regenerationRequester?: (request: RegenerationRequest) => Promise<RegenerationResult> | RegenerationResult;

  constructor(options: ResponseValidatorOptions = {}) {
    this.rules = options.rules ?? [
      new CurriculumAlignmentCheck(),
      new TeachingStrategyCheck(),
      new BehaviourComplianceCheck(),
      new EducationalValueCheck(),
      new NoGhostwritingCheck(),
      new AssessmentBoundaryCheck(),
      new StudentLevelCheck(),
      new LearningObjectiveCheck(),
      new NextActionCheck(),
      new HallucinationCheck(),
      new LegislativeConventionCheck(),
      new ConsistencyCheck(),
      new BareActBoundaryCheck(),
      new LegalAdviceBoundaryCheck(),
      new AcademicIntegrityCheck(),
      new OutputFormatCheck(),
      new TokenBudgetCheck(),
    ];
    this.actionPolicy = options.actionPolicy ?? new ValidationActionPolicy();
    this.repairer = options.repairer ?? new ResponseRepairer();
    this.telemetry = options.telemetry ?? new ValidatorTelemetry();
    this.regenerationRequester = options.regenerationRequester;
  }

  validate(packet: RuntimeDecisionPacket, response: LLMResponse): ValidationOutcome {
    const started = Date.now();
    const context: ValidationContext = { packet, response, text: response.text };
    const ruleResults = this.rules.map((rule) => rule.check(context));
    const violations = ruleResults.flatMap((result) => result.violations);
    const action = this.actionPolicy.decide(violations);

    return this.outcome(packet, response, ruleResults, violations, action, started, [], false);
  }

  repair(packet: RuntimeDecisionPacket, response: LLMResponse, violations?: ValidationViolation[]): ValidationOutcome {
    const started = Date.now();
    const current = violations ?? this.validate(packet, response).violations;
    const action = this.actionPolicy.decide(current);

    if (action !== 'repair') {
      return this.outcome(packet, response, [], current, action, started, [], action === 'request_regeneration');
    }

    const repairResult = this.repairer.repair(response.text, current, packet);
    const repairedResponse: LLMResponse = {
      ...response,
      text: repairResult.text,
    };
    const postRepair = this.runRules(packet, repairedResponse);
    const remaining = postRepair.violations.filter((violation) => !repairResult.violationsRepaired.includes(violation.ruleId));
    const finalAction = this.actionPolicy.decide(remaining);

    return this.outcome(
      packet,
      repairedResponse,
      postRepair.ruleResults,
      remaining,
      finalAction === 'approve' ? 'approve' : finalAction,
      started,
      repairResult.actions,
      finalAction === 'request_regeneration'
    );
  }

  async regenerate(packet: RuntimeDecisionPacket, response: LLMResponse, violations?: ValidationViolation[]): Promise<RegenerationResult> {
    const current = violations ?? this.validate(packet, response).violations;
    const reason = current.map((violation) => `${violation.ruleName}: ${violation.message}`).join('; ');
    if (!this.regenerationRequester) {
      return { requested: true, reason, violations: current };
    }
    return await this.regenerationRequester({ packet, response, violations: current, reason });
  }

  approve(packet: RuntimeDecisionPacket, response: LLMResponse): ValidationOutcome {
    const outcome = this.validate(packet, response);
    if (outcome.action === 'approve') {
      return outcome;
    }
    if (outcome.action === 'repair') {
      return this.repair(packet, response, outcome.violations);
    }
    return outcome;
  }

  private runRules(packet: RuntimeDecisionPacket, response: LLMResponse): { ruleResults: RuleResult[]; violations: ValidationViolation[] } {
    const context: ValidationContext = { packet, response, text: response.text };
    const ruleResults = this.rules.map((rule) => rule.check(context));
    return {
      ruleResults,
      violations: ruleResults.flatMap((result) => result.violations),
    };
  }

  private outcome(
    packet: RuntimeDecisionPacket,
    response: LLMResponse,
    ruleResults: RuleResult[],
    violations: ValidationViolation[],
    action: ValidatorAction,
    started: number,
    repairActions: string[],
    regenerationRequested: boolean
  ): ValidationOutcome {
    const telemetry = validationTelemetryRecordSchema.parse({
      requestId: packet.requestId,
      interactionId: packet.interactionId,
      studentId: packet.studentId,
      validationTimeMs: Date.now() - started,
      rulesExecuted: ruleResults.map((result) => result.ruleId),
      violations,
      repairActions,
      regenerationRequested: regenerationRequested || action === 'request_regeneration',
      approved: action === 'approve',
      action,
    });

    this.telemetry.record(telemetry);

    return {
      action,
      approved: action === 'approve',
      response,
      repairedText: repairActions.length > 0 ? response.text : undefined,
      violations,
      ruleResults,
      telemetry,
    };
  }
}
