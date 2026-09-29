import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useVirtualRows } from '../hooks/useVirtualRows';

export function StatCard({ label, value, unit, state, trend }: { label: string; value: string | number; unit?: string; state?: string; trend?: number }) {
  return <article className={`bam-stat ${state ?? ''}`}><span>{label}</span><strong>{value}{unit ? <em>{unit}</em> : null}</strong>{typeof trend === 'number' && <small>{trend >= 0 ? '+' : ''}{trend}</small>}</article>;
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="bam-panel"><header><strong>{title}</strong>{action}</header>{children}</section>;
}

export function VirtualTable<T extends { id: string }>({ rows, columns, rowHeight = 58, empty = 'No records available.' }: { rows: T[]; rowHeight?: number; empty?: string; columns: Array<{ key: string; label: string; render(row: T): ReactNode }> }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(420);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height || 420));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const virtual = useVirtualRows(rows, rowHeight, height, scrollTop);
  if (!rows.length) return <p className="bam-empty">{empty}</p>;
  return (
    <div className="bam-table" role="table">
      <div className="bam-table-head" role="row">{columns.map((column) => <span key={column.key} role="columnheader">{column.label}</span>)}</div>
      <div ref={ref} className="bam-table-body" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
        <div style={{ height: virtual.totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${virtual.offsetTop}px)` }}>
            {virtual.rows.map((row) => <div key={row.id} className="bam-table-row" role="row" style={{ minHeight: rowHeight }}>{columns.map((column) => <span key={column.key} role="cell">{column.render(row)}</span>)}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
