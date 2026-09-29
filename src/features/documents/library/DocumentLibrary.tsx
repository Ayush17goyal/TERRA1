import { Archive, FileText, RotateCcw, Search, Tags, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useVirtualDocuments } from '../hooks/useVirtualDocuments';
import type { DocumentFilters, ManagedDocument, ProcessingStatus } from '../types/document.types';
import { readableBytes } from '../utils/documentUtils';

export function DocumentLibrary({ documents, selectedIds, activeId, filters, page, pageSize, total, onPage, onFilters, onSelect, onOpen, onBulk }: {
  documents: ManagedDocument[];
  selectedIds: string[];
  activeId?: string;
  filters: DocumentFilters;
  page: number;
  pageSize: number;
  total: number;
  onPage(page: number): void;
  onFilters(filters: DocumentFilters): void;
  onSelect(id: string): void;
  onOpen(id: string): void;
  onBulk(action: 'archive' | 'restore' | 'delete' | 'reindex'): void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(520);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height || 520));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const virtual = useVirtualDocuments(documents, 72, height, scrollTop);

  return (
    <section className="documents-library" aria-label="Document library">
      <header className="documents-library-toolbar">
        <label><Search size={15} /><input value={filters.query} onChange={(event) => onFilters({ ...filters, query: event.target.value })} placeholder="Search documents, metadata, tags" /></label>
        <select aria-label="Filter by document type" value={filters.documentType} onChange={(event) => onFilters({ ...filters, documentType: event.target.value as DocumentFilters['documentType'] })}><option value="all">All types</option><option value="bare_act">Bare Acts</option><option value="student_draft">Student drafts</option><option value="assignment">Assignments</option><option value="rubric">Rubrics</option><option value="teacher_material">Teacher material</option><option value="notes">Notes</option></select>
        <select aria-label="Filter by processing status" value={filters.status} onChange={(event) => onFilters({ ...filters, status: event.target.value as ProcessingStatus | 'all' })}><option value="all">All statuses</option><option value="indexed">Indexed</option><option value="processing">Processing</option><option value="failed">Failed</option><option value="archived">Archived</option></select>
        <label className="documents-semantic"><input type="checkbox" checked={filters.semantic} onChange={(event) => onFilters({ ...filters, semantic: event.target.checked, sortBy: event.target.checked ? 'relevance' : filters.sortBy })} /> Semantic</label>
      </header>

      {selectedIds.length > 0 && <div className="documents-bulkbar"><strong>{selectedIds.length} selected</strong><button type="button" onClick={() => onBulk('archive')}><Archive size={14} />Archive</button><button type="button" onClick={() => onBulk('restore')}><RotateCcw size={14} />Restore</button><button type="button" onClick={() => onBulk('reindex')}><Tags size={14} />Re-index</button><button type="button" onClick={() => onBulk('delete')}><Trash2 size={14} />Delete</button></div>}

      <div className="documents-table" role="table" aria-rowcount={documents.length + 1}>
        <div role="row" className="head"><span role="columnheader" aria-label="Selection" /><span role="columnheader">Document</span><span role="columnheader">Type</span><span role="columnheader">Status</span><span role="columnheader">Owner</span><span role="columnheader">Size</span><span role="columnheader">Version</span></div>
        <div ref={listRef} className="documents-virtual-list" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
          <div style={{ height: virtual.totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${virtual.offsetTop}px)` }}>
              {virtual.items.map((doc) => (
                <article role="row" tabIndex={0} key={doc.id} className={doc.id === activeId ? 'active' : ''} onClick={() => onOpen(doc.id)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(doc.id); }} aria-selected={doc.id === activeId}>
                  <span role="cell"><input aria-label={`Select ${doc.title}`} type="checkbox" checked={selectedIds.includes(doc.id)} onClick={(event) => event.stopPropagation()} onChange={() => onSelect(doc.id)} /></span>
                  <span role="cell"><FileText size={15} /><strong>{doc.title}</strong><em>{doc.tags.join(', ') || 'No tags'} · {new Date(doc.uploadedAt).toLocaleDateString()}</em></span>
                  <span role="cell">{doc.documentType.replace(/_/g, ' ')}</span>
                  <span role="cell" className={`status ${doc.status}`}>{doc.status}</span>
                  <span role="cell">{doc.ownerName}</span>
                  <span role="cell">{readableBytes(doc.sizeBytes)}</span>
                  <span role="cell">v{doc.version}</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
      <footer><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></footer>
    </section>
  );
}
