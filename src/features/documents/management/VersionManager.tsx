import { GitCompareArrows, RotateCcw, Upload } from 'lucide-react';
import type { ManagedDocument } from '../types/document.types';
import { readableBytes } from '../utils/documentUtils';

export function VersionManager({ document, onUploadVersion, onRestore }: { document?: ManagedDocument; onUploadVersion(id: string, file: File): void; onRestore(id: string, versionId: string): void }) {
  if (!document) return <section className="version-manager"><strong>Versions</strong><p>No document selected.</p></section>;
  return (
    <section className="version-manager" aria-label="Version management"><header><strong><GitCompareArrows size={15} />Versions</strong><label><Upload size={14} />New version<input type="file" hidden accept=".pdf,.docx,.txt,.md,.markdown" onChange={(event) => event.target.files?.[0] && onUploadVersion(document.id, event.target.files[0])} /></label></header>{document.versions.map((version) => <article key={version.id}><div><strong>v{version.version} · {version.fileName}</strong><span>{readableBytes(version.sizeBytes)} · {new Date(version.uploadedAt).toLocaleString()}</span><p>{version.changeSummary}</p></div><button type="button" onClick={() => onRestore(document.id, version.id)}><RotateCcw size={13} />Restore</button></article>)}</section>
  );
}
