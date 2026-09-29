import { FileText, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ChatAttachment } from '../types/chat.types';
import { readableBytes } from '../utils/formatting';

export function UploadQueue({ attachments, onRemove }: { attachments: ChatAttachment[]; onRemove(id: string): void }) {
  if (!attachments.length) return null;
  return (
    <div className="mentor-upload-queue" aria-label="Upload queue">
      {attachments.map((attachment) => (
        <div key={attachment.id} className={`mentor-upload-item ${attachment.status}`}>
          <FileText size={16} />
          <div>
            <strong>{attachment.fileName}</strong>
            <span>{readableBytes(attachment.size)} · {attachment.status}</span>
            <div className="mentor-upload-progress"><i style={{ width: `${attachment.progress}%` }} /></div>
            {attachment.error && <em><AlertTriangle size={12} />{attachment.error}</em>}
          </div>
          {attachment.status === 'indexed' ? <CheckCircle2 size={16} /> : attachment.status === 'uploading' || attachment.status === 'processing' ? <Loader2 size={16} className="spin" /> : null}
          <button type="button" onClick={() => onRemove(attachment.id)} aria-label={`Remove ${attachment.fileName}`}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

