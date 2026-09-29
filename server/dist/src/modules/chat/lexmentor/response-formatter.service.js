"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseFormatter = void 0;
const common_1 = require("@nestjs/common");
const lexmentor_policy_1 = require("./lexmentor-policy");
let ResponseFormatter = class ResponseFormatter {
    format(content, intent, authorities, citations, verification, retrievalConfidence = 0, fromUploadedDocument = false) {
        let resolved = this.resolveAnchors(content, authorities);
        resolved = this.stripUnverifiedCitations(resolved, citations);
        const sections = [];
        if (fromUploadedDocument) {
            sections.push(`*${lexmentor_policy_1.LEXMENTOR_UPLOADED_DOC_NOTE}*`, '');
        }
        sections.push(resolved.trim());
        const sourcesBlock = this.buildSourcesBlock(authorities, verification);
        if (sourcesBlock)
            sections.push(sourcesBlock);
        sections.push('## Confidence Level', (0, lexmentor_policy_1.formatConfidenceLevel)(retrievalConfidence), '', '---', lexmentor_policy_1.LEXMENTOR_LEGAL_DISCLAIMER);
        return sections.join('\n\n');
    }
    templateFor(intent) {
        const templates = {
            Concept: 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
            'Bare Act': 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
            'Case Law': 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
            'Constitutional Law': 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
            Research: 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
            Drafting: 'Answer → Legal Explanation → Relevant Provision(s) → Practical Example → Important Notes → Sources → Confidence Level',
            Contract: 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
            'Moot Court': 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
            General: 'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation (if available) → Practical Example → Important Notes → Sources → Confidence Level',
        };
        return templates[intent];
    }
    resolveAnchors(content, authorities) {
        return content.replace(/\[A(\d+)\]/g, (_match, numStr) => {
            const idx = parseInt(numStr, 10) - 1;
            const authority = authorities[idx];
            if (!authority)
                return `[A${numStr}]`;
            const label = authority.citation || authority.title;
            return `*(${label})*`;
        });
    }
    stripUnverifiedCitations(content, citations) {
        const unverified = citations.filter((c) => c.support === 'generated' && !c.verified);
        let result = content;
        for (const citation of unverified) {
            const escaped = citation.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escaped, 'gi'), '[citation removed — not verified in retrieved sources]');
        }
        return result;
    }
    buildSourcesBlock(authorities, verification) {
        if (!authorities.length)
            return '';
        const lines = ['## Sources'];
        authorities.slice(0, 8).forEach((a, idx) => {
            const reference = a.section
                ? `Section ${a.section}`
                : a.article
                    ? `Article ${a.article}`
                    : a.page
                        ? `Page ${a.page}`
                        : '';
            const court = a.court ? ` [${a.court}]` : '';
            const date = a.date ? ` (${a.date})` : '';
            const refSuffix = reference ? ` — ${reference}` : '';
            lines.push(`${idx + 1}. **${a.title}** — *${a.collection}${refSuffix}*${court}${date}`);
        });
        if (verification.available && verification.riskLevel) {
            lines.push('');
            const emoji = { Low: '✅', Medium: '⚠️', High: '⛔' }[verification.riskLevel];
            lines.push(`${emoji} **Citation Validation:** ${verification.confidenceScore}% confidence · Risk: ${verification.riskLevel}`);
        }
        return lines.join('\n');
    }
};
exports.ResponseFormatter = ResponseFormatter;
exports.ResponseFormatter = ResponseFormatter = __decorate([
    (0, common_1.Injectable)()
], ResponseFormatter);
//# sourceMappingURL=response-formatter.service.js.map