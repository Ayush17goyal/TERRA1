import { UploadCloud, XCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { UploadJob } from '../types/document.types';
import { readableBytes } from '../utils/documentUtils';

export function UploadCenter({ jobs, onUpload, onRetry }: { jobs: UploadJob[]; onUpload(files: FileList | File[]): void; onRetry(jobId: string): void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <section className={`documents-upload-center ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onUpload(event.dataTransfer.files); }} aria-label="Upload center">
      <label className="documents-dropzone"><UploadCloud size={28} /><strong>Upload legal documents</strong><span>PDF, DOCX, TXT, Markdown. Existing document pipeline handles extraction, indexing, and embeddings.</span><input type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown" onChange={(event) => event.target.files && onUpload(event.target.files)} /></label>
      <div className="documents-upload-jobs">{jobs.map((job) => <article key={job.id}><header>{job.status === 'failed' ? <XCircle size={16} /> : job.status === 'indexed' ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="spin" />}<strong>{job.fileName}</strong><span>{readableBytes(job.sizeBytes)}</span></header><div className="documents-progress"><i style={{ width: `${job.progress}%` }} /></div><p>{job.status}{job.checksum ? ` · checksum ${job.checksum.slice(0, 10)}` : ''}{job.duplicateOf ? ` · duplicate of ${job.duplicateOf}` : ''}</p>{job.error && <em>{job.error}</em>}{job.status === 'failed' && <button type="button" onClick={() => onRetry(job.id)} disabled={!job.file}><RefreshCw size={13} />Retry upload</button>}</article>)}</div>
    </section>
  );
}
