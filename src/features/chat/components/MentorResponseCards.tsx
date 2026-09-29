import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, FileSearch, GraduationCap, HelpCircle, PenLine, Scale, Sparkles, Target } from 'lucide-react';
import type { MentorStructuredSection } from '../types/chat.types';
import { MarkdownRenderer } from './MarkdownRenderer';

const icons: Record<MentorStructuredSection['kind'], typeof BookOpen> = {
  explanation: BookOpen,
  draft_review: ClipboardCheck,
  revision_guidance: PenLine,
  quiz: HelpCircle,
  reflection_questions: Sparkles,
  next_action: ArrowRight,
  learning_objective: Target,
  progress_update: CheckCircle2,
  assessment_feedback: AlertCircle,
  capstone_review: GraduationCap,
  bare_act_analysis: FileSearch,
};

export function MentorResponseCards({ sections }: { sections: MentorStructuredSection[] }) {
  if (!sections.length) return null;
  return (
    <div className="mentor-response-grid" aria-label="Structured mentor response">
      {sections.map((section, index) => {
        const Icon = icons[section.kind] ?? Scale;
        return (
          <article className={`mentor-response-card ${section.kind}`} key={`${section.title}-${index}`}>
            <header>
              <Icon size={16} aria-hidden="true" />
              <h3>{section.title}</h3>
              {typeof section.score === 'number' && <span>{section.score}%</span>}
            </header>
            {section.items && section.items.length > 1 ? (
              <ul>
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <MarkdownRenderer content={section.content} citations={section.citations} />
            )}
          </article>
        );
      })}
    </div>
  );
}

