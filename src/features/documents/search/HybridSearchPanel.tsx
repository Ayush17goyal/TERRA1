import { Search } from 'lucide-react';
import type { DocumentFilters, ManagedDocument } from '../types/document.types';

export function HybridSearchPanel({ filters, results, onFilters }: { filters: DocumentFilters; results: ManagedDocument[]; onFilters(filters: DocumentFilters): void }) {
  return (
    <section className="hybrid-search" aria-label="Hybrid search"><header><Search size={16} /><strong>Hybrid Search</strong></header><label>Query<input value={filters.query} onChange={(event) => onFilters({ ...filters, query: event.target.value })} placeholder="Search statutes, notes, metadata" /></label><div><label><input type="checkbox" checked={filters.semantic} onChange={(event) => onFilters({ ...filters, semantic: event.target.checked })} /> Semantic retrieval mode</label><select aria-label="Sort document search results" value={filters.sortBy} onChange={(event) => onFilters({ ...filters, sortBy: event.target.value as DocumentFilters['sortBy'] })}><option value="relevance">Relevance</option><option value="uploadedAt">Upload date</option><option value="title">Title</option><option value="type">Type</option><option value="status">Status</option></select></div><p>{results.length} matching documents. Results are ranked locally by metadata and text; indexed retrieval is handled by the existing knowledge engine after upload.</p></section>
  );
}
