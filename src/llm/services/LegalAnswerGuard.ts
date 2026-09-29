import type { AssembledPrompt } from '../../ai/prompts/types';
import type { KnowledgeContextItem } from '../../knowledge/types';
import type { LLMResponse, RuntimeDecisionPacket } from '../types';

export type LegalAnswerDepth = 'simple' | 'detailed' | 'research';
export type LegalConfidenceLevel = 'high' | 'medium' | 'low';

export interface LegalGenerationConfig {
  temperature: 0.1;
  topP: 0.2;
  frequencyPenalty: 0;
  presencePenalty: 0;
  maxOutputTokens: Record<LegalAnswerDepth, number>;
  minimumSimilarityScore: number;
}

export interface LegalConfidenceAssessment {
  score: number;
  level: LegalConfidenceLevel;
  reasons: string[];
  hasEvidence: boolean;
  sectionOrArticleVerified: boolean;
  textMatchesQuestion: boolean;
  authoritativeSource: boolean;
  conflictingSources: boolean;
}

export const LEGAL_GENERATION_CONFIG: LegalGenerationConfig = {
  temperature: 0.1,
  topP: 0.2,
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxOutputTokens: {
    simple: 800,
    detailed: 1500,
    research: 2500,
  },
  minimumSimilarityScore: 0.35,
};

const UNVERIFIED_LEGAL_ANSWER = 'I could not verify this information from the available legal sources.';

export class LegalAnswerGuard {
  readonly config = LEGAL_GENERATION_CONFIG;

  classifyDepth(packet: RuntimeDecisionPacket): LegalAnswerDepth {
    const message = packet.promptRequest.normalizedMessage ?? packet.promptRequest.userMessage;
    if (/\b(research|case law|judgments?|precedents?|authorities|comparative|doctrine|detailed case analysis)\b/i.test(message)) {
      return 'research';
    }
    if (packet.intent === 'capstone' || packet.intent === 'review' || packet.intent === 'bare_act_analysis') {
      return 'detailed';
    }
    if (packet.promptRequest.output?.maxLength === 'long') {
      return 'detailed';
    }
    return 'simple';
  }

  maxOutputTokens(packet: RuntimeDecisionPacket): number {
    return this.config.maxOutputTokens[this.classifyDepth(packet)];
  }

  assess(packet: RuntimeDecisionPacket): LegalConfidenceAssessment {
    const retrieval = packet.retrieval;
    const items = retrieval?.items ?? [];
    const bestScore = Math.max(...items.map((item) => item.score), 0);
    const hasEvidence = items.length > 0;
    const conflictingSources = this.hasConflicts(items, retrieval?.warnings ?? []);
    const sectionOrArticleVerified = this.sectionOrArticleVerified(packet, items);
    const textMatchesQuestion = bestScore >= this.config.minimumSimilarityScore || this.keywordOverlap(packet, items) >= 0.18;
    const authoritativeSource = items.some((item) => this.isAuthoritative(item));

    let score = 0;
    if (hasEvidence) score += 0.25;
    if (bestScore >= this.config.minimumSimilarityScore) score += 0.25;
    if (sectionOrArticleVerified) score += 0.2;
    if (textMatchesQuestion) score += 0.15;
    if (authoritativeSource) score += 0.15;
    if (conflictingSources) score -= 0.35;
    score = Math.max(0, Math.min(1, Number(score.toFixed(2))));

    const reasons = [
      hasEvidence ? `${items.length} retrieved legal source item(s).` : 'No legal source documents were retrieved.',
      `Best retrieval score: ${bestScore.toFixed(2)}.`,
      sectionOrArticleVerified ? 'Referenced section/article is present in retrieved text.' : 'Referenced section/article was not verified in retrieved text.',
      textMatchesQuestion ? 'Retrieved text appears relevant to the question.' : 'Retrieved text does not sufficiently match the question.',
      authoritativeSource ? 'At least one source has authoritative legal-source metadata.' : 'No authoritative source metadata was confirmed.',
      conflictingSources ? 'Potentially conflicting legal sources were detected.' : 'No source conflict detected.',
    ];

    const level: LegalConfidenceLevel = !hasEvidence || conflictingSources || score < 0.45
      ? 'low'
      : score >= 0.75
        ? 'high'
        : 'medium';

    return {
      score,
      level,
      reasons,
      hasEvidence,
      sectionOrArticleVerified,
      textMatchesQuestion,
      authoritativeSource,
      conflictingSources,
    };
  }

  shouldBlockDefinitiveAnswer(assessment: LegalConfidenceAssessment): boolean {
    return assessment.level === 'low';
  }

  buildGroundedPrompt(prompt: AssembledPrompt, packet: RuntimeDecisionPacket, assessment: LegalConfidenceAssessment): AssembledPrompt {
    return {
      ...prompt,
      prompt: [
        prompt.prompt,
        this.systemRules(assessment),
        this.evidenceBlock(packet),
      ].join('\n\n'),
    };
  }

