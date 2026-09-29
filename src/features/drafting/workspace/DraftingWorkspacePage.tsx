import { motion } from 'framer-motion';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DraftMetadataBar } from '../components/DraftMetadataBar';
import { DraftStructurePanel } from '../components/DraftStructurePanel';
import { EducationalSidebar } from '../components/EducationalSidebar';
import { ProjectManager } from '../components/ProjectManager';
import { LegislativeEditor } from '../editor/LegislativeEditor';
import { useDraftReview, useEducationalSidebar, useRevisionFeedback } from '../hooks/useDraftingApi';
import { InlineFeedbackPanel } from '../review/InlineFeedbackPanel';
import { ReviewPanel } from '../review/ReviewPanel';
import { RevisionWorkspace } from '../revisions/RevisionWorkspace';
import { useDraftingStore } from '../store/useDraftingStore';
import { VersionComparison } from '../versions/VersionComparison';
import { VersionHistory } from '../versions/VersionHistory';
import './DraftingWorkspacePage.css';

export default function DraftingWorkspacePage() {
  const store = useDraftingStore();
  const sidebar = useEducationalSidebar(store.activeProject);
  const review = useDraftReview(store.activeProject, store.activeComponent, store.addReview, store.setReviewStatus);
  const revision = useRevisionFeedback(store.activeProject, store.activeComponent);
  const [rightOpen, setRightOpen] = useState(true);
  const markers = store.currentReviews[0]?.markers ?? [];
  const selectedVersion = useMemo(() => store.activeProject?.versions.find((version) => version.id === store.compareVersionId), [store.activeProject?.versions, store.compareVersionId]);

  if (!store.activeProject || !store.activeComponent) return null;

  return (
    <div className={`draft-workspace-page ${store.fullscreen ? 'fullscreen' : ''} ${store.printMode ? 'print-mode' : ''}`}>
      <ProjectManager
        projects={store.projects}
        activeId={store.activeProject.id}
        onSelect={store.setActiveProjectId}
        onCreate={() => store.createDraftingProject('New Bare Act Project')}
        onRename={store.renameProject}
        onArchive={store.archiveProject}
        onDuplicate={store.duplicateProject}
        onDelete={store.deleteProject}
      />
      <main className="draft-workspace-main">
        <DraftMetadataBar project={store.activeProject} component={store.activeComponent} saveStatus={store.saveStatus} />
        <div className="draft-workspace-grid">
          <aside className="draft-left-rail">
            <DraftStructurePanel components={store.activeProject.components} activeId={store.activeComponent.id} onSelect={store.setCurrentComponent} />
            <VersionHistory versions={store.activeProject.versions.filter((version) => version.componentId === store.activeComponent?.id)} revisions={store.activeProject.revisions.filter((item) => item.componentId === store.activeComponent?.id)} activeVersionId={store.compareVersionId} onSelect={store.setCompareVersionId} />
          </aside>
          <motion.section className="draft-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <LegislativeEditor
              component={store.activeComponent}
              markers={markers}
              value={store.activeComponent.text}
              saveStatus={store.saveStatus}
              fullscreen={store.fullscreen}
              printMode={store.printMode}
              onChange={store.updateDraftText}
              onSaveVersion={() => store.saveVersion('Manual save')}
              onToggleFullscreen={() => store.setFullscreen(!store.fullscreen)}
              onTogglePrintMode={() => store.setPrintMode(!store.printMode)}
              onMarkerSelect={store.setActiveMarkerId}
            />
            <VersionComparison previous={selectedVersion} currentText={store.activeComponent.text} />
          </motion.section>
          <aside className={`draft-right-rail ${rightOpen ? 'open' : ''}`}>
            <button className="draft-panel-toggle" type="button" onClick={() => setRightOpen(!rightOpen)}>{rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />} Guidance</button>
            {rightOpen && (
              <>
                <EducationalSidebar data={sidebar.data} loading={sidebar.isLoading} />
                <ReviewPanel reviews={store.currentReviews} loading={review.isPending} error={review.error instanceof Error ? review.error.message : undefined} onReview={() => review.mutate()} />
                <InlineFeedbackPanel markers={markers} activeId={store.activeMarkerId} onSelect={store.setActiveMarkerId} onResolve={store.resolveMarker} />
                <RevisionWorkspace loading={revision.isPending} feedback={revision.data?.text} onSubmit={(notes) => { store.submitRevisionRecord(notes); revision.mutate(notes); }} />
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
