import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { DocumentTelemetryEvent, ProcessingMetric, UploadJob } from '../types/document.types';

export function ProcessingMonitor({ jobs, events }: { jobs: UploadJob[]; events: DocumentTelemetryEvent[] }) {
  const metrics: ProcessingMetric[] = [
    { label: 'Upload queue', value: jobs.filter((job) => job.status === 'queued' || job.status === 'uploading').length, status: 'healthy' },
    { label: 'Indexing queue', value: jobs.filter((job) => job.status === 'processing' || job.status === 'indexing').length, status: 'warning' },
    { label: 'Failures', value: jobs.filter((job) => job.status === 'failed').length, status: jobs.some((job) => job.status === 'failed') ? 'error' : 'healthy' },
  ];
  return <section className="processing-monitor" aria-label="Processing monitor"><header><Activity size={16} /><strong>Processing Monitor</strong></header><div className="processing-metrics">{metrics.map((metric) => <article key={metric.label} className={metric.status}><strong>{metric.value}</strong><span>{metric.label}</span></article>)}</div><div className="processing-events">{events.map((event) => <article key={event.id}>{event.status === 'failed' ? <AlertTriangle size={14} /> : event.status === 'indexed' ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="spin" />}<span>{event.message}</span><em>{new Date(event.createdAt).toLocaleTimeString()}</em></article>)}</div></section>;
}
