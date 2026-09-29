import { useMemo } from 'react';
import type { ManagedDocument } from '../types/document.types';

export function useVirtualDocuments(documents: ManagedDocument[], rowHeight: number, viewportHeight: number, scrollTop: number) {
  return useMemo(() => {
    const overscan = 8;
    const totalHeight = documents.length * rowHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(documents.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
    return { totalHeight, offsetTop: start * rowHeight, items: documents.slice(start, end) };
  }, [documents, rowHeight, scrollTop, viewportHeight]);
}
