import type { KnowledgeRetrievalRequest, RetrievalCandidate } from '../types';

const intentWeights: Record<string, Record<string, number>> = {
  learning: { curriculum: 1.2, lesson: 1.2, pattern: 1.1, teaching_rule: 0.9, behaviour_rule: 0.8 },
  drafting: { pattern: 1.3, lesson: 1.0, draft_history: 1.0, teaching_rule: 1.0 },
  review: { previous_feedback: 1.25, pattern: 1.2, draft_history: 1.15, weakness: 1.1 },
  revision: { revision_history: 1.3, previous_feedback: 1.3, draft_history: 1.2, weakness: 1.1 },
  quiz: { lesson: 1.25, mastery: 1.2, assessment_rule: 1.1 },
  assessment: { assessment_rule: 1.35, lesson: 1.1, mastery: 1.1 },
  capstone: { capstone_project: 1.4, pattern: 1.1, revision_history: 1.1, previous_feedback: 1.1 },
  bare_act_analysis: { bare_act_component: 1.45, pattern: 1.2 },
};

export class KnowledgeRanker {
  rank(candidates: RetrievalCandidate[], request: KnowledgeRetrievalRequest): RetrievalCandidate[] {
    return candidates
      .map((candidate) => this.score(candidate, request))
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  dedupe(candidates: RetrievalCandidate[]): RetrievalCandidate[] {
    const seen = new Map<string, RetrievalCandidate>();

    for (const candidate of candidates) {
      const parentId = String(candidate.document.metadata.parentId ?? candidate.document.id);
      const existing = seen.get(parentId);
      if (!existing || candidate.finalScore > existing.finalScore) {
        seen.set(parentId, candidate);
      }
    }

    return [...seen.values()];
  }

  private score(candidate: RetrievalCandidate, request: KnowledgeRetrievalRequest): RetrievalCandidate {
    const kindWeight = intentWeights[request.intent]?.[candidate.document.kind] ?? 1;
    const metadataScore = this.metadataFit(candidate, request);
    const recencyScore = this.recency(candidate);
    const masteryScore = this.masteryFit(candidate, request);
    const base =
      (candidate.vectorScore ?? 0) * 0.45 +
      (candidate.keywordScore ?? 0) * 0.3 +
      metadataScore * 0.15 +
      recencyScore * 0.06 +
      masteryScore * 0.04;

    return {
      ...candidate,
      metadataScore,
      recencyScore,
      masteryScore,
      finalScore: base * kindWeight,
      reasons: [
        ...candidate.reasons,
        `intent_weight:${kindWeight.toFixed(2)}`,
        metadataScore > 0 ? `metadata_fit:${metadataScore.toFixed(2)}` : '',
        recencyScore > 0 ? `recency:${recencyScore.toFixed(2)}` : '',
      ].filter(Boolean),
    };
  }

  private metadataFit(candidate: RetrievalCandidate, request: KnowledgeRetrievalRequest): number {
    const metadata = candidate.document.metadata;
    let score = 0;
    let checks = 0;
    const pairs: Array<[unknown, unknown]> = [
      [metadata.userId, request.userId],
      [metadata.courseId, request.courseId],
      [metadata.moduleId, request.moduleId],
      [metadata.lessonId, request.lessonId],
      [metadata.projectId, request.projectId],
      [metadata.draftId, request.draftId],
      [metadata.jurisdiction, request.jurisdiction],
      [metadata.difficulty, request.studentLevel],
    ];

    for (const [left, right] of pairs) {
      if (right === undefined) continue;
      checks += 1;
      if (left === right) score += 1;
    }

    if (request.patternNames?.includes(String(metadata.patternName))) {
      score += 1;
      checks += 1;
    }

    if (request.componentTypes?.includes(String(metadata.componentType))) {
      score += 1;
      checks += 1;
    }

    return checks === 0 ? 0.5 : score / checks;
  }

  private recency(candidate: RetrievalCandidate): number {
    const value = candidate.document.metadata.updatedAt ?? candidate.document.metadata.createdAt;
    if (!value || typeof value !== 'string') {
      return 0;
    }

    const ageMs = Date.now() - Date.parse(value);
    if (!Number.isFinite(ageMs) || ageMs < 0) {
      return 0;
    }

    const ageDays = ageMs / 86400000;
    return Math.max(0, 1 - ageDays / 90);
  }

  private masteryFit(candidate: RetrievalCandidate, request: KnowledgeRetrievalRequest): number {
    if (!request.masteryState) {
      return 0.5;
    }

    return candidate.document.metadata.masteryState === request.masteryState ? 1 : 0.25;
  }
}
