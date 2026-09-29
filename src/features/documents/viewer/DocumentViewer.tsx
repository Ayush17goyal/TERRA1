import ReactMarkdown from 'react-markdown';
import { Bookmark, ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ManagedDocument } from '../types/document.types';

export function DocumentViewer({ document, onBookmark }: { document?: ManagedDocument; onBookmark(documentId: string, bookmark: string): void }) {
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const content = useMemo(() => highlight(document?.textContent ?? '', query), [document?.textContent, query]);
  if (!document) return <section className="documents-viewer empty"><strong>No document selected</strong><p>Upload or select a document to inspect it.</p></section>;
  return (
    <section className="documents-viewer" aria-label="Document viewer">
      <header><div><strong>{document.title}</strong><span>{document.fileKind.toUpperCase()} · {document.status}</span></div><label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find in document" /></label><button type="button" onClick={() => setZoom(Math.max(60, zoom - 10))}><ZoomOut size={14} /></button><span>{zoom}%</span><button type="button" onClick={() => setZoom(Math.min(180, zoom + 10))}><ZoomIn size={14} /></button><button type="button" onClick={() => onBookmark(document.id, `Bookmark ${document.bookmarks.length + 1}`)}><Bookmark size={14} />Bookmark</button></header>
      <div className="documents-viewer-body" style={{ fontSize: `${zoom}%` }}>{document.fileKind === 'pdf' && document.objectUrl ? <object data={document.objectUrl} type="application/pdf" aria-label={document.title}><p>PDF preview unavailable. Use download from your browser.</p></object> : document.fileKind === 'markdown' ? <ReactMarkdown>{document.textContent || 'No extracted text available yet.'}</ReactMarkdown> : <pre dangerouslySetInnerHTML={{ __html: content || 'No extracted text available yet.' }} />}</div>
      <footer><button type="button" onClick={() => setPage(Math.max(1, page - 1))}><ChevronLeft size={14} />Prev</button><span>Page {page}{document.pageCount ? ` of ${document.pageCount}` : ''}</span><button type="button" onClick={() => setPage(page + 1)}>Next<ChevronRight size={14} /></button></footer>
    </section>
  );
}

function highlight(text: string, query: string): string {
  const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
  if (!query.trim()) return escape(text);
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escape(text).replace(new RegExp(safe, 'gi'), (match) => `<mark>${match}</mark>`);
}
