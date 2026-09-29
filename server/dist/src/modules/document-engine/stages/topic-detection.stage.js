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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopicDetectionStage = void 0;
const common_1 = require("@nestjs/common");
const document_engine_constants_1 = require("../document-engine.constants");
const CONSTRUCT_PATTERNS = [
    { type: 'test', regex: /\b(test|criteri[ao]|touchstone)\b.{0,40}\b(is|are|for determining)\b/i },
    { type: 'exception', regex: /\b(provided that|except|exception|shall not apply|does not apply)\b/i },
    { type: 'doctrine', regex: /\bdoctrine of\b/i },
    { type: 'holding', regex: /\b(held|it was held|the court held)\b/i },
    { type: 'principle', regex: /\b(principle of|it is a settled principle|well[- ]established principle)\b/i },
];
let TopicDetectionStage = class TopicDetectionStage {
    constructor() {
        this.topicKeywords = {};
        for (const [topic, subtopics] of Object.entries(document_engine_constants_1.TAXONOMY)) {
            this.topicKeywords[topic] = [
                new RegExp(this.escape(topic), 'i'),
                ...subtopics.map((s) => new RegExp(this.escape(s), 'i')),
            ];
        }
    }
    classifyTopics(section) {
        const scores = [];
        for (const [topic, patterns] of Object.entries(this.topicKeywords)) {
            const hits = patterns.filter((p) => p.test(section.text)).length;
            if (hits > 0) {
                scores.push({ topic, confidence: Math.min(0.95, 0.4 + hits * 0.15) });
            }
        }
        return scores.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    }
    classifySubtopics(section, topicTags) {
        const results = [];
        for (const { topic } of topicTags) {
            const subtopics = document_engine_constants_1.TAXONOMY[topic] || [];
            for (const subtopic of subtopics) {
                const regex = new RegExp(this.escape(subtopic), 'i');
                if (regex.test(section.text)) {
                    results.push({ topic, subtopic, confidence: 0.7 });
                }
            }
        }
        return results;
    }
    detectConstructs(section) {
        const constructs = [];
        for (const { type, regex } of CONSTRUCT_PATTERNS) {
            const match = section.text.match(regex);
            if (match) {
                const start = Math.max(0, match.index - 60);
                const end = Math.min(section.text.length, (match.index || 0) + match[0].length + 200);
                constructs.push({ sectionId: section.id, constructType: type, text: section.text.slice(start, end).trim() });
            }
        }
        return constructs;
    }
    escape(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};
exports.TopicDetectionStage = TopicDetectionStage;
exports.TopicDetectionStage = TopicDetectionStage = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], TopicDetectionStage);
//# sourceMappingURL=topic-detection.stage.js.map