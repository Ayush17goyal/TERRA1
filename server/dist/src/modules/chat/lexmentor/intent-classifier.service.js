"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var IntentClassifier_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentClassifier = void 0;
const common_1 = require("@nestjs/common");
const openrouter_ai_provider_service_1 = require("../openrouter-ai-provider.service");
const VALID_INTENTS = [
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
let IntentClassifier = IntentClassifier_1 = class IntentClassifier {
    constructor(aiProvider) {
        this.aiProvider = aiProvider;
        this.logger = new common_1.Logger(IntentClassifier_1.name);
    }
    async classify(query) {
        const truncatedQuery = query.slice(0, 1500);
        try {
            const result = await this.aiProvider.complete({
                module: 'lexmentor',
                temperature: 0,
                maxTokens: 120,
                timeoutMs: 6000,
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
        }
        catch (err) {
            this.logger.warn(`IntentClassifier LLM call failed: ${this.msg(err)} — defaulting to General`);
        }
        return { intent: 'General', confidence: 0.5 };
    }
    parseResponse(raw) {
        try {
            const cleaned = raw
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
            const parsed = JSON.parse(cleaned);
            if (!parsed.intent || !VALID_INTENTS.includes(parsed.intent)) {
                this.logger.warn(`IntentClassifier returned unknown intent: "${parsed.intent}"`);
                return null;
            }
            return {
                intent: parsed.intent,
                confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
                reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
            };
        }
        catch {
            this.logger.warn(`IntentClassifier: failed to parse JSON response: ${raw.slice(0, 200)}`);
            return null;
        }
    }
    msg(err) {
        return err instanceof Error ? err.message : String(err);
    }
};
exports.IntentClassifier = IntentClassifier;
exports.IntentClassifier = IntentClassifier = IntentClassifier_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openrouter_ai_provider_service_1.OpenRouterAiProviderService])
], IntentClassifier);
//# sourceMappingURL=intent-classifier.service.js.map