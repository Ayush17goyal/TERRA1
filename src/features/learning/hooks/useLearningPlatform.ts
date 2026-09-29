import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from '../services/LearningApi';

export function useLearningPlatform() {
  return useQuery({
    queryKey: ['bare-act-learning-platform'],
    queryFn: () => learningApi.loadPlatform(),
    staleTime: 60_000,
  });
}

export function useLearningActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bare-act-learning-platform'] });
  return {
    startLesson: useMutation({ mutationFn: ({ moduleId, lessonId }: { moduleId: string; lessonId: string }) => learningApi.startLesson(moduleId, lessonId), onSuccess: invalidate }),
    completeLesson: useMutation({ mutationFn: ({ moduleId, lessonId }: { moduleId: string; lessonId: string }) => learningApi.completeLesson(moduleId, lessonId), onSuccess: invalidate }),
    startQuiz: useMutation({ mutationFn: ({ moduleId, lessonId }: { moduleId: string; lessonId: string }) => learningApi.startQuiz(moduleId, lessonId), onSuccess: invalidate }),
    submitQuiz: useMutation({ mutationFn: (input: { quizId: string; lessonId: string; answers: Record<string, string> }) => learningApi.submitQuiz(input), onSuccess: invalidate }),
    startAssessment: useMutation({ mutationFn: ({ moduleId, lessonId, assessmentId }: { moduleId: string; lessonId: string; assessmentId: string }) => learningApi.startAssessment(moduleId, lessonId, assessmentId), onSuccess: invalidate }),
    submitAssessment: useMutation({ mutationFn: (input: { assessmentId: string; submission: string }) => learningApi.submitAssessment(input), onSuccess: invalidate }),
    reviewCapstone: useMutation({ mutationFn: (draftText: string) => learningApi.reviewCapstone(draftText), onSuccess: invalidate }),
  };
}
