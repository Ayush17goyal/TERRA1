/**
 * Stage 2 — Legal Intent Detection
 *
 * Uses the LLM (fast model via OpenRouter) with JSON mode to classify the
 * user's query into one of the supported LegalIntent types.
 *
 * This is a pure LLM call — zero regex, zero keyword matching.
 * The model returns a JSON object: { intent, confidence, reasoning }.
 *
 * Fallback: if the LLM call fails, the intent defaults to 'General'
 * so the pipeline never throws here — it degrades gracefully.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterAiProviderService } from '../openrouter-ai-provider.service';
import { LegalIntent } from './pipeline.types';

interface IntentClassificationResponse {
  intent: LegalIntent;
  confidence: number; // 0.0 – 1.0
  reasoning: string;
}

const VALID_INTENTS: LegalIntent[] = [
  'Concept',
  'Bare Act',
  'Case Law',
  'Constitutional Law',
  'Research',
  'Drafting',
  'Contract',
  'Moot Court',
  'General',
];

const CLASSIFICATION_SYSTEM_PROMPT = `You are a legal query classifier for an Indian legal research platform.

Your task: classify the user's query into exactly ONE of the following intent categories.

INTENT CATEGORIES:
- "Concept"          → Asking for a definition, explanation, or conceptual understanding of a legal term or doctrine
- "Bare Act"         → Asking about a specific statute, section, sub-section, proviso, or legislative text
- "Case Law"         → Asking about a specific judgment, case analysis, ratio decidendi, or judicial precedent
- "Constitutional Law" → Asking about constitutional provisions, fundamental rights, writ jurisdiction, or constitutional doctrine
- "Research"         → Asking for deep legal research, dissertation help, comparative analysis, or academic writing
- "Drafting"         → Asking to draft or review a legal document: petition, notice, affidavit, application, contract clause
- "Contract"         → Asking about contract law: formation, enforceability, breach, specific performance, commercial contracts
- "Moot Court"       → Asking for moot court preparation: memorial, oral arguments, issues, proposition analysis
- "General"          → Any other legal query that does not clearly fit the above categories

OUTPUT FORMAT (strict JSON only, no prose):
{
  "intent": "<one of the category names above>",
  "confidence": <float between 0.0 and 1.0>,
  "reasoning": "<one sentence explaining why>"
}

Rules:
- Never output anything except the JSON object.
- Never use markdown, code fences, or explanations outside the JSON.
- If the query is ambiguous between two categories, pick the one with the strongest signal.
- "General" is the last resort — only use it when no other category fits.`;

@Injectable()
export class IntentClassifier {
  private readonly logger = new Logger(IntentClassifier.name);

  constructor(private readonly aiProvider: OpenRouterAiProviderService) {}

  async classify(query: string): Promise<{ intent: LegalIntent; confidence: number }> {
    const truncatedQuery = query.slice(0, 1500); // classification doesn't need the full query

    try {
      const result = await this.aiProvider.complete({
        module: 'lexmentor',
        temperature: 0,
        maxTokens: 120,
        timeoutMs: 6000,
        // Prefer the fastest available model for classification
        preferredModel: 'google/gemini-2.5-flash',
        jsonMode: true,
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: `QUERY:\n${truncatedQuery}` },
        ],
      });

      const parsed = this.parseResponse(result.content);
      if (parsed) {
        this.logger.debug(`Intent: ${parsed.intent} (confidence=${parsed.confidence.toFixed(2)}) for query="${truncatedQuery.slice(0, 60)}..."`);
        return { intent: parsed.intent, confidence: parsed.confidence };
      }
    } catch (err) {
      this.logger.warn(`IntentClassifier LLM call failed: ${this.msg(err)} — defaulting to General`);
    }

    // Safe fallback — never throw from this stage
    return { intent: 'General', confidence: 0.5 };
  }

  private parseResponse(raw: string): IntentClassificationResponse | null {
    try {
      // Strip markdown fences if the model disobeys
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(cleaned) as Partial<IntentClassificationResponse>;

      if (!parsed.intent || !VALID_INTENTS.includes(parsed.intent as LegalIntent)) {
        this.logger.warn(`IntentClassifier returned unknown intent: "${parsed.intent}"`);
        return null;
      }

      return {
        intent: parsed.intent as LegalIntent,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      };
    } catch {
      this.logger.warn(`IntentClassifier: failed to parse JSON response: ${raw.slice(0, 200)}`);
      return null;
    }
  }

  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