  buildFallbackResponse(
    packet: RuntimeDecisionPacket,
    prompt: AssembledPrompt,
    assessment: LegalConfidenceAssessment,
    model: string,
    latencyMs: number,
    telemetry: LLMResponse['telemetry']
  ): LLMResponse {
    const evidenceSummary = (packet.retrieval?.items ?? []).slice(0, 3).map((item, index) => {
      return `${index + 1}. Source document: ${item.title}; score ${item.score.toFixed(2)}.`;
    });
    const text = [
      UNVERIFIED_LEGAL_ANSWER,
      '',
      `Confidence: ${assessment.level.toUpperCase()} (${assessment.score.toFixed(2)})`,
      'Reason: The retrieved corpus does not provide sufficiently verified, non-conflicting legal evidence for a definitive answer.',
      evidenceSummary.length ? ['Retrieved evidence checked:', ...evidenceSummary].join('\n') : 'Retrieved evidence checked: none.',
    ].join('\n');

    return {
      requestId: packet.requestId,
      interactionId: packet.interactionId,
      text,
      model,
      prompt,
      toolCalls: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        systemPromptTokens: 0,
        knowledgeTokens: 0,
        studentContextTokens: 0,
        draftTokens: 0,
      },
      cost: {
        model,
        inputCostUsd: 0,
        outputCostUsd: 0,
        estimatedCostUsd: 0,
        completionLength: text.length,
      },
      telemetry,
      raw: {
        model,
        output_text: text,
        legal_confidence: assessment,
        blocked_definitive_answer: true,
        latency_ms: latencyMs,
      },
    };
  }

  private systemRules(assessment: LegalConfidenceAssessment): string {
    return [
      '## strict_legal_answer_rules',
      'Answer only from the retrieved legal evidence below.',
      'Never generate unsupported information.',
      'Never create fake sections, fake Articles, fake judgments, fake citations, fake amendments, or fake legal principles.',
      `If evidence is insufficient, respond exactly: "${UNVERIFIED_LEGAL_ANSWER}"`,
      'Every legal answer must include Act name, Section/Article number, source document, and relevant retrieved evidence.',
      'Before answering, verify that relevant legal evidence was retrieved, the section/article exists, retrieved text matches the question, the source is authoritative, and no conflicting legal sources control the answer.',
      `Confidence assessment: ${assessment.level.toUpperCase()} (${assessment.score.toFixed(2)}). ${assessment.reasons.join(' ')}`,
    ].join('\n');
  }

  private evidenceBlock(packet: RuntimeDecisionPacket): string {
    const items = packet.retrieval?.items ?? [];
    if (!items.length) {
      return '## retrieved_legal_evidence\nNo legal documents were retrieved.';
    }

    return [
      '## retrieved_legal_evidence',
      ...items.map((item, index) => {
        const metadata = item.metadata ?? {};
        const actName = this.metadataString(metadata.actName) ?? this.metadataString(metadata.statute) ?? item.title;
        const section = this.metadataString(metadata.section) ?? this.metadataString(metadata.article) ?? this.extractProvision(item.content) ?? 'Not specified in metadata';
        const sourceDocument = this.metadataString(metadata.sourceDocument) ?? this.metadataString(metadata.sourceId) ?? item.title;
        return [
          `### Evidence ${index + 1}`,
          `Act name: ${actName}`,
          `Section/Article number: ${section}`,
          `Source document: ${sourceDocument}`,
          `Similarity score: ${item.score.toFixed(2)}`,
          `Relevant retrieved evidence:\n${item.content}`,
        ].join('\n');
      }),
    ].join('\n\n');
  }

  private sectionOrArticleVerified(packet: RuntimeDecisionPacket, items: KnowledgeContextItem[]): boolean {
    const message = packet.promptRequest.normalizedMessage ?? packet.promptRequest.userMessage;
    const references = [...message.matchAll(/\b(section|sec\.?|article|art\.?)\s+([0-9]+[A-Z]?(?:\([^)]+\))?)/gi)]
      .map((match) => match[2].toLowerCase());
    if (!references.length) {
      return items.length > 0;
    }

    const haystack = items.map((item) => `${item.title}\n${item.content}\n${JSON.stringify(item.metadata)}`).join('\n').toLowerCase();
    return references.every((reference) => {
      const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b(?:section|sec\\.?|article|art\\.?)\\s+${escaped}\\b`, 'i').test(haystack);
    });
  }

  private keywordOverlap(packet: RuntimeDecisionPacket, items: KnowledgeContextItem[]): number {
    const questionTokens = this.tokens(packet.promptRequest.normalizedMessage ?? packet.promptRequest.userMessage);
    if (!questionTokens.size || !items.length) return 0;
    const evidenceTokens = this.tokens(items.map((item) => `${item.title} ${item.content}`).join(' '));
    const matched = [...questionTokens].filter((token) => evidenceTokens.has(token)).length;
    return matched / questionTokens.size;
  }

  private tokens(text: string): Set<string> {
    const stop = new Set(['what', 'when', 'where', 'which', 'under', 'about', 'this', 'that', 'from', 'with', 'the', 'and', 'for', 'are', 'is']);
    return new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((token) => !stop.has(token)) ?? []);
  }

  private hasConflicts(items: KnowledgeContextItem[], warnings: string[]): boolean {
    if (warnings.some((warning) => /conflict|contradict|inconsistent/i.test(warning))) return true;
    return items.some((item) => item.reasons.some((reason) => /conflict|contradict|inconsistent/i.test(reason)));
  }

  private isAuthoritative(item: KnowledgeContextItem): boolean {
    const metadata = item.metadata ?? {};
    if (metadata.authoritative === true || metadata.isAuthoritative === true) return true;
    if (metadata.authoritative === false || metadata.isAuthoritative === false) return false;
    if (item.kind === 'bare_act_component') return true;
    return Boolean(metadata.sourceDocument || metadata.sourceId || metadata.actName || metadata.statute);
  }

  private extractProvision(text: string): string | undefined {
    const match = text.match(/\b(?:section|sec\.?|article|art\.?)\s+([0-9]+[A-Z]?(?:\([^)]+\))?)/i);
    return match ? match[0] : undefined;
  }

  private metadataString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
