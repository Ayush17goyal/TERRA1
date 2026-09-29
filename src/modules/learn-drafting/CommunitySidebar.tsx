import { MessageCircle, MessageSquare, Send, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../../lib/api'

const WHATSAPP_LINK = 'https://whatsapp.com/channel/0029Vb8RU1pInlqP1O6tvx3Y'

interface ChatMessage {
  id: string
  userName: string
  text: string
  createdAt: string
}

interface Props {
  apiToken: string
  open: boolean
  onClose: () => void
}

export default function CommunitySidebar({ apiToken, open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Only show messages created after this session started (page load time)
  const sessionStart = useRef(Date.now())

  const fetchMessages = useCallback(async () => {
    if (!apiToken) return
    try {
      const res = await fetch(`${API_BASE_URL}/community/messages`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      })
      if (!res.ok) return
      const data: ChatMessage[] = await res.json()
      // Filter to only messages sent during the current session
      const fresh = data.filter(m => new Date(m.createdAt).getTime() >= sessionStart.current)
      setMessages(fresh)
    } catch {
      // silently ignore during polling
    }
  }, [apiToken])

  useEffect(() => {
    if (!open || !apiToken) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    setMessages([])      // clear stale state so every open shows a fresh load
    fetchMessages()
    pollRef.current = setInterval(fetchMessages, 5000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [open, fetchMessages, apiToken])

  // Refetch when user returns to this browser tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && open && apiToken) fetchMessages()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [open, fetchMessages, apiToken])

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 120)
  }, [messages, open])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/community/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) { setError('Failed to send message.'); return }
      setInput('')
      await fetchMessages()
    } catch {
      setError('Network error.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <aside className={`ld-community-sidebar ${open ? 'ld-community-sidebar--open' : ''}`}>
      {/* Inner wrapper keeps content at fixed 300px so it doesn't squish during animation */}
      <div className="ld-cs-inner">
        {/* Header */}
        <div className="ld-cs-header">
          <div className="ld-cs-header-title">
            <MessageSquare size={15} />
            <span>Community Chat</span>
          </div>
          <button className="ld-cs-close-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Privacy note */}
        <p className="ld-cs-subtitle">
          Only your name is visible — no email or other info shared.
        </p>

        {/* Messages */}
        <div className="ld-cs-messages">
          {messages.length === 0 && (
            <div className="ld-cs-empty">
              <MessageSquare size={28} style={{ opacity: 0.18 }} />
              <p>No messages yet —<br />be the first to ask!</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="ld-cs-msg">
              <div className="ld-cs-msg-top">
                <span className="ld-cs-name">{msg.userName}</span>
                <span className="ld-cs-time">{fmt(msg.createdAt)}</span>
              </div>
              <p className="ld-cs-text">{msg.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && <p className="ld-cs-error">{error}</p>}

        {/* Input */}
        <div className="ld-cs-input-row">
          <textarea
            className="ld-cs-input"
            placeholder="Type a message… (Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            maxLength={1000}
          />
          <button
            className="ld-cs-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </div>

        {/* WhatsApp link */}
        <a
          className="ld-cs-whatsapp-link"
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={14} />
          Join Legatrixon WhatsApp Community
        </a>
      </div>
    </aside>
  )
}
