/**
 * Stage 6 - Legal Reasoning Engine
 *
 * Grounded generation only: the LLM explains retrieved legal text.
 * Never generates unsupported legal facts or uses training knowledge
 * when authoritative sources are unavailable.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterAiProviderService } from '../openrouter-ai-provider.service';
import { BuiltLegalContext, LegalIntent, LegalReasoningResult, AnswerDepth } from './pipeline.types';
import {
  classifyLegalAnswerTask,
  LEGAL_ANSWER_LLM_CONFIG,
  LEGAL_ANSWER_MAX_TOKENS,
  LEGAL_VERIFICATION_FAILURE_MESSAGE,
} from './legal-answer-generation.config';
import { LegalEvidenceValidationResult } from './legal-evidence-validator.service';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function buildSystemPrompt(
  intent: LegalIntent,
  depth: AnswerDepth,
  hasSources: boolean,
  fromUploadedDocument: boolean,
  hasReliableSources: boolean,
): string {
  const depthInstruction = {
    Beginner: 'Use simple language. Avoid Latin terms without explaining them. Provide relatable examples.',
    Intermediate: 'Assume the reader is a law student. Use standard legal terminology with brief explanations.',
    Expert: 'Assume the reader is a practising advocate or academic. Use precise legal language with full citations.',
  }[depth];

  const citationInstruction = hasReliableSources
    ? `
ZERO-HALLUCINATION CITATION RULES (RELIABLE SOURCES RETRIEVED):
- Legal material has been retrieved and is labelled [A1], [A2], [A3], etc.
- Ground EVERY legal fact, section number, article, case name, and principle primarily in the retrieved material.
- When you use information from a retrieved chunk, cite its anchor inline, e.g. "(per [A1])".
- NEVER fabricate sections, articles, case citations, court names, dates, amendments, or legal principles.
- If the retrieved material does not contain the exact details, supplement using verified legal reasoning and general legal explanation, but DO NOT fabricate details.`
    : `
ZERO-HALLUCINATION RULES (RETRIEVAL UNAVAILABLE / LOW CONFIDENCE):
- Reliable legal sources were not retrieved or are insufficient.
- DO NOT reject the question or state that verification is not possible.
- Answer using your verified legal knowledge of Indian law.
- Ground your response primarily on the retrieved material if any of it is helpful, but otherwise supplement with verified legal reasoning and general legal explanation.
- Clearly distinguish between established legal principles, applicable statutes, and general legal guidance.
- NEVER fabricate section numbers, case citations, or statutory wording. If exact statutory language is unavailable, explain the legal principle instead.`;

  const documentNote = fromUploadedDocument
    ? '\n- The retrieved material is from the user\'s uploaded document. Prioritize it over all other sources.'
    : '';

  const intentInstruction = INTENT_RESPONSE_TEMPLATES[intent];

  return `You are LexMentor AI - a specialized legal research assistant for Indian law.

Your users are law students, judiciary aspirants, advocates, and legal researchers.

CORE RULES:
1. Answer ALL law-related and legal queries. Do NOT reject genuine legal questions (even situation-based ones like "My husband hits me" or "My employer has not paid my salary").
2. Identify the underlying legal issue from situational queries and answer accordingly. Explain applicable legal rights, relevant laws where appropriate, legally recognised options, and practical next steps.
3. NEVER fabricate laws, sections, articles, judgments, court names, dates, or citations.
4. If exact statutory language or section number is unavailable, explain the legal principle instead.
5. If the user asks about legal rights, remedies, or procedures, answer naturally without requiring them to cite a specific Act or Section.
6. Write in natural, professional legal English suitable for law students.
7. This is legal education and research - NOT professional legal advice.
8. If the user references a previous response (e.g., using "Reference REF-XXXXX"), ground your answer in that referenced context. Do not summarize, modify, or regenerate the referenced response.
${citationInstruction}${documentNote}

DEPTH: ${depthInstruction}

MANDATORY RESPONSE STRUCTURE (use these exact section headings):
## Issue
(Clearly define the legal issue(s) identified from the user's question or situation. If the user describes a situation naturally, identify the underlying legal issues.)

## Applicable Law
(State the relevant statutes, legal rules, constitutional provisions, or legal principles. Explain the applicable legal rights. If exact statutory language is unavailable, explain the legal principle instead. Do not fabricate section numbers or statutory wording.)

## Legal Analysis
(Provide a clear and precise analysis of how the law applies to the issue or situation. Clearly distinguish between established legal principles, applicable statutes, and general legal guidance. If retrieved documents are present, base the analysis primarily on them.)

## Practical Options
(Suggest legally recognised options, remedies, or courses of action available to the user based on the situation.)

## Suggested Next Steps
(Explain practical next steps, such as police procedure, filing an FIR, drafting legal notices, court procedures, or consulting an advocate.)

## References
(Include only if retrieved legal documents were successfully retrieved and used. List the references/sources used from the retrieved material. If no retrieved documents are available, omit this section or write "No retrieved documents used.")

QUALITY:
- Accurate, concise, professional, legally precise, plain English.
- Avoid unnecessary verbosity and hedging.
- Every section must add useful information.

RESPONSE FORMAT GUIDANCE:
${intentInstruction}`;
}

const INTENT_RESPONSE_TEMPLATES: Record<LegalIntent, string> = {
  Concept: `Focus on definition, legal explanation, relevant provisions, and a practical example from retrieved material or verified knowledge.`,
  'Bare Act': `Focus on statutory text, scope, key sections, and illustrations present in sources or verified knowledge.`,
  'Case Law': `Focus on facts, issues, court reasoning, and ratio from retrieved judgments or verified knowledge.`,
  'Constitutional Law': `Focus on constitutional provisions and judicial interpretation from retrieved material or verified knowledge.`,
  Research: `Focus on applicable laws, sections, and judicial principles with critical analysis.`,
  Drafting: `Focus on legal requirements and clause structure supported by statutory material or verified knowledge.`,
  Contract: `Focus on contract formation, enforceability, and remedies supported by statutory text or verified knowledge.`,
  'Moot Court': `Focus on legal issues, arguments, and authorities.`,
  General: `Use the most appropriate structure based on what the question asks, always grounded in retrieved material or verified knowledge.`,
};

@Injectable()
export class LegalReasoningEngine {
  private readonly logger = new Logger(LegalReasoningEngine.name);

  constructor(private readonly aiProvider: OpenRouterAiProviderService) {}

  async generate(input: {
    query: string;
    depth: AnswerDepth;
    intent: LegalIntent;
    context: BuiltLegalContext;
    history: ChatMessage[];
    userId?: string;
    onToken?: (token: string) => void;
    fromUploadedDocument?: boolean;
    evidenceValidation?: LegalEvidenceValidationResult;
    references?: Array<{ id: string; content: string }>;
    retrievalConfidence?: number;
  }): Promise<LegalReasoningResult> {
    const fromUploadedDocument = input.fromUploadedDocument ?? input.context.authorities.some(
      (a) => a.collection === 'User Uploaded Documents',
    );

    const hasReliableSources = input.context.hasAuthoritativeSources &&
      (input.retrievalConfidence ?? 0) >= 0.8 &&
      (!input.evidenceValidation || input.evidenceValidation.canGenerateDefinitiveAnswer);

    const systemPrompt = buildSystemPrompt(
      input.intent,
      input.depth,
      input.context.hasAuthoritativeSources,
      fromUploadedDocument,
      hasReliableSources,
    );

    const userPrompt = this.buildUserPrompt(
      input.query,
      input.context,
      fromUploadedDocument,
      input.evidenceValidation,
      input.references,
    );

    const recentHistory = input.history.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const taskType = classifyLegalAnswerTask(input.intent, input.depth);
    const maxTokens = LEGAL_ANSWER_MAX_TOKENS[taskType];

    const result = await this.aiProvider.complete({
      module: 'lexmentor',
      temperature: LEGAL_ANSWER_LLM_CONFIG.temperature,
      topP: LEGAL_ANSWER_LLM_CONFIG.topP,
      frequencyPenalty: LEGAL_ANSWER_LLM_CONFIG.frequencyPenalty,
      presencePenalty: LEGAL_ANSWER_LLM_CONFIG.presencePenalty,
      maxTokens,
      userId: input.userId,
      onToken: input.onToken,
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentHistory,
        { role: 'user', content: userPrompt },
      ],
    });

    this.logger.debug(
      `LegalReasoning: ${result.model} | intent=${input.intent} | depth=${input.depth} | task=${taskType} | sources=${input.context.hasAuthoritativeSources}`,
    );

    return {
      content: result.content,
      provider: result.provider,
      model: result.model,
      promptTokens: 0,
      completionTokens: 0,
    };
  }

  private buildUserPrompt(
    query: string,
    context: BuiltLegalContext,
    fromUploadedDocument: boolean,
    evidenceValidation?: LegalEvidenceValidationResult,
    references?: Array<{ id: string; content: string }>,
  ): string {
    const parts: string[] = [];

    if (references && references.length > 0) {
      parts.push('REFERENCED PREVIOUS RESPONSES FROM THIS CONVERSATION:');
      references.forEach((ref) => {
        parts.push(`- ID: ${ref.id}`);
        parts.push(`  Content:\n"""\n${ref.content}\n"""`);
      });
      parts.push(
        '\nINSTRUCTION FOR REFERENCES: Ground your follow-up answer specifically and accurately in the referenced previous response(s) above. Do not summarize, modify, or regenerate the referenced responses; use them exactly as generated for contextual grounding.',
      );
      parts.push('');
    }

    parts.push(`QUESTION:\n${query}`);

    if (evidenceValidation) {
      parts.push([
        '',
        'PRE-GENERATION LEGAL EVIDENCE VALIDATION:',
        `Confidence: ${evidenceValidation.confidence} (${Math.round(evidenceValidation.confidenceScore * 100)}%).`,
        `Relevant legal evidence retrieved: ${evidenceValidation.hasRelevantLegalEvidence}.`,
        `Section/Article verified: ${evidenceValidation.sectionOrArticleExists}.`,
        `Retrieved text matches question: ${evidenceValidation.retrievedTextMatchesQuestion}.`,
        `Authoritative source: ${evidenceValidation.sourceAuthoritative}.`,
        `Conflicting sources: ${evidenceValidation.hasConflictingSources}.`,
        `Validation reason: ${evidenceValidation.reason}.`,
      ].join('\n'));
    }

    if (context.hasAuthoritativeSources) {
      parts.push(`\nRETRIEVED LEGAL MATERIAL:\n${context.contextBlock}`);
      parts.push(
        `\nINSTRUCTION: Answer using the retrieved material above and cite each source using its anchor tag [A1], [A2], etc. inline. ` +
        `If the retrieved material is insufficient or doesn't cover some aspects, answer using your verified legal knowledge. ` +
        `Do not fabricate sections, articles, or citations.`,
      );
      if (fromUploadedDocument) {
        parts.push(`\nNOTE: Retrieved material is from the user's uploaded document - prioritize it.`);
      }
    } else {
      parts.push(
        `\nINSTRUCTION: No legal material was retrieved. Answer using your verified legal knowledge of Indian law. ` +
        `Do not fabricate sections, articles, or citations. Explain the legal principles instead.`,
      );
    }

    return parts.join('\n');
  }

  buildSystemPromptFor(intent: LegalIntent, depth: AnswerDepth, hasSources: boolean): string {
    return buildSystemPrompt(intent, depth, hasSources, false, hasSources);
  }

  templateFor(intent: LegalIntent): string {
    return INTENT_RESPONSE_TEMPLATES[intent];
  }
}