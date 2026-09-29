"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CitationGenerator = void 0;
const common_1 = require("@nestjs/common");
const CITATION_PATTERNS = [
    { type: 'article', regex: /\bArticle\s+\d+[A-Z]?(?:\(\d+\)(?:[a-z])?)?/gi },
    { type: 'section', regex: /\bSection\s+\d+[A-Z]?(?:\([^)]{1,20}\))?/gi },
    { type: 'source_document', regex: /\b(?:AIR|SCC|SCR|CriLJ|INSC|MANU|SCC OnLine)\s+[\dA-Z/().:\s-]{4,60}/g },
    {
        type: 'case',
        regex: /\b[A-Z][A-Za-z. ]{2,50}\s+v\.?\s+[A-Z][A-Za-z. ]{2,50}(?:\s*,?\s*\(?\d{4}\)?)?/g,
    },
];
const ANCHOR_REGEX = /\[A(\d+)\]/g;
let CitationGenerator = class CitationGenerator {
    extract(authorities, generatedAnswer = '') {
        const citations = new Map();
        authorities.forEach((authority, idx) => {
            const sourceId = authority.id;
            const excerpt = authority.chunkText.slice(0, 300);
            const anchorId = `A${idx + 1}`;
            if (authority.citation) {
                this.upsert(citations, {
                    id: `retrieved-${anchorId}-citation`,
                    citation: authority.citation,
                    type: /Judgments/.test(authority.collection) ? 'case' : 'source_document',
                    sourceId,
                    support: 'retrieved',
                    excerpt,
                    verified: true,
                });
            }
            if (authority.article) {
                this.upsert(citations, {
                    id: `retrieved-${anchorId}-article`,
                    citation: `Article ${authority.article}`,
                    type: 'article',
                    sourceId,
                    support: 'retrieved',
                    excerpt,
                    verified: true,
                });
            }
            if (authority.section) {
                this.upsert(citations, {
                    id: `retrieved-${anchorId}-section`,
                    citation: `Section ${authority.section}`,
                    type: 'section',
                    sourceId,
                    support: 'retrieved',
                    excerpt,
                    verified: true,
                });
            }
            this.extractFromText(authority.chunkText, sourceId, excerpt, 'retrieved').forEach((c) => this.upsert(citations, c));
        });
        this.resolveAnchors(generatedAnswer, authorities).forEach((c) => this.upsert(citations, c));
        this.extractFromText(generatedAnswer, undefined, undefined, 'generated').forEach((c) => {
            const key = this.citationKey(c);
            if (!citations.has(key)) {
                this.upsert(citations, { ...c, verified: false });
            }
        });
        return Array.from(citations.values()).slice(0, 40);
    }
    resolveAnchors(answer, authorities) {
        const result = [];
        let match;
        ANCHOR_REGEX.lastIndex = 0;
        const regex = new RegExp(ANCHOR_REGEX.source, 'g');
        while ((match = regex.exec(answer)) !== null) {
            const authorityIdx = parseInt(match[1], 10) - 1;
            const authority = authorities[authorityIdx];
            if (!authority)
                continue;
            result.push({
                id: `anchor-A${authorityIdx + 1}`,
                citation: authority.citation || authority.title,
                type: /Judgments/.test(authority.collection) ? 'case' : 'source_document',
                sourceId: authority.id,
                support: 'retrieved',
                excerpt: authority.chunkText.slice(0, 200),
                verified: true,
            });
        }
        return result;
    }
    extractFromText(text, sourceId, excerpt, support = 'retrieved') {
        const found = [];
        for (const { type, regex } of CITATION_PATTERNS) {
            const cloned = new RegExp(regex.source, regex.flags);
            let match;
            while ((match = cloned.exec(text)) !== null) {
                const citation = match[0].replace(/\s+/g, ' ').trim();
                if (citation.length < 4)
                    continue;
                found.push({
                    id: `${type}-${sourceId ?? 'ans'}-${found.length}`,
                    citation,
                    type,
                    sourceId,
                    support,
                    excerpt,
                    verified: support === 'retrieved',
                });
            }
        }
        return found;
    }
    upsert(map, citation) {
        const key = this.citationKey(citation);
        const existing = map.get(key);
        if (!existing || (citation.support === 'retrieved' && existing.support === 'generated')) {
            map.set(key, citation);
        }
    }
    citationKey(c) {
        return `${c.type}:${c.citation.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    }
};
exports.CitationGenerator = CitationGenerator;
exports.CitationGenerator = CitationGenerator = __decorate([
    (0, common_1.Injectable)()
], CitationGenerator);
//# sourceMappingURL=citation-generator.service.js.map