import { AnimatePresence, motion } from 'framer-motion';
import { Edit3, Menu, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChatConversation } from '../types/chat.types';
import { formatTime } from '../utils/chatStorage';
import { classNames } from '../utils/formatting';

export function ChatSidebar({ conversations, activeId, mobileOpen, onMobileOpenChange, onSelect, onCreate, onRename, onDelete, onPin }: {
  conversations: ChatConversation[];
  activeId?: string;
  mobileOpen: boolean;
  onMobileOpenChange(open: boolean): void;
  onSelect(id: string): void;
  onCreate(): void;
  onRename(id: string, title: string): void;
  onDelete(id: string): void;
  onPin(id: string): void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.toLowerCase())), [conversations, query]);
  return (
    <>
      <button className="mentor-mobile-menu" type="button" onClick={() => onMobileOpenChange(true)} aria-label="Open conversations"><Menu size={18} /></button>
      <AnimatePresence>
        {mobileOpen && <motion.div className="mentor-sidebar-backdrop" onClick={() => onMobileOpenChange(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      <aside className={classNames('mentor-sidebar', mobileOpen && 'open')} aria-label="Conversation history">
        <header>
          <div>
            <strong>Bare Act Mentor</strong>
            <span>Legislative drafting studio</span>
          </div>
          <button type="button" onClick={onCreate} aria-label="Create conversation"><Plus size={16} /></button>
          <button className="mentor-sidebar-close" type="button" onClick={() => onMobileOpenChange(false)} aria-label="Close conversations"><X size={16} /></button>
        </header>
        <label className="mentor-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /></label>
        <div className="mentor-lesson-indicator"><span /> Active lesson: Drafting foundations</div>
        <nav>
          {filtered.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === activeId} onSelect={onSelect} onRename={onRename} onDelete={onDelete} onPin={onPin} />
          ))}
        </nav>
      </aside>
    </>
  );
}

function ConversationRow({ conversation, active, onSelect, onRename, onDelete, onPin }: { conversation: ChatConversation; active: boolean; onSelect(id: string): void; onRename(id: string, title: string): void; onDelete(id: string): void; onPin(id: string): void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const save = () => { onRename(conversation.id, title); setEditing(false); };
  return (
    <article className={classNames('mentor-conversation-row', active && 'active')}>
      {editing ? (
        <label className="mentor-conversation-edit">
          <span className="sr-only">Conversation title</span>
          <input value={title} autoFocus onChange={(event) => setTitle(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setEditing(false); }} />
        </label>
      ) : (
        <button type="button" onClick={() => onSelect(conversation.id)}>
          <strong>{conversation.title}</strong>
          <span>{conversation.messages.length} messages · {formatTime(conversation.updatedAt)}</span>
        </button>
      )}
      <div>
        <button type="button" className={conversation.pinned ? 'on' : ''} onClick={() => onPin(conversation.id)} aria-label="Pin conversation"><Pin size={13} /></button>
        <button type="button" onClick={() => setEditing(true)} aria-label="Rename conversation"><Edit3 size={13} /></button>
        <button type="button" onClick={() => onDelete(conversation.id)} aria-label="Delete conversation"><Trash2 size={13} /></button>
      </div>
    </article>
  );
}


