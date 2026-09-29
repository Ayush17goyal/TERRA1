import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { documentManagementApi } from '../services/DocumentManagementApi';
import type { DocumentFilters, DocumentTelemetryEvent, ManagedDocument, UploadJob } from '../types/document.types';
import { acceptedDocument, checksum, detectFileKind, extractBareActStructure, inferDocumentType, nowIso, uid } from '../utils/documentUtils';
import { loadDocumentLibrary, saveDocumentLibrary } from './documentPersistence';

const defaultFilters: DocumentFilters = { query: '', documentType: 'all', status: 'all', category: 'all', tag: 'all', semantic: false, sortBy: 'uploadedAt', sortDirection: 'desc' };

export function useDocumentManagement() {
  const [documents, setDocuments] = useState<ManagedDocument[]>(loadDocumentLibrary);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | undefined>();
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [events, setEvents] = useState<DocumentTelemetryEvent[]>([]);
  const [filters, setFilters] = useState<DocumentFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const aborters = useRef(new Map<string, AbortController>());

  useEffect(() => saveDocumentLibrary(documents), [documents]);

  const activeDocument = useMemo(() => documents.find((doc) => doc.id === activeDocumentId) ?? documents[0], [activeDocumentId, documents]);
  const filteredDocuments = useMemo(() => filterDocuments(documents, filters), [documents, filters]);
  const pageSize = 12;
  const pagedDocuments = useMemo(() => filteredDocuments.slice((page - 1) * pageSize, page * pageSize), [filteredDocuments, page]);

  const addEvent = useCallback((message: string, status: DocumentTelemetryEvent['status'], documentId?: string) => {
    setEvents((current) => [{ id: uid('event'), message, status, documentId, createdAt: nowIso() }, ...current].slice(0, 100));
  }, []);

  const uploadFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).filter(acceptedDocument).forEach(async (file) => {
      const jobId = uid('upload');
      const controller = new AbortController();
      aborters.current.set(jobId, controller);
      setJobs((current) => [{ id: jobId, file, fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, progress: 1, status: 'queued' }, ...current]);
      try {
        updateJob(setJobs, jobId, { status: 'validating', progress: 8 });
        const hash = await checksum(file);
        const duplicate = documents.find((doc) => doc.checksum === hash && !doc.archived);
        if (duplicate) {
          updateJob(setJobs, jobId, { status: 'duplicate', progress: 100, checksum: hash, duplicateOf: duplicate.id });
          addEvent(`Duplicate detected for ${file.name}`, 'duplicate', duplicate.id);
          return;
        }
        const textContent = await readableText(file);
        const objectUrl = URL.createObjectURL(file);
        const fileKind = detectFileKind(file.name, file.type);
        const documentType = inferDocumentType(file.name);
        updateJob(setJobs, jobId, { status: 'uploading', progress: 15, checksum: hash });
        const uploaded = await documentManagementApi.upload(file, documentType, (progress) => updateJob(setJobs, jobId, { progress, status: progress > 70 ? 'processing' : 'uploading' }), controller.signal);
        const structure = documentType === 'bare_act' ? extractBareActStructure(textContent) : [];
        const now = nowIso();
        const document: ManagedDocument = {
          id: uploaded.documentId,
          title: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          fileKind,
          mimeType: file.type || 'application/octet-stream',
          documentType,
          ownerId: 'current-user',
          ownerName: 'Current student',
          tags: documentType === 'bare_act' ? ['bare-act', 'indexed'] : ['uploaded'],
          category: documentType === 'bare_act' ? 'Bare Acts' : 'Course Materials',
          visibility: 'private',
          sizeBytes: file.size,
          version: 1,
          status: 'indexed',
          indexingStatus: 'indexed',
          uploadedAt: now,
          updatedAt: now,
          checksum: hash,
          objectUrl,
          textContent,
          bookmarks: [],
          bareActStructure: structure,
          analysis: {
            classification: documentType,
            confidence: documentType === 'unknown' ? 0.48 : 0.86,
            extractedPatterns: structure.map((node) => node.type).filter((value, index, array) => array.indexOf(value) === index).slice(0, 12),
            indexedChunks: Math.max(1, Math.ceil((textContent.length || file.size) / 1800)),
            draftingComponents: structure.map((node) => node.label).slice(0, 12),
            processingSummary: `${file.name} uploaded, classified as ${documentType.replace(/_/g, ' ')}, and submitted to the existing document indexing pipeline.`,
            errors: [],
          },
          versions: [{ id: uid('version'), version: 1, fileName: file.name, uploadedAt: now, sizeBytes: file.size, checksum: hash, changeSummary: 'Initial upload', textPreview: textContent.slice(0, 1000) }],
        };
        setDocuments((current) => [document, ...current]);
        setActiveDocumentId(document.id);
        updateJob(setJobs, jobId, { status: 'indexed', progress: 100, documentId: document.id });
        addEvent(`${file.name} indexed successfully`, 'indexed', document.id);
        documentManagementApi.analyseBareAct(document).then((analysis) => {
          if (Object.keys(analysis).length) setDocuments((current) => current.map((doc) => doc.id === document.id ? { ...doc, analysis: { ...doc.analysis, ...analysis }, updatedAt: nowIso() } : doc));
        }).catch(() => undefined);
      } catch (error) {
        updateJob(setJobs, jobId, { status: 'failed', error: error instanceof Error ? error.message : 'Upload failed' });
        addEvent(`Upload failed for ${file.name}`, 'failed');
      } finally {
        aborters.current.delete(jobId);
      }
    });
  }, [addEvent, documents]);

  const retryUpload = useCallback((jobId: string) => {
    const job = jobs.find((item) => item.id === jobId);
    if (job?.file) uploadFiles([job.file]);
  }, [jobs, uploadFiles]);

  const updateMetadata = useCallback((id: string, patch: Partial<ManagedDocument>) => setDocuments((current) => current.map((doc) => doc.id === id ? { ...doc, ...patch, updatedAt: nowIso() } : doc)), []);
  const toggleSelect = useCallback((id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]), []);
  const clearSelection = useCallback(() => setSelectedIds([]), []);
  const bulk = useCallback((action: 'archive' | 'restore' | 'delete' | 'reindex', payload?: { tag?: string; category?: string }) => {
    setDocuments((current) => {
      if (action === 'delete') return current.filter((doc) => !selectedIds.includes(doc.id));
      return current.map((doc) => selectedIds.includes(doc.id) ? applyBulk(doc, action, payload) : doc);
    });
    selectedIds.forEach((id) => addEvent(`Bulk ${action} requested`, action === 'reindex' ? 'indexing' : 'processing', id));
    setSelectedIds([]);
  }, [addEvent, selectedIds]);

  const addVersion = useCallback((id: string, file: File) => {
    readableText(file).then((text) => setDocuments((current) => current.map((doc) => {
      if (doc.id !== id) return doc;
      const version = doc.version + 1;
      return { ...doc, version, fileName: file.name, sizeBytes: file.size, objectUrl: URL.createObjectURL(file), textContent: text, updatedAt: nowIso(), versions: [{ id: uid('version'), version, fileName: file.name, uploadedAt: nowIso(), sizeBytes: file.size, changeSummary: `Uploaded version ${version}`, textPreview: text.slice(0, 1000) }, ...doc.versions] };
    })));
  }, []);

  const restoreVersion = useCallback((id: string, versionId: string) => setDocuments((current) => current.map((doc) => {
    const version = doc.versions.find((item) => item.id === versionId);
    return doc.id === id && version ? { ...doc, version: version.version, fileName: version.fileName, textContent: version.textPreview ?? doc.textContent, updatedAt: nowIso() } : doc;
  })), []);

  const toggleBookmark = useCallback((id: string, bookmark: string) => setDocuments((current) => current.map((doc) => doc.id === id ? { ...doc, bookmarks: doc.bookmarks.includes(bookmark) ? doc.bookmarks.filter((item) => item !== bookmark) : [...doc.bookmarks, bookmark] } : doc)), []);

  return { documents, filteredDocuments, pagedDocuments, page, setPage, pageSize, selectedIds, activeDocument, activeDocumentId, setActiveDocumentId, jobs, events, filters, setFilters, uploadFiles, retryUpload, updateMetadata, toggleSelect, clearSelection, bulk, addVersion, restoreVersion, toggleBookmark };
}

