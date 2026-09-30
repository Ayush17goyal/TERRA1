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
var MemorialAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorialAiService = void 0;
const common_1 = require("@nestjs/common");
const openrouter_ai_provider_service_1 = require("../chat/openrouter-ai-provider.service");
let MemorialAiService = MemorialAiService_1 = class MemorialAiService {
    constructor(aiProvider) {
        this.aiProvider = aiProvider;
        this.logger = new common_1.Logger(MemorialAiService_1.name);
    }
    async json(params) {
        const result = await this.aiProvider.complete({
            messages: [
                { role: 'system', content: params.system },
                { role: 'user', content: params.prompt },
            ],
            temperature: params.temperature ?? 0.1,
            maxTokens: params.maxTokens ?? 5000,
            timeoutMs: 90_000,
            preferredModel: params.options.preferredModel || 'Gemini',
            module: 'memorial',
            jsonMode: true,
            userId: params.options.userId,
        });
        try {
            return this.parseJson(result.content);
        }
        catch (error) {
            this.logger.warn(`${params.stage} returned malformed JSON. Attempting repair: ${error?.message || error}`);
            const repair = await this.aiProvider.complete({
                messages: [
                    {
                        role: 'system',
                        content: 'Repair the supplied malformed JSON. Return only one valid JSON object. Do not add or remove substantive information.',
                    },
                    { role: 'user', content: result.content.slice(0, 60_000) },
                ],
                temperature: 0,
                maxTokens: params.maxTokens ?? 5000,
                timeoutMs: 90_000,
                preferredModel: params.options.preferredModel || 'Gemini',
                module: 'memorial',
                jsonMode: true,
                userId: params.options.userId,
            });
            return this.parseJson(repair.content);
        }
    }
    parseJson(content) {
        const cleaned = String(content || '')
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        const first = cleaned.indexOf('{');
        const last = cleaned.lastIndexOf('}');
        const candidate = first >= 0 && last > first ? cleaned.slice(first, last + 1) : cleaned;
        return JSON.parse(candidate);
    }
};
exports.MemorialAiService = MemorialAiService;
exports.MemorialAiService = MemorialAiService = MemorialAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openrouter_ai_provider_service_1.OpenRouterAiProviderService])
], MemorialAiService);
//# sourceMappingURL=memorial-ai.service.js.map