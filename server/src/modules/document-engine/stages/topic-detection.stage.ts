import { Injectable } from '@nestjs/common';
import { ExamConstruct, ExamConstructType, SectionNode, SubtopicTag, TopicTag } from '../types/document-graph.types';
import { TAXONOMY } from '../document-engine.constants';

const CONSTRUCT_PATTERNS: Array<{ type: ExamConstructType; regex: RegExp }> = [
  { type: 'test', regex: /\b(test|criteri[ao]|touchstone)\b.{0,40}\b(is|are|for determining)\b/i },
  { type: 'exception', regex: /\b(provided that|except|exception|shall not apply|does not apply)\b/i },
  { type: 'doctrine', regex: /\bdoctrine of\b/i },
  { type: 'holding', regex: /\b(held|it was held|the court held)\b/i },
  { type: 'principle', regex: /\b(principle of|it is a settled principle|well[- ]established principle)\b/i },
];

// architecture.md §3 Stage 5-6 (Topic / Subtopic Detection):
// "Classify each Section against a legal subject taxonomy, independent of the document's own
// heading text ... Identification of 'exam-relevant constructs' within the subtopic."
//
// Uses a keyword-density heuristic classifier against the stand-in TAXONOMY constant. This is
// the integration seam architecture.md §6 reserves for the future Taxonomy Registry module
// (not yet built) — swapping in a real classifier means replacing this stage's internals, not
// the DocumentEngine pipeline around it.
@Injectable()
export class TopicDetectionStage {
  private readonly topicKeywords: Record<string, RegExp[]>;

  constructor() {
    this.topicKeywords = {};
    for (const [topic, subtopics] of Object.entries(TAXONOMY)) {
      this.topicKeywords[topic] = [
        new RegExp(this.escape(topic), 'i'),
        ...subtopics.map((s) => new RegExp(this.escape(s), 'i')),
      ];
    }
  }

  classifyTopics(section: SectionNode): TopicTag[] {
    const scores: TopicTag[] = [];
    for (const [topic, patterns] of Object.entries(this.topicKeywords)) {
      const hits = patterns.filter((p) => p.test(section.text)).length;
      if (hits > 0) {
        scores.push({ topic, confidence: Math.min(0.95, 0.4 + hits * 0.15) });
      }
    }
    return scores.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  classifySubtopics(section: SectionNode, topicTags: TopicTag[]): SubtopicTag[] {
    const results: SubtopicTag[] = [];
    for (const { topic } of topicTags) {
      const subtopics = TAXONOMY[topic] || [];
      for (const subtopic of subtopics) {
        const regex = new RegExp(this.escape(subtopic), 'i');
        if (regex.test(section.text)) {
          results.push({ topic, subtopic, confidence: 0.7 });
        }
      }
    }
    return results;
  }

  detectConstructs(section: SectionNode): ExamConstruct[] {
    const constructs: ExamConstruct[] = [];
    for (const { type, regex } of CONSTRUCT_PATTERNS) {
      const match = section.text.match(regex);
      if (match) {
        const start = Math.max(0, match.index! - 60);
        const end = Math.min(section.text.length, (match.index || 0) + match[0].length + 200);
        constructs.push({ sectionId: section.id, constructType: type, text: section.text.slice(start, end).trim() });
      }
    }
    return constructs;
  }

  private escape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
