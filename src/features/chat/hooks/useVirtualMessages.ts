import { useMemo } from 'react';
import type { ChatMessage } from '../types/chat.types';

export function useVirtualMessages(messages: ChatMessage[], scrollTop: number, viewportHeight: number) {
  return useMemo(() => {
    const rowHeight = 172;
    const overscan = 8;
    const totalHeight = messages.length * rowHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(messages.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
    return {
      totalHeight,
      offsetTop: start * rowHeight,
      visibleMessages: messages.slice(start, end),
      start,
      end,
    };
  }, [messages, scrollTop, viewportHeight]);
}

