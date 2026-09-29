import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mentorChatApi } from '../services/MentorChatApi';
import type { ChatAttachment, ChatConversation, ChatMessage, MentorChatRequest, WorkflowStage } from '../types/chat.types';
import { createId, detectStructuredSections, loadConversations, makeConversation, makeMessage, nowIso, saveConversations, titleFromMessage } from '../utils/chatStorage';

export function useChatStore() {
  const [conversations, setConversations] = useState<ChatConversation[]>(() => {
    const loaded = loadConversations();
    return loaded.length ? loaded : [makeConversation('Bare Act Drafting Mentor')];
  });
  const [activeConversationId, setActiveConversationId] = useState(() => conversations[0]?.id ?? makeConversation().id);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowStage | undefined>();
  const [isTyping, setIsTyping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<{ conversationId: string; messageId: string; text: string } | null>(null);
  const streamFrameRef = useRef<number | null>(null);

  useEffect(() => saveConversations(conversations), [conversations]);

  const activeConversation = useMemo(() => conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0], [activeConversationId, conversations]);

  const updateConversations = useCallback((updater: (current: ChatConversation[]) => ChatConversation[]) => {
    setConversations((current) => updater(current).map((conversation) => ({ ...conversation, updatedAt: conversation.updatedAt ?? nowIso() })));
  }, []);

  const patchMessage = useCallback((conversationId: string, messageId: string, patch: Partial<ChatMessage> | ((message: ChatMessage) => Partial<ChatMessage>)) => {
    updateConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      return {
        ...conversation,
        updatedAt: nowIso(),
        messages: conversation.messages.map((message) => {
          if (message.id !== messageId) return message;
          const resolved = typeof patch === 'function' ? patch(message) : patch;
          return { ...message, ...resolved, updatedAt: nowIso() };
        }),
      };
    }));
  }, [updateConversations]);


  const flushStreamBuffer = useCallback(() => {
    const buffered = streamBufferRef.current;
    streamBufferRef.current = null;
    streamFrameRef.current = null;
    if (!buffered?.text) return;
    patchMessage(buffered.conversationId, buffered.messageId, (message) => ({ content: message.content + buffered.text }));
  }, [patchMessage]);

  const appendStreamDelta = useCallback((conversationId: string, messageId: string, delta: string) => {
    if (!delta) return;
    const current = streamBufferRef.current;
    streamBufferRef.current = current && current.conversationId === conversationId && current.messageId === messageId
      ? { ...current, text: current.text + delta }
      : { conversationId, messageId, text: delta };
    if (streamFrameRef.current !== null) return;
    streamFrameRef.current = window.requestAnimationFrame(flushStreamBuffer);
  }, [flushStreamBuffer]);

  const appendMessages = useCallback((conversationId: string, messages: ChatMessage[]) => {
    updateConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      const title = conversation.messages.length === 0 && messages[0]?.role === 'student' ? titleFromMessage(messages[0].content) : conversation.title;
      return { ...conversation, title, updatedAt: nowIso(), messages: [...conversation.messages, ...messages] };
    }));
  }, [updateConversations]);

  const createConversation = useCallback(() => {
    const conversation = makeConversation();
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    return conversation.id;
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    updateConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, title: title.trim() || conversation.title, updatedAt: nowIso() } : conversation));
  }, [updateConversations]);

  const deleteConversation = useCallback((id: string) => {
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== id);
      if (activeConversationId === id) setActiveConversationId(next[0]?.id ?? createConversation());
      return next.length ? next : [makeConversation()];
    });
  }, [activeConversationId, createConversation]);

  const pinConversation = useCallback((id: string) => {
    updateConversations((current) => current.map((conversation) => conversation.id === id ? { ...conversation, pinned: !conversation.pinned, updatedAt: nowIso() } : conversation));
  }, [updateConversations]);

  const sendMessage = useCallback(async (content: string, attachments: ChatAttachment[] = []) => {
    const conversationId = activeConversation?.id ?? createConversation();
    const student = makeMessage({ conversationId, role: 'student', content, attachments, status: 'complete' });
    const mentor = makeMessage({ conversationId, role: 'mentor', content: '', status: 'streaming' });
    appendMessages(conversationId, [student, mentor]);
    setStreamingMessageId(mentor.id);
    setIsTyping(true);
    setWorkflowState('PENDING');

    const request: MentorChatRequest = { message: content, conversationId, attachments, studentLevel: 'beginner' };
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let completed = false;
      for await (const event of mentorChatApi.streamMessage(request, controller.signal)) {
        if (event.event === 'state') {
          setWorkflowState(event.data.state);
          patchMessage(conversationId, mentor.id, { workflow: event.data.state });
        }
        if (event.event === 'text') {
          setIsTyping(false);
          const delta = event.data.delta ?? '';
          appendStreamDelta(conversationId, mentor.id, delta);
        }
        if (event.event === 'validation') {
          patchMessage(conversationId, mentor.id, { structured: undefined });
        }
        if (event.event === 'completion') {
          completed = true;
          const text = event.data.text || event.data.response?.text;
          patchMessage(conversationId, mentor.id, (message) => {
            const contentText = text || message.content;
            return { content: contentText, status: 'complete', structured: event.data.structured ?? detectStructuredSections(contentText), workflow: 'COMPLETED' };
          });
          setWorkflowState('COMPLETED');
        }
        if (event.event === 'error') throw new Error(event.data.message || 'Streaming failed.');
        if (event.event === 'cancelled') throw new DOMException('Generation stopped.', 'AbortError');
      }
      if (!completed) {
        flushStreamBuffer();
        patchMessage(conversationId, mentor.id, (message) => ({ status: 'complete', structured: detectStructuredSections(message.content), workflow: 'COMPLETED' }));
        setWorkflowState('COMPLETED');
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      flushStreamBuffer();
      patchMessage(conversationId, mentor.id, { status: aborted ? 'cancelled' : 'failed', error: aborted ? 'Generation stopped.' : error instanceof Error ? error.message : 'Message failed.', workflow: aborted ? 'CANCELLED' : 'FAILED' });
      setWorkflowState(aborted ? 'CANCELLED' : 'FAILED');
    } finally {
      setIsTyping(false);
      setStreamingMessageId(null);
      abortRef.current = null;
    }
  }, [activeConversation?.id, appendMessages, appendStreamDelta, createConversation, flushStreamBuffer, patchMessage]);

  const stopGeneration = useCallback(() => abortRef.current?.abort(), []);

  const retryMessage = useCallback((message: ChatMessage) => {
    const conversation = conversations.find((item) => item.id === message.conversationId);
    const failedIndex = conversation?.messages.findIndex((item) => item.id === message.id) ?? -1;
    const previousStudent = failedIndex > 0 ? conversation?.messages.slice(0, failedIndex).reverse().find((item) => item.role === 'student') : undefined;
    if (previousStudent) void sendMessage(previousStudent.content, previousStudent.attachments ?? []);
  }, [conversations, sendMessage]);

  const regenerateResponse = useCallback(() => {
    const lastStudent = activeConversation?.messages.slice().reverse().find((message) => message.role === 'student');
    if (lastStudent) void sendMessage(lastStudent.content, lastStudent.attachments ?? []);
  }, [activeConversation?.messages, sendMessage]);

  return {
    conversations: conversations.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    renameConversation,
    deleteConversation,
    pinConversation,
    sendMessage,
    stopGeneration,
    retryMessage,
    regenerateResponse,
    streamingMessageId,
    workflowState,
    isTyping,
  };
}

