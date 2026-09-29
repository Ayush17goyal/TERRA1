import { BookOpen, FileText, MessageSquareText, Sparkles } from 'lucide-react';

export function EmptyState({ onPrompt }: { onPrompt(prompt: string): void }) {
  const prompts = [
    { icon: BookOpen, text: 'Teach me how a definitions clause is drafted.' },
    { icon: FileText, text: 'Review this provision without rewriting it for me.' },
    { icon: Sparkles, text: 'Give me a hint for drafting commencement and extent.' },
  ];
  return (
    <section className="mentor-empty" aria-label="Start a mentor conversation">
      <div><MessageSquareText size={34} /><h2>Bare Act Drafting Mentor</h2><p>Practice legislative drafting with a mentor that teaches method, reviews your attempts, and preserves your authorship.</p></div>
      <div className="mentor-empty-prompts">
        {prompts.map((prompt) => {
          const Icon = prompt.icon;
          return <button key={prompt.text} type="button" onClick={() => onPrompt(prompt.text)}><Icon size={16} />{prompt.text}</button>;
        })}
      </div>
    </section>
  );
}

