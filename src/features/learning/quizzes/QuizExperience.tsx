import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2, Clock, RotateCcw, Send } from 'lucide-react';
import type { QuizState } from '../types/learning.types';
import { LearningCard } from '../components/LearningCard';

type QuizForm = { answers: Record<string, string> };

export function QuizExperience({ quiz, submitting, onSubmit }: { quiz: QuizState; submitting: boolean; onSubmit(input: { quizId: string; lessonId: string; answers: Record<string, string> }): void }) {
  const { register, handleSubmit, watch, reset } = useForm<QuizForm>({ defaultValues: { answers: {} } });
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(quiz.timeLimitSeconds ?? 0);
  const answers = watch('answers');
  const score = useMemo(() => quiz.questions.reduce((total, question) => total + (answers?.[question.id] && answers[question.id] === question.correctOptionId ? 1 : 0), 0), [answers, quiz.questions]);
  useEffect(() => { if (!started || !quiz.timeLimitSeconds) return; const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [quiz.timeLimitSeconds, started]);
  return (
    <LearningCard title={quiz.title} icon={<CheckCircle2 size={17} />} action={started ? <span className="learning-soft"><Clock size={14} />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span> : undefined}>
      {!started ? <div className="learning-start"><p>{quiz.questions.length} questions · {quiz.attemptsAllowed - quiz.attemptsUsed} attempts remaining</p><button type="button" onClick={() => setStarted(true)}>Start quiz</button></div> : <form className="learning-quiz-form" onSubmit={handleSubmit((values) => onSubmit({ quizId: quiz.id, lessonId: quiz.lessonId, answers: values.answers }))}>{quiz.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option) => <label key={option}><input type="radio" value={option} {...register(`answers.${question.id}`)} />{option}</label>)}{answers?.[question.id] && question.explanation && <p className={answers[question.id] === question.correctOptionId ? 'correct' : 'incorrect'}>{question.explanation}</p>}</fieldset>)}<div className="learning-form-actions"><span>Current score preview: {score}/{quiz.questions.length}</span><button type="button" onClick={() => reset()}><RotateCcw size={14} />Reset</button><button type="submit" disabled={submitting}><Send size={14} />Submit</button></div></form>}
    </LearningCard>
  );
}
