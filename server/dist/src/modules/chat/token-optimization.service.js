"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenOptimizationService = void 0;
const common_1 = require("@nestjs/common");
let TokenOptimizationService = class TokenOptimizationService {
    constructor() {
        this.stats = {
            lexmentor: {
                totalRequests: 0,
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
            },
            research: {
                totalRequests: 0,
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
            },
            judgment: {
                totalRequests: 0,
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
            },
            notebook: {
                totalRequests: 0,
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
            },
        };
    }
    calculateMaxTokens(moduleName, options) {
        let baseBudget = 800;
        if (moduleName === 'lexmentor') {
            const mode = options.userMode || 'Intermediate';
            if (mode === 'Beginner')
                baseBudget = 900;
            else if (mode === 'Expert')
                baseBudget = 1600;
            else
                baseBudget = 1200;
        }
        else if (moduleName === 'research') {
            const mode = options.userMode || 'standard';
            if (mode === 'deep' || mode === 'exhaustive')
                baseBudget = 1500;
            else
                baseBudget = 1000;
        }
        else if (moduleName === 'judgment') {
            baseBudget = 2000;
        }
        else if (moduleName === 'notebook') {
            baseBudget = 1200;
        }
        const queryText = options.query || '';
        const wordCount = queryText.trim().split(/\s+/).filter(Boolean).length;
        let complexityFactor = 0.5 + Math.min(0.5, wordCount * 0.02);
        const complexKeywords = [
            'compare', 'difference', 'distinguish', 'versus', 'vs',
            'draft', 'prepare', 'write', 'agreement', 'contract', 'nda',
            'detailed', 'comprehensive', 'exhaustive', 'analysis', 'doctrine',
            'landmark', 'precedent', 'judicial', 'constitutional'
        ];
        const lowercaseQuery = queryText.toLowerCase();
        const hasComplexKeywords = complexKeywords.some(keyword => lowercaseQuery.includes(keyword));
        if (hasComplexKeywords) {
            complexityFactor = Math.min(1.0, complexityFactor + 0.15);
        }
        const contextSize = options.contextSize || 0;
        let contextFactor = 1.0;
        if (contextSize === 0) {
            contextFactor = 0.6;
        }
        else {
            contextFactor = 0.6 + Math.min(0.4, contextSize / 10000 * 0.4);
        }
        const calculatedTokens = Math.round(baseBudget * complexityFactor * contextFactor);
        const finalTokens = Math.max(900, Math.min(2400, calculatedTokens));
        return finalTokens;
    }
    logUsage(moduleName, promptTokens, completionTokens) {
        if (!this.stats[moduleName])
            return;
        this.stats[moduleName].totalRequests++;
        this.stats[moduleName].totalPromptTokens += promptTokens;
        this.stats[moduleName].totalCompletionTokens += completionTokens;
    }
    getAverageUsage(moduleName) {
        const s = this.stats[moduleName];
        if (!s || s.totalRequests === 0)
            return 0;
        return Math.round(s.totalCompletionTokens / s.totalRequests);
    }
    getAnalytics() {
        return {
            lexmentor: {
                totalRequests: this.stats.lexmentor.totalRequests,
                totalPromptTokens: this.stats.lexmentor.totalPromptTokens,
                totalCompletionTokens: this.stats.lexmentor.totalCompletionTokens,
                averageCompletionTokens: this.getAverageUsage('lexmentor'),
            },
            research: {
                totalRequests: this.stats.research.totalRequests,
                totalPromptTokens: this.stats.research.totalPromptTokens,
                totalCompletionTokens: this.stats.research.totalCompletionTokens,
                averageCompletionTokens: this.getAverageUsage('research'),
            },
            judgment: {
                totalRequests: this.stats.judgment.totalRequests,
                totalPromptTokens: this.stats.judgment.totalPromptTokens,
                totalCompletionTokens: this.stats.judgment.totalCompletionTokens,
                averageCompletionTokens: this.getAverageUsage('judgment'),
            },
            notebook: {
                totalRequests: this.stats.notebook.totalRequests,
                totalPromptTokens: this.stats.notebook.totalPromptTokens,
                totalCompletionTokens: this.stats.notebook.totalCompletionTokens,
                averageCompletionTokens: this.getAverageUsage('notebook'),
            },
        };
    }
};
exports.TokenOptimizationService = TokenOptimizationService;
exports.TokenOptimizationService = TokenOptimizationService = __decorate([
    (0, common_1.Injectable)()
], TokenOptimizationService);
//# sourceMappingURL=token-optimization.service.js.map