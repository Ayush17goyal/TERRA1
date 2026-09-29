import type { ManagedDocument } from '../types/document.types';

const KEY = 'legatrixon.bare-act-documents.library.v1';

export function loadDocumentLibrary(): ManagedDocument[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) as ManagedDocument[] : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDocumentLibrary(documents: ManagedDocument[]): void {
  const serializable = documents.map((doc) => ({ ...doc, objectUrl: undefined }));
  localStorage.setItem(KEY, JSON.stringify(serializable));
}
