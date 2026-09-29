import { useMutation, useQuery } from '@tanstack/react-query';
import { draftingApi } from '../services/DraftingApi';
import type { DraftComponent, DraftingProject } from '../types/drafting.types';
import { parseReviewResponse } from '../utils/reviewParser';

export function useDraftReview(project: DraftingProject | undefined, component: DraftComponent | undefined, onReview: ReturnType<typeof import('../store/useDraftingStore').useDraftingStore>['addReview'], setReviewStatus: ReturnType<typeof import('../store/useDraftingStore').useDraftingStore>['setReviewStatus']) {
  return useMutation({
    mutationFn: async () => {
      if (!project || !component) throw new Error('No active component to review.');
      setReviewStatus('pending');
      const response = await draftingApi.reviewDraft({
        draftText: component.text,
        draftObjective: `Review ${component.label} for ${project.title}`,
        componentType: component.type,
        moduleId: project.moduleId,
        lessonId: project.lessonId,
        studentLevel: 'developing',
      });
      return parseReviewResponse(response.text, project.id, component.id, component.text);
    },
    onSuccess: (review) => onReview(review),
    onError: () => setReviewStatus('failed'),
  });
}

export function useRevisionFeedback(project: DraftingProject | undefined, component: DraftComponent | undefined) {
  return useMutation({
    mutationFn: async (notes: string) => {
      if (!project || !component) throw new Error('No active component to revise.');
      return draftingApi.submitRevision({
        draftText: component.text,
        draftObjective: `Revision feedback for ${component.label}`,
        componentType: component.type,
        previousFeedback: notes,
        draftId: component.id,
        moduleId: project.moduleId,
        lessonId: project.lessonId,
      });
    },
  });
}

export function useEducationalSidebar(project: DraftingProject | undefined) {
  return useQuery({
    queryKey: ['bare-act-drafting-sidebar', project?.moduleId, project?.lessonId],
    queryFn: () => draftingApi.getSidebarData(project?.moduleId, project?.lessonId),
    staleTime: 60_000,
  });
}
