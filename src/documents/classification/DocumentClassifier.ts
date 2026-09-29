import type { ClassificationResult, PipelineDocumentType } from '../types';

export class DocumentClassifier {
  classify(text: string, declaredType?: PipelineDocumentType): ClassificationResult {
    if (declaredType && declaredType !== 'unknown') {
      return { documentType: declaredType, confidence: 0.95, reasons: ['declared_type'] };
    }

    const lower = text.toLowerCase();
    const scores: Array<{ type: PipelineDocumentType; score: number; reasons: string[] }> = [
      this.score('bare_act', lower, ['an act to', 'be it enacted', 'short title', 'extent and commencement', 'section', 'schedule']),
      this.score('student_draft', lower, ['draft', 'my clause', 'student', 'shall', 'provided that']),
      this.score('assignment', lower, ['assignment', 'submit', 'marks', 'deadline', 'instructions']),
      this.score('rubric', lower, ['rubric', 'criteria', 'marks', 'excellent', 'satisfactory']),
      this.score('teacher_material', lower, ['handout', 'lecture', 'teacher', 'class note', 'reading']),
      this.score('notes', lower, ['notes', 'summary', 'remember', 'important points']),
    ].sort((a, b) => b.score - a.score);

    const best = scores[0];
    if (!best || best.score === 0) {
      return { documentType: 'unknown', confidence: 0.2, reasons: ['no_strong_signal'] };
    }

    return {
      documentType: best.type,
      confidence: Math.min(0.99, 0.35 + best.score * 0.1),
      reasons: best.reasons,
    };
  }

  private score(type: PipelineDocumentType, text: string, signals: string[]): { type: PipelineDocumentType; score: number; reasons: string[] } {
    const reasons = signals.filter((signal) => text.includes(signal));
    return { type, score: reasons.length, reasons };
  }
}
