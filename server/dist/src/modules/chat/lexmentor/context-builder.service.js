"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextBuilder = void 0;
const common_1 = require("@nestjs/common");
const MAX_CONTEXT_CHARS = 8000;
const MAX_CHUNK_CHARS = 1000;
let ContextBuilder = class ContextBuilder {
    build(query, intent, authorities) {
        const selected = this.selectWithinBudget(authorities);
        const contextLines = [];
        let charCount = 0;
        for (const [idx, authority] of selected.entries()) {
            const refs = [
                authority.citation,
                authority.section ? `Section ${authority.section}` : undefined,
                authority.article ? `Article ${authority.article}` : undefined,
                authority.page ? `Page ${authority.page}` : undefined,
            ]
                .filter(Boolean)
                .join(' | ');
            const lines = [
                `[A${idx + 1}] ${authority.collection}: ${authority.title}`,
                refs ? `Reference: ${refs}` : undefined,
                authority.court ? `Court: ${authority.court}` : undefined,
                authority.date ? `Date: ${authority.date}` : undefined,
                `Excerpt: ${this.truncate(authority.chunkText, MAX_CHUNK_CHARS)}`,
            ]
                .filter(Boolean)
                .join('\n');
            charCount += lines.length + 2;
            if (charCount > MAX_CONTEXT_CHARS)
                break;
            contextLines.push(lines);
        }
        const contextBlock = contextLines.join('\n\n');
        const tokenEstimate = Math.ceil(contextBlock.length / 3.5);
        return {
            contextBlock,
            authorities: selected.slice(0, contextLines.length),
            hasAuthoritativeSources: contextLines.length > 0,
            tokenEstimate,
        };
    }
    selectWithinBudget(authorities) {
        const userDocs = authorities.filter((a) => a.collection === 'User Uploaded Documents');
        const others = authorities.filter((a) => a.collection !== 'User Uploaded Documents');
        const ordered = [...userDocs, ...others];
        let budget = MAX_CONTEXT_CHARS;
        const selected = [];
        for (const authority of ordered) {
            const size = Math.min(authority.chunkText.length, MAX_CHUNK_CHARS) + 150;
            if (budget - size < 0)
                break;
            budget -= size;
            selected.push(authority);
        }
        return selected;
    }
    truncate(text, maxLen) {
        const norm = (text ?? '').replace(/\s+/g, ' ').trim();
        return norm.length <= maxLen ? norm : `${norm.slice(0, maxLen - 1)}…`;
    }
};
exports.ContextBuilder = ContextBuilder;
exports.ContextBuilder = ContextBuilder = __decorate([
    (0, common_1.Injectable)()
], ContextBuilder);
//# sourceMappingURL=context-builder.service.js.map