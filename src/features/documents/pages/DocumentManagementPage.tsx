import { motion } from 'framer-motion';
import { Activity, Archive, BookOpen, DatabaseZap, FileStack, FolderSearch, LockKeyhole, Search, ShieldCheck, UploadCloud } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AiAnalysisPanel } from '../analysis/AiAnalysisPanel';
import { useDocumentBackendHints } from '../hooks/useDocumentBackendHints';
import { DocumentLibrary } from '../library/DocumentLibrary';
import { MetadataEditor } from '../management/MetadataEditor';
import { ProcessingMonitor } from '../management/ProcessingMonitor';
import { VersionManager } from '../management/VersionManager';
import { HybridSearchPanel } from '../search/HybridSearchPanel';
import { useDocumentManagement } from '../store/useDocumentManagement';
import { UploadCenter } from '../uploads/UploadCenter';
import { BareActStructureViewer } from '../viewer/BareActStructureViewer';
import { DocumentViewer } from '../viewer/DocumentViewer';
import '../styles/document-management.css';

type Panel = 'viewer' | 'structure' | 'analysis' | 'metadata' | 'versions' | 'monitor';

export function DocumentManagementPage() {
  const documents = useDocumentManagement();
  const hints = useDocumentBackendHints();
  const [panel, setPanel] = useState<Panel>('viewer');

  const stats = useMemo(() => ({
    total: documents.documents.length,
    bareActs: documents.documents.filter((doc) => doc.documentType === 'bare_act').length,
    indexed: documents.documents.filter((doc) => doc.indexingStatus === 'indexed').length,
    failed: documents.jobs.filter((job) => job.status === 'failed').length,
  }), [documents.documents, documents.jobs]);

  const categories = useMemo(() => Array.from(new Set(documents.documents.map((doc) => doc.category))).filter(Boolean), [documents.documents]);
  const active = documents.activeDocument;

  return (
    <main className="document-management-page">
      <section className="documents-hero" aria-labelledby="documents-title">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <span className="documents-kicker"><DatabaseZap size={15} /> Knowledge Library</span>
          <h1 id="documents-title">Document Management</h1>
          <p>Upload, organize, inspect, and monitor Bare Acts, assignments, notes, rubrics, and AI-indexed course knowledge without bypassing the existing document pipeline.</p>
        </motion.div>
        <div className="documents-access-card" aria-label="Access control summary">
          <LockKeyhole size={17} />
          <div><strong>Access scope</strong><span>Students manage private documents. Platform-wide management appears only when backend authorization grants it.</span></div>
        </div>
      </section>

      <section className="documents-metrics" aria-label="Document metrics">
        <article><FileStack size={18} /><strong>{stats.total}</strong><span>Total documents</span></article>
        <article><BookOpen size={18} /><strong>{stats.bareActs}</strong><span>Bare Acts</span></article>
        <article><ShieldCheck size={18} /><strong>{stats.indexed}</strong><span>Indexed</span></article>
        <article className={stats.failed ? 'attention' : ''}><Activity size={18} /><strong>{stats.failed}</strong><span>Failures</span></article>
      </section>

      <section className="documents-workbench">
        <aside className="documents-left-rail" aria-label="Upload and search">
          <UploadCenter jobs={documents.jobs} onUpload={documents.uploadFiles} onRetry={documents.retryUpload} />
          <HybridSearchPanel filters={documents.filters} results={documents.filteredDocuments} onFilters={(next) => { documents.setFilters(next); documents.setPage(1); }} />
          <section className="documents-categories" aria-label="Category filters">
            <header><FolderSearch size={15} /><strong>Categories</strong></header>
            <button type="button" className={documents.filters.category === 'all' ? 'active' : ''} onClick={() => documents.setFilters({ ...documents.filters, category: 'all' })}>All categories</button>
            {categories.map((category) => <button key={category} type="button" className={documents.filters.category === category ? 'active' : ''} onClick={() => documents.setFilters({ ...documents.filters, category })}>{category}</button>)}
          </section>
          <section className="documents-backend-card" aria-label="Backend context status">
            <header><Search size={15} /><strong>Backend context</strong></header>
            <p>{hints.isLoading ? 'Loading student history and project context...' : hints.isError ? 'Backend context unavailable; document management remains local until the API responds.' : 'Student history and projects are available for document-context mapping.'}</p>
          </section>
        </aside>

        <section className="documents-main-panel">
          <DocumentLibrary documents={documents.pagedDocuments} selectedIds={documents.selectedIds} activeId={documents.activeDocumentId} filters={documents.filters} page={documents.page} pageSize={documents.pageSize} total={documents.filteredDocuments.length} onPage={documents.setPage} onFilters={(next) => { documents.setFilters(next); documents.setPage(1); }} onSelect={documents.toggleSelect} onOpen={documents.setActiveDocumentId} onBulk={documents.bulk} />
        </section>

        <aside className="documents-right-panel" aria-label="Document inspector">
          <nav className="documents-panel-tabs" aria-label="Inspector tabs">
            {(['viewer', 'structure', 'analysis', 'metadata', 'versions', 'monitor'] as Panel[]).map((item) => <button key={item} type="button" className={panel === item ? 'active' : ''} onClick={() => setPanel(item)}>{item}</button>)}
          </nav>
          {panel === 'viewer' && <DocumentViewer document={active} onBookmark={documents.toggleBookmark} />}
          {panel === 'structure' && <BareActStructureViewer document={active} onJump={(nodeId) => active && documents.toggleBookmark(active.id, nodeId)} />}
          {panel === 'analysis' && <AiAnalysisPanel document={active} />}
          {panel === 'metadata' && <MetadataEditor document={active} onSave={documents.updateMetadata} />}
          {panel === 'versions' && <VersionManager document={active} onUploadVersion={documents.addVersion} onRestore={documents.restoreVersion} />}
          {panel === 'monitor' && <ProcessingMonitor jobs={documents.jobs} events={documents.events} />}
        </aside>
      </section>
    </main>
  );
}

