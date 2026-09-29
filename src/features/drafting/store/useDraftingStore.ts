import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DraftReviewResult, DraftingProject, RevisionRecord, SaveStatus } from '../types/drafting.types';
import { createProject, loadProjects, makeVersion, saveProjects, saveRecovery } from './draftPersistence';
import { nowIso, uid } from '../utils/draftingUtils';

export function useDraftingStore() {
  const [projects, setProjects] = useState<DraftingProject[]>(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? '');
  const [fullscreen, setFullscreen] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [activeMarkerId, setActiveMarkerId] = useState<string | undefined>();
  const [compareVersionId, setCompareVersionId] = useState<string | undefined>();
  const saveTimer = useRef<number | undefined>(undefined);
  const lastSaveHash = useRef('');

  const activeProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? projects[0], [projects, activeProjectId]);
  const activeComponent = useMemo(() => activeProject?.components.find((component) => component.id === activeProject.currentComponentId) ?? activeProject?.components[0], [activeProject]);
  const currentReviews = useMemo(() => activeProject?.reviews.filter((review) => review.componentId === activeComponent?.id).slice().reverse() ?? [], [activeComponent?.id, activeProject?.reviews]);

  useEffect(() => {
    const hash = JSON.stringify(projects);
    if (hash === lastSaveHash.current) return;
    setSaveStatus(navigator.onLine ? 'unsaved' : 'offline');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        saveProjects(projects);
        if (activeProject) saveRecovery(activeProject);
        lastSaveHash.current = hash;
        setSaveStatus(navigator.onLine ? 'saved' : 'offline');
      } catch {
        setSaveStatus('error');
      }
    }, 700);
    return () => window.clearTimeout(saveTimer.current);
  }, [activeProject, projects]);

  const updateProject = useCallback((projectId: string, updater: (project: DraftingProject) => DraftingProject) => {
    setProjects((current) => current.map((project) => project.id === projectId ? { ...updater(project), updatedAt: nowIso() } : project));
  }, []);

  const createDraftingProject = useCallback((title = 'Untitled Bare Act Project') => {
    const project = createProject(title);
    setProjects((current) => [project, ...current]);
    setActiveProjectId(project.id);
  }, []);

  const renameProject = useCallback((id: string, title: string) => updateProject(id, (project) => ({ ...project, title: title.trim() || project.title })), [updateProject]);
  const archiveProject = useCallback((id: string) => updateProject(id, (project) => ({ ...project, archived: !project.archived })), [updateProject]);
  const deleteProject = useCallback((id: string) => {
    setProjects((current) => {
      const next = current.filter((project) => project.id !== id);
      if (activeProjectId === id) setActiveProjectId(next[0]?.id ?? '');
      return next.length ? next : [createProject('Untitled Bare Act Project')];
    });
  }, [activeProjectId]);
  const duplicateProject = useCallback((id: string) => {
    const source = projects.find((project) => project.id === id);
    if (!source) return;
    const copy: DraftingProject = { ...source, id: uid('project'), title: `${source.title} copy`, createdAt: nowIso(), updatedAt: nowIso(), archived: false };
    setProjects((current) => [copy, ...current]);
    setActiveProjectId(copy.id);
  }, [projects]);

  const setCurrentComponent = useCallback((componentId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({ ...project, currentComponentId: componentId }));
    setActiveMarkerId(undefined);
  }, [activeProject, updateProject]);

  const updateDraftText = useCallback((text: string) => {
    if (!activeProject || !activeComponent) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      status: 'drafting',
      components: project.components.map((component) => component.id === activeComponent.id ? { ...component, text, status: text.trim() ? 'drafting' : 'not_started', completed: component.completed } : component),
    }));
  }, [activeComponent, activeProject, updateProject]);

  const saveVersion = useCallback((label = 'Saved version', notes?: string) => {
    if (!activeProject || !activeComponent) return;
    const version = { ...makeVersion(activeProject.id, activeComponent.id, activeComponent.text, label), notes };
    updateProject(activeProject.id, (project) => ({ ...project, versions: [version, ...project.versions] }));
    setCompareVersionId(version.id);
  }, [activeComponent, activeProject, updateProject]);

  const addReview = useCallback((review: DraftReviewResult) => {
    updateProject(review.projectId, (project) => ({
      ...project,
      reviewStatus: 'complete',
      status: 'reviewed',
      reviews: [review, ...project.reviews],
      components: project.components.map((component) => component.id === review.componentId ? { ...component, status: 'reviewed' } : component),
    }));
  }, [updateProject]);

  const setReviewStatus = useCallback((status: DraftingProject['reviewStatus']) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({ ...project, reviewStatus: status }));
  }, [activeProject, updateProject]);

  const resolveMarker = useCallback((markerId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      reviews: project.reviews.map((review) => ({ ...review, markers: review.markers.map((marker) => marker.id === markerId ? { ...marker, resolved: !marker.resolved } : marker) })),
    }));
  }, [activeProject, updateProject]);

  const submitRevisionRecord = useCallback((notes: string) => {
    if (!activeProject || !activeComponent) return;
    const version = makeVersion(activeProject.id, activeComponent.id, activeComponent.text, 'Revision version');
    const markers = currentReviews[0]?.markers ?? [];
    const revision: RevisionRecord = {
      id: uid('revision'),
      projectId: activeProject.id,
      componentId: activeComponent.id,
      fromVersionId: compareVersionId,
      toVersionId: version.id,
      notes,
      resolvedFeedbackIds: markers.filter((marker) => marker.resolved).map((marker) => marker.id),
      unresolvedFeedbackIds: markers.filter((marker) => !marker.resolved).map((marker) => marker.id),
      createdAt: nowIso(),
    };
    updateProject(activeProject.id, (project) => ({ ...project, status: 'revising', versions: [version, ...project.versions], revisions: [revision, ...project.revisions] }));
  }, [activeComponent, activeProject, compareVersionId, currentReviews, updateProject]);

  return {
    projects,
    activeProject,
    activeComponent,
    currentReviews,
    activeProjectId,
    setActiveProjectId,
    fullscreen,
    setFullscreen,
    printMode,
    setPrintMode,
    saveStatus,
    activeMarkerId,
    setActiveMarkerId,
    compareVersionId,
    setCompareVersionId,
    createDraftingProject,
    renameProject,
    archiveProject,
    deleteProject,
    duplicateProject,
    setCurrentComponent,
    updateDraftText,
    saveVersion,
    addReview,
    setReviewStatus,
    resolveMarker,
    submitRevisionRecord,
  };
}

