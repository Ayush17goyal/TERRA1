import { AnimatePresence, motion } from 'framer-motion';
import { Copy, RefreshCw, RotateCcw, UserRound, GraduationCap, AlertTriangle } from 'lucide-react';
import type { ChatMessage } from '../types/chat.types';
import { formatTime } from '../utils/chatStorage';
import { classNames } from '../utils/formatting';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MentorResponseCards } from './MentorResponseCards';

export function MessageBubble({ message, onRetry, onRegenerate }: { message: ChatMessage; onRetry(message: ChatMessage): void; onRegenerate(): void }) {
  const copy = () => void navigator.clipboard?.writeText(message.content);
  const isMentor = message.role === 'mentor';
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={classNames('mentor-message', isMentor ? 'mentor' : 'student', message.status === 'failed' && 'failed')}
      aria-live={message.status === 'streaming' ? 'polite' : undefined}
    >
      <div className="mentor-message-avatar" aria-hidden="true">{isMentor ? <GraduationCap size={18} /> : <UserRound size={18} />}</div>
      <div className="mentor-message-body">
        <header>
          <strong>{isMentor ? 'Drafting Mentor' : 'You'}</strong>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          {message.status === 'streaming' && <span className="mentor-live-dot">Streaming</span>}
        </header>
        {message.error ? (
          <div className="mentor-error-inline"><AlertTriangle size={15} /> {message.error}</div>
        ) : null}
        {message.content ? <MarkdownRenderer content={message.content} citations={message.citations} /> : <TypingIndicator />}
        {isMentor && message.structured && <MentorResponseCards sections={message.structured} />}
        {message.attachments?.length ? (
          <div className="mentor-attachment-strip">
            {message.attachments.map((attachment) => <span key={attachment.id}>{attachment.fileName}</span>)}
          </div>
        ) : null}
        <footer>
          {isMentor && <button type="button" onClick={copy} aria-label="Copy response"><Copy size={14} />Copy</button>}
          {isMentor && message.status === 'failed' && <button type="button" onClick={() => onRetry(message)}><RotateCcw size={14} />Retry</button>}
          {isMentor && message.status === 'complete' && <button type="button" onClick={onRegenerate}><RefreshCw size={14} />Regenerate</button>}
        </footer>
      </div>
    </motion.article>
  );
}

export function TypingIndicator() {
  return (
    <div className="mentor-typing" role="status" aria-label="Mentor is typing">
      <span /> <span /> <span />
    </div>
  );
}

export function MessageList({ messages, isTyping, onRetry, onRegenerate }: { messages: ChatMessage[]; isTyping: boolean; onRetry(message: ChatMessage): void; onRegenerate(): void }) {
  return (
    <AnimatePresence initial={false}>
      {messages.map((message) => <MessageBubble key={message.id} message={message} onRetry={onRetry} onRegenerate={onRegenerate} />)}
      {isTyping && messages[messages.length - 1]?.content && <TypingIndicator />}
    </AnimatePresence>
  );
}

