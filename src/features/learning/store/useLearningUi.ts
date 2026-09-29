import { useMemo, useState } from 'react';
import type { LearningLesson, LearningModule, LearningView } from '../types/learning.types';

export function useLearningUi(modules: LearningModule[] = []) {
  const [view, setView] = useState<LearningView>('dashboard');
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'locked' | 'completed'>('all');
  const selectedLesson = useMemo<LearningLesson | undefined>(() => modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === selectedLessonId) ?? modules[0]?.lessons[0], [modules, selectedLessonId]);
  const filteredModules = useMemo(() => modules.map((module) => ({
    ...module,
    lessons: module.lessons.filter((lesson) => {
      const matchesText = `${module.title} ${lesson.title} ${lesson.summary}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || lesson.status === statusFilter;
      return matchesText && matchesStatus;
    }),
  })).filter((module) => module.lessons.length > 0), [modules, query, statusFilter]);
  return { view, setView, selectedLesson, selectedLessonId, setSelectedLessonId, query, setQuery, statusFilter, setStatusFilter, filteredModules };
}
