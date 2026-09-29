import { motion } from 'framer-motion';
import { Paperclip, Send, Square, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ChatAttachment } from '../types/chat.types';
import { classNames } from '../utils/formatting';
import { UploadQueue } from './UploadQueue';

export function StudentMessageComposer({ disabled, streaming, attachments, onUpload, onRemoveAttachment, onSend, onStop }: {
  disabled: boolean;
  streaming: boolean;
  attachments: ChatAttachment[];
  onUpload(files: FileList | File[]): void;
  onRemoveAttachment(id: string): void;
  onSend(message: string): void;
  onStop(): void;
}) {
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const textArea = useRef<HTMLTextAreaElement | null>(null);
  const canSend = message.trim().length > 0 && !disabled;

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(message.trim());
    setMessage('');
    requestAnimationFrame(() => textArea.current?.focus());
  }, [canSend, message, onSend]);

  return (
    <form className={classNames('mentor-composer', dragging && 'dragging')} onSubmit={(event) => { event.preventDefault(); submit(); }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onUpload(event.dataTransfer.files); }}>
      <UploadQueue attachments={attachments} onRemove={onRemoveAttachment} />
      <div className="mentor-drop-hint"><Upload size={15} /> Drop Bare Acts, drafts, rubrics, or notes here</div>
      <label className="sr-only" htmlFor="mentor-message-input">Message to Bare Act Drafting Mentor</label>
      <textarea
        id="mentor-message-input"
        ref={textArea}
        value={message}
        disabled={disabled}
        rows={1}
        maxLength={8000}
        placeholder="Ask the mentor to explain, review, or guide your legislative drafting attempt..."
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="mentor-composer-actions">
        <span>{message.length}/8000</span>
        <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown" hidden onChange={(event) => event.target.files && onUpload(event.target.files)} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={disabled} aria-label="Attach document"><Paperclip size={16} /></button>
        {streaming ? (
          <motion.button whileTap={{ scale: 0.96 }} className="danger" type="button" onClick={onStop}><Square size={15} />Stop</motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.96 }} className="primary" type="submit" disabled={!canSend}><Send size={15} />Send</motion.button>
        )}
      </div>
    </form>
  );
}

