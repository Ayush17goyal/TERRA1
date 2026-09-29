import type { ChatConversation, ChatMessage, MentorStructuredSection } from '../types/chat.types';

export const CHAT_STORAGE_KEY = 'legatrixon.bare-act-mentor.conversations.v1';

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New drafting session';
  return clean.length > 48 ? `${clean.slice(0, 45)}...` : clean;
}

export function loadConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatConversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: ChatConversation[]): void {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conversations.slice(0, 60)));
}

export function makeConversation(title = 'New drafting session'): ChatConversation {
  const at = nowIso();
  return { id: createId('conv'), title, createdAt: at, updatedAt: at, pinned: false, messages: [] };
}

export function makeMessage(input: Omit<ChatMessage, 'id' | 'createdAt' | 'status'> & Partial<Pick<ChatMessage, 'id' | 'createdAt' | 'status'>>): ChatMessage {
  const at = input.createdAt ?? nowIso();
  return { ...input, id: input.id ?? createId('msg'), createdAt: at, status: input.status ?? 'complete' };
}

export function detectStructuredSections(text: string): MentorStructuredSection[] {
  const sections: MentorStructuredSection[] = [];
  const headingRegex = /(?:^|\n)(#{1,3}\s*)?(Learning objective|Strengths|Weaknesses|Drafting issues|Suggested improvements|Reflection questions|Next action|Assessment feedback|Capstone review|Bare Act analysis|Revision guidance|Quiz)(?:\s*:)?\s*\n/gi;
  const matches = [...text.matchAll(headingRegex)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = match[2].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;
    const content = text.slice(start, end).trim();
    if (!content) continue;
    sections.push({ kind: kindFromTitle(title), title, content, items: extractListItems(content) });
  }
  return sections;
}

export function extractListItems(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => /^[-*]\s+|^\d+[.)]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+|^\d+[.)]\s+/, '').trim());
}

function kindFromTitle(title: string): MentorStructuredSection['kind'] {
  const key = title.toLowerCase();
  if (key.includes('learning objective')) return 'learning_objective';
  if (key.includes('reflection')) return 'reflection_questions';
  if (key.includes('next action')) return 'next_action';
  if (key.includes('assessment')) return 'assessment_feedback';
  if (key.includes('capstone')) return 'capstone_review';
  if (key.includes('bare act')) return 'bare_act_analysis';
  if (key.includes('revision')) return 'revision_guidance';
  if (key.includes('quiz')) return 'quiz';
  if (key.includes('strength') || key.includes('weakness') || key.includes('drafting issue') || key.includes('suggested')) return 'draft_review';
  return 'explanation';
}

