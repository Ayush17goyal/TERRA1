import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function LearningCard({ title, icon, children, action }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <motion.section className="learning-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <header>{icon}<h3>{title}</h3>{action}</header>
      {children}
    </motion.section>
  );
}

export function MetricTile({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <article className="learning-metric"><span>{label}</span><strong>{value}</strong>{detail && <em>{detail}</em>}</article>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return <div className="learning-progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} role="progressbar"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
