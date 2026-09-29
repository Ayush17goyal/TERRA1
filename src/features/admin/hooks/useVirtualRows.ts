import { useMemo } from 'react';

export function useVirtualRows<T>(rows: T[], rowHeight: number, viewportHeight: number, scrollTop: number) {
  return useMemo(() => {
    const overscan = 10;
    const totalHeight = rows.length * rowHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
    return { totalHeight, offsetTop: start * rowHeight, rows: rows.slice(start, end) };
  }, [rowHeight, rows, scrollTop, viewportHeight]);
}
