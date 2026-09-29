import { motion } from 'framer-motion';
import { BookOpenCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ChatSidebar } from '../components/ChatSidebar';
import { StudentMessageComposer } from '../components/StudentMessageComposer';
import { VirtualMessageList } from '../components/VirtualMessageList';
import { WorkflowStatus } from '../components/WorkflowStatus';
import { useFileUpload } from '../hooks/useFileUpload';
import { useChatStore } from '../store/useChatStore';
import './MentorChatPage.css';

export default function MentorChatPage() {
  const chat = useChatStore();
  const uploads = useFileUpload();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const streaming = Boolean(chat.streamingMessageId);

  const send = (message: string) => {
    const readyAttachments = uploads.attachments.filter((attachment) => attachment.status === 'indexed' || attachment.status === 'processing');
    void chat.sendMessage(message, readyAttachments);
    uploads.clearAttachments();
  };

  return (
    <div className="mentor-chat-page">
      <ChatSidebar
        conversations={chat.conversations}
        activeId={chat.activeConversation?.id}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
        onSelect={(id) => { chat.setActiveConversationId(id); setMobileSidebarOpen(false); }}
        onCreate={chat.createConversation}
        onRename={chat.renameConversation}
        onDelete={chat.deleteConversation}
        onPin={chat.pinConversation}
      />
      <main className="mentor-chat-main">
        <header className="mentor-chat-header">
          <div>
            <span><BookOpenCheck size={16} /> Legislative Drafting Professor</span>
            <h1>{chat.activeConversation?.title || 'Bare Act Drafting Mentor'}</h1>
          </div>
          <div className="mentor-header-actions">
            <span className="mentor-integrity-badge"><ShieldCheck size={14} /> Authorship preserved</span>
            <button type="button" onClick={chat.regenerateResponse} disabled={streaming || !chat.activeConversation?.messages.length}><RefreshCw size={15} />Regenerate</button>
          </div>
        </header>
        <WorkflowStatus state={chat.workflowState} />
        <motion.section className="mentor-chat-surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <VirtualMessageList
            messages={chat.activeConversation?.messages ?? []}
            isTyping={chat.isTyping}
            onPrompt={(prompt) => void chat.sendMessage(prompt, [])}
            onRetry={chat.retryMessage}
            onRegenerate={chat.regenerateResponse}
          />
          <StudentMessageComposer
            disabled={streaming}
            streaming={streaming}
            attachments={uploads.attachments}
            onUpload={uploads.uploadFiles}
            onRemoveAttachment={uploads.removeAttachment}
            onSend={send}
            onStop={chat.stopGeneration}
          />
        </motion.section>
      </main>
    </div>
  );
}


