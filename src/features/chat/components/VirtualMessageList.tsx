import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types/chat.types';
import { useVirtualMessages } from '../hooks/useVirtualMessages';
import { EmptyState } from './EmptyState';
import { MessageBubble } from './MessageBubble';

export function VirtualMessageList({ messages, isTyping, onPrompt, onRetry, onRegenerate }: { messages: ChatMessage[]; isTyping: boolean; onPrompt(prompt: string): void; onRetry(message: ChatMessage): void; onRegenerate(): void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(720);
  const virtual = useVirtualMessages(messages, scrollTop, height);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (!messages.length) return <div className="mentor-message-scroll"><EmptyState onPrompt={onPrompt} /></div>;

  return (
    <div className="mentor-message-scroll" ref={containerRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      <div style={{ height: virtual.totalHeight || undefined, position: 'relative' }}>
        <div style={{ transform: `translateY(${virtual.offsetTop}px)` }} className="mentor-message-stack">
          {virtual.visibleMessages.map((message) => <MessageBubble key={message.id} message={message} onRetry={onRetry} onRegenerate={onRegenerate} />)}
          {isTyping && <div className="mentor-stream-skeleton"><span /><span /><span /></div>}
        </div>
      </div>
    </div>
  );
}

