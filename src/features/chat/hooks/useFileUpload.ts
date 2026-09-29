import { useCallback, useRef, useState } from 'react';
import { mentorChatApi } from '../services/MentorChatApi';
import type { ChatAttachment } from '../types/chat.types';
import { createId } from '../utils/chatStorage';
import { isAcceptedFile } from '../utils/formatting';

export function useFileUpload() {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const aborters = useRef(new Map<string, AbortController>());

  const uploadFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(isAcceptedFile);
    for (const file of list) {
      const id = createId('att');
      const attachment: ChatAttachment = { id, fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, status: 'queued', progress: 0 };
      setAttachments((current) => [...current, attachment]);
      const controller = new AbortController();
      aborters.current.set(id, controller);
      setAttachments((current) => current.map((item) => item.id === id ? { ...item, status: 'uploading', progress: 5 } : item));
      mentorChatApi.uploadDocument(file, (progress) => {
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, progress, status: progress >= 100 ? 'processing' : 'uploading' } : item));
      }, controller.signal).then((result) => {
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, ...result, status: result.documentId ? 'indexed' : 'processing', progress: 100 } : item));
      }).catch((error) => {
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, status: 'failed', error: error instanceof Error ? error.message : 'Upload failed.' } : item));
      }).finally(() => aborters.current.delete(id));
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    aborters.current.get(id)?.abort();
    aborters.current.delete(id);
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }, []);

  const clearAttachments = useCallback(() => setAttachments([]), []);

  return { attachments, uploadFiles, removeAttachment, clearAttachments };
}