function updateJob(setJobs: React.Dispatch<React.SetStateAction<UploadJob[]>>, id: string, patch: Partial<UploadJob>) {
  setJobs((current) => current.map((job) => job.id === id ? { ...job, ...patch } : job));
}

async function readableText(file: File): Promise<string> {
  if (file.type.includes('text') || /\.(txt|md|markdown)$/i.test(file.name)) return file.text();
  return '';
}

function filterDocuments(documents: ManagedDocument[], filters: DocumentFilters): ManagedDocument[] {
  const query = filters.query.toLowerCase().trim();
  return documents.filter((doc) => {
    if (doc.archived && filters.status !== 'archived') return false;
    if (filters.documentType !== 'all' && doc.documentType !== filters.documentType) return false;
    if (filters.status !== 'all' && doc.status !== filters.status) return false;
    if (filters.category !== 'all' && doc.category !== filters.category) return false;
    if (filters.tag !== 'all' && !doc.tags.includes(filters.tag)) return false;
    if (filters.moduleId && doc.moduleId !== filters.moduleId) return false;
    if (filters.lessonId && doc.lessonId !== filters.lessonId) return false;
    if (!query) return true;
    const haystack = `${doc.title} ${doc.description ?? ''} ${doc.fileName} ${doc.tags.join(' ')} ${doc.category} ${doc.analysis.extractedPatterns.join(' ')} ${doc.textContent?.slice(0, 4000) ?? ''}`.toLowerCase();
    return haystack.includes(query);
  }).sort((a, b) => compareDocuments(a, b, filters));
}

function compareDocuments(a: ManagedDocument, b: ManagedDocument, filters: DocumentFilters): number {
  const direction = filters.sortDirection === 'asc' ? 1 : -1;
  if (filters.sortBy === 'title') return a.title.localeCompare(b.title) * direction;
  if (filters.sortBy === 'type') return a.documentType.localeCompare(b.documentType) * direction;
  if (filters.sortBy === 'status') return a.status.localeCompare(b.status) * direction;
  if (filters.sortBy === 'size') return (a.sizeBytes - b.sizeBytes) * direction;
  return (new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()) * direction;
}

function applyBulk(doc: ManagedDocument, action: 'archive' | 'restore' | 'reindex', payload?: { tag?: string; category?: string }): ManagedDocument {
  if (action === 'archive') return { ...doc, archived: true, status: 'archived', updatedAt: nowIso() };
  if (action === 'restore') return { ...doc, archived: false, status: 'indexed', updatedAt: nowIso() };
  if (action === 'reindex') return { ...doc, indexingStatus: 'indexing', updatedAt: nowIso(), tags: payload?.tag ? [...new Set([...doc.tags, payload.tag])] : doc.tags, category: payload?.category ?? doc.category };
  return doc;
}

