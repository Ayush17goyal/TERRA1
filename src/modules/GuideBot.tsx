import { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Bot, Sparkles, AlertCircle, Minimize2, X, MessageSquare, Mic, MicOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@clerk/clerk-react';
import { API_BASE_URL } from '../lib/api';
import { VoicePoweredOrb } from '@/components/ui/voice-powered-orb';
import { VoiceProvider, useVoice } from '@/context/VoiceProvider';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useVoiceActivity } from '@/hooks/useVoiceActivity';
import { useTTS } from '@/hooks/useTTS';
import { motion, AnimatePresence } from 'framer-motion';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

const SUGGESTIONS = [
  { label: 'How do I use LEGATRIXON?', query: 'How do I use LEGATRIXON?' },
  { label: 'Which AI should I use?', query: 'Which AI should I use?' },
  { label: 'Explain platform features', query: 'Explain platform features' },
  { label: 'How do I upload files?', query: 'How do I upload files?' },
  { label: 'How do I create a mock test?', query: 'How do I create a mock test?' },
  { label: 'Where can I research cases?', query: 'Where can I research cases?' },
  { label: 'How do I search Bare Acts?', query: 'How do I search Bare Acts?' },
];

export function GuideBotContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [streaming, setStreaming] = useState(false);

  const {
    state,
    setState,
    micStream,
    speakingVolume,
    micVolume,
    voiceTranscript,
    setVoiceTranscript,
    error,
    requestMicAccess,
    releaseMicAccess,
    stopTTSPlayback,
  } = useVoice();

  const { startRecording, stopRecordingAndTranscribe } = useVoiceRecorder();
  const { speakText } = useTTS();
  const { getToken, isSignedIn } = useAuth();
  const [apiToken, setApiToken] = useState('');

  // Voice Activity Detection / Silence timeout / Interruption logic
  useVoiceActivity({
    silenceTimeoutMs: 800,
    speechThreshold: 0.015,
    onSilenceDetected: async () => {
      if (state !== 'listening') return;
      
      const text = await stopRecordingAndTranscribe(apiToken);
      if (text && text.trim()) {
        console.log(`[GuideBot] Transcript generated: "${text}"`);
        console.log('[GuideBot] Sending transcript to AI...');
        setVoiceTranscript(text);
        
        setState('thinking');
        const assistantReplyText = await sendVoiceQueryToAI(text);
        
        if (assistantReplyText) {
          console.log('[GuideBot] AI response received.');
          console.log('[GuideBot] Generating ElevenLabs speech...');
          await speakText(assistantReplyText, apiToken, () => {
            console.log('[GuideBot] AI finished speaking. Resuming listening...');
            setVoiceTranscript('');
            setState('listening');
            startRecording();
          });
        } else {
          setState('listening');
          startRecording();
        }
      } else {
        // Nothing transcribed, go back to listening
        setState('listening');
        startRecording();
      }
    },
    onSpeechDetected: () => {
      console.log('[GuideBot] Speech detected.');
    },
    onInterrupted: () => {
      console.log('[GuideBot] Interruption triggered. Aborting playback...');
      stopTTSPlayback();
      setVoiceTranscript('');
      setState('listening');
      startRecording();
    },
  });

  const toggleVoiceMode = async () => {
    if (state !== 'idle') {
      stopTTSPlayback();
      releaseMicAccess();
      setState('idle');
      setVoiceTranscript('');
    } else {
      const stream = await requestMicAccess();
      if (stream) {
        setState('listening');
        setVoiceTranscript('');
        startRecording(stream);
      }
    }
  };

  const sendVoiceQueryToAI = async (text: string): Promise<string | null> => {
    const cleanText = text.trim();
    if (!cleanText) return null;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    if (!isSignedIn) {
      const fallback = `👋 Please log in to chat with me! You can ask questions about our platform and modules once you are signed into your account.`;
      const authFallbackMsg: Message = {
        id: `gb-auth-${Date.now()}`,
        role: 'assistant',
        content: fallback,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, authFallbackMsg]);
      setLoading(false);
      return fallback;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/chat/guidebot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ sessionId, message: cleanText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setStreaming(true);
      const content = data.content;
      const words = content.split(' ');
      let currentWordIndex = 0;
      let streamedText = '';

      const assistantMsgId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (currentWordIndex < words.length) {
            streamedText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: streamedText } : msg
              )
            );
            currentWordIndex++;
          } else {
            clearInterval(interval);
            setStreaming(false);
            setLoading(false);
            resolve();
          }
        }, 30);
      });

      return content;
    } catch (err) {
      console.error('Failed to send message to GuideBot:', err);
      const fallback = `I'm having trouble connecting to my help database right now. Please check your network or try again.`;
      const errorMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: fallback,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setLoading(false);
      return fallback;
    }
  };

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const [sessionId, setSessionId] = useState(() => {
    let id = localStorage.getItem('guidebot_session_id');
    if (!id) {
      id = `gb_session_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('guidebot_session_id', id);
    }
    return id;
  });

  // Track system theme changes dynamically
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.dataset.theme as 'light' | 'dark' || 'light';
      setTheme(currentTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    setTheme(document.documentElement.dataset.theme as 'light' | 'dark' || 'light');
    return () => observer.disconnect();
  }, []);

  // Fetch token dynamically when signed in
  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => setApiToken(token || ''));
    } else {
      setApiToken('');
    }
  }, [isSignedIn, getToken]);

  // Fetch session history when chat is opened or when session changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (!apiToken || !isOpen) return;
      try {
        const res = await fetch(`${API_BASE_URL}/chat/guidebot/history/${sessionId}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(
            data.map((m: any, idx: number) => ({
              id: `msg-${idx}-${Date.now()}`,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch GuideBot history:', err);
      }
    };
    fetchHistory();
  }, [apiToken, sessionId, isOpen]);

  // Clean up speech recognition if chatbot is closed or minimized
  useEffect(() => {
    if (!isOpen) {
      stopTTSPlayback();
      releaseMicAccess();
      setState('idle');
      setVoiceTranscript('');
    }
  }, [isOpen, setState, stopTTSPlayback, releaseMicAccess, setVoiceTranscript]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Handle click outside to close the panel
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Send message
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading || streaming) return;

    setInput('');
    if (taRef.current) {
      taRef.current.style.height = 'auto';
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    if (!isSignedIn) {
      setTimeout(() => {
        const authFallbackMsg: Message = {
          id: `gb-auth-${Date.now()}`,
          role: 'assistant',
          content: `👋 Please log in to chat with me! You can ask questions about our platform and modules once you are signed into your account.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, authFallbackMsg]);
        setLoading(false);
      }, 600);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/chat/guidebot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setStreaming(true);
      const content = data.content;
      const words = content.split(' ');
      let currentWordIndex = 0;
      let streamedText = '';

      const assistantMsgId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);

      // Turn off loading spinner since we are streaming text now
      setLoading(false);

      const interval = setInterval(() => {
        if (currentWordIndex < words.length) {
          streamedText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: streamedText } : msg
            )
          );
          currentWordIndex++;
        } else {
          clearInterval(interval);
          setStreaming(false);
        }
      }, 40);
    } catch (err) {
      console.error('Failed to send message to GuideBot:', err);
      const errorMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `I'm having trouble connecting to my help database right now. Please check your network or try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setLoading(false);
    }
  };

  // Reset/Restart session
  const handleRestart = async () => {
    if (!window.confirm('Restart chat session and reset history?')) return;
    try {
      if (isSignedIn && apiToken) {
        await fetch(`${API_BASE_URL}/chat/guidebot/history/${sessionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${apiToken}` },
        });
      }
      const newId = `gb_session_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('guidebot_session_id', newId);
      setSessionId(newId);
      setMessages([
        {
          id: `a-init-${Date.now()}`,
          role: 'assistant',
          content: `Welcome to LEGATRIXON 👋\n\nI'm LEGATRIXON AI Assistant.\n\nI can help you discover features, navigate the platform, and guide you to the right AI assistant.\n\nHow can I help you today?`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Failed to restart GuideBot session:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = () => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 120)}px`;
    }
  };

  // Glassmorphic variables based on dynamic theme
  const panelBg = theme === 'dark' ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  const panelBorder = theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const textPrimary = theme === 'dark' ? '#f4f4f5' : '#18181b';
  const textSecondary = theme === 'dark' ? '#a1a1aa' : '#71717a';
  const shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <>
      {/* FLOATING ACTION BUTTON */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="legatrixon-logo-circle animate-pulse"
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          width: '56px',
          height: '56px',
          padding: 0,
          cursor: 'pointer',
          zIndex: 99999,
          border: '2px solid var(--gold, #f5c14f)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
          transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        title="LEGATRIXON Platform Assistant"
      />

      {/* COLLAPSIBLE CHAT PANEL */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '96px',
          width: 'calc(100vw - 48px)',
          maxWidth: '460px',
          height: 'calc(100vh - 140px)',
          maxHeight: '700px',
          background: panelBg,
          backdropFilter: 'blur(20px)',
          borderRadius: '18px',
          border: `1px solid ${panelBorder}`,
          boxShadow: `0 12px 40px ${shadowColor}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 99998,
          transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.94)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
        }}
      >
        {/* PANEL HEADER */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${panelBorder}`,
            background: 'rgba(0, 0, 0, 0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="legatrixon-logo-circle" style={{ width: '26px', height: '26px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h4
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    margin: 0,
                    color: textPrimary,
                    fontFamily: 'Sora, sans-serif',
                  }}
                >
                  LEGATRIXON AI Assistant
                </h4>
                <span
                  style={{
                    fontSize: '0.62rem',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'rgba(245, 193, 79, 0.1)',
                    color: 'var(--gold, #f5c14f)',
                    fontWeight: '700',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  Platform Guide
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: textSecondary, margin: '2px 0 0 0' }}>
                Helping you navigate LEGATRIXON
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={handleRestart}
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'grid',
                placeItems: 'center',
              }}
              title="Reset conversation"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'grid',
                placeItems: 'center',
              }}
              title="Minimize"
            >
              <Minimize2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'grid',
                placeItems: 'center',
              }}
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* VOICE ACTIVE OVERLAY */}
        <AnimatePresence>
          {state !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                inset: 0,
                top: '56px', // below header
                bottom: 0, // covers message list and input area
                background: 'linear-gradient(180deg, #FFFFFF 0%, #FAF8F3 50%, #FFFFFF 100%)',
                backdropFilter: 'blur(25px)',
                zIndex: 999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '32px 24px',
                textAlign: 'center',
              }}
            >
              {/* Keyframes spin injection */}
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin-ring {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}} />

              {/* Title area */}
              <div style={{ color: '#8f6412', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '12px' }}>
                LEGATRIXON Voice Assistant
              </div>

              {/* Orb centerpiece area */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                position: 'relative',
              }}>
                {/* Subtle radial golden glow behind the orb container only. Opacity between 8% and 12% */}
                <div 
                  className="absolute w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] md:w-[360px] md:h-[360px]"
                  style={{
                    background: 'radial-gradient(circle, rgba(212, 175, 55, 0.1) 0%, rgba(255, 255, 255, 0) 70%)',
                    zIndex: 0,
                    pointerEvents: 'none',
                  }} 
                />

                {/* Centered circular container for the orb */}
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex items-center justify-center rounded-full w-[220px] h-[220px] sm:w-[280px] sm:h-[280px] md:w-[320px] md:h-[320px] p-[12px] sm:p-[16px] md:p-[20px]"
                  style={{ 
                    position: 'relative', 
                    marginBottom: '24px',
                    boxSizing: 'border-box',
                    background: 'radial-gradient(circle, rgba(250, 248, 243, 0.92) 0%, rgba(255, 255, 255, 0.4) 100%)',
                    border: '1.5px solid rgba(212, 175, 55, 0.25)', // thin champagne gold circular border
                    boxShadow: `
                      0 15px 35px rgba(0, 0, 0, 0.05), 
                      inset 0 2px 10px rgba(255, 255, 255, 0.7),
                      0 0 20px rgba(250, 248, 243, 0.6)
                    `, // premium shadow & soft outer ivory glow
                    zIndex: 1,
                    overflow: 'visible', // Ensure floating particles aren't cropped
                  }}
                >
                  <VoicePoweredOrb
                    state={state}
                    audioVolume={state === 'speaking' ? speakingVolume : micVolume}
                  />
                </motion.div>

                {/* Status indicator below the orb */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 1 }}>
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    style={{ 
                      fontSize: '1.05rem', 
                      fontWeight: '700', 
                      color: '#8f6412',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {state === 'listening' && '🎤 Listening...'}
                    {state === 'thinking' && '🧠 Thinking...'}
                    {state === 'speaking' && '🔊 Speaking...'}
                  </motion.div>
                  {state === 'listening' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      style={{
                        fontSize: '0.8rem',
                        color: '#71717a',
                        fontWeight: '500',
                      }}
                    >
                      Speak naturally...
                    </motion.div>
                  )}
                </div>

                {/* Transcript container */}
                {state === 'listening' && voiceTranscript && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.85 }}
                    style={{ 
                      color: '#18181b', 
                      fontSize: '0.88rem', 
                      fontWeight: '500', 
                      fontStyle: 'italic',
                      marginTop: '12px', 
                      maxWidth: '85%', 
                      lineHeight: 1.4,
                      overflowY: 'auto',
                      maxHeight: '80px',
                      zIndex: 1,
                    }}
                  >
                    "{voiceTranscript}"
                  </motion.p>
                )}
              </div>

              {/* Bottom Action buttons */}
              <div style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: 'center', marginBottom: '8px', zIndex: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    stopTTSPlayback();
                    releaseMicAccess();
                    setState('idle');
                    setVoiceTranscript('');
                  }}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '24px',
                    background: 'transparent',
                    border: '1.5px solid rgba(168, 116, 0, 0.5)',
                    color: '#8f6412',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '120px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopTTSPlayback();
                    releaseMicAccess();
                    setState('idle');
                    setVoiceTranscript('');
                  }}
                  style={{
                    padding: '10px 28px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #D4AF37 0%, #A87400 100%)',
                    border: 'none',
                    color: '#000000',
                    fontSize: '0.82rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(168, 116, 0, 0.2)',
                    transition: 'all 0.2s ease',
                    minWidth: '130px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(168, 116, 0, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 116, 0, 0.2)';
                  }}
                >
                  Cancel Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CHAT VIEWPORT */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* GREETING INITIAL MESSAGE IF EMPTY */}
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-start', width: '100%' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gold, #f5c14f)', letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: '4px' }}>
                LEGATRIXON AI Assistant
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '14px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)', border: `1px solid ${panelBorder}`, color: textPrimary, fontSize: '0.88rem', lineHeight: '1.6' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.94rem', fontWeight: '700' }}>Welcome to LEGATRIXON 👋</p>
                <p style={{ margin: '0 0 10px 0' }}>I'm LEGATRIXON AI Assistant.</p>
                <p style={{ margin: '0 0 10px 0' }}>I can help you discover features, navigate the platform, and guide you to the right AI assistant.</p>
                <p style={{ margin: 0 }}>How can I help you today?</p>
              </div>
            </div>
          )}

          {/* Keyframes bounce-dot injection */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes bounce-dot {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-5px); }
            }
          `}} />

          {/* MESSAGES LIST */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: msg.role === 'user' ? '70%' : '90%',
                gap: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: msg.role === 'user' ? textSecondary : 'var(--gold, #f5c14f)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  paddingLeft: '4px',
                }}
              >
                {msg.role === 'user' ? 'You' : 'LEGATRIXON AI Assistant'}
              </div>
              <div
                style={{
                  padding: msg.role === 'user' ? '12px 18px' : '16px 24px',
                  borderRadius: '16px',
                  background: msg.role === 'user' 
                    ? (theme === 'dark' ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.12)')
                    : (theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#ffffff'),
                  border: msg.role === 'user' 
                    ? '1px solid rgba(212, 175, 55, 0.3)' 
                    : (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)'),
                  boxShadow: msg.role === 'user'
                    ? 'none'
                    : (theme === 'dark' ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 4px 20px rgba(0, 0, 0, 0.05)'),
                  color: textPrimary,
                  fontSize: '16px',
                  lineHeight: '1.8',
                }}
              >
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: '0 0 16px 0', fontSize: '16px', lineHeight: '1.8' }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '0 0 16px 0' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '20px', margin: '0 0 16px 0' }}>{children}</ol>,
                    li: ({ children }) => <li style={{ margin: '8px 0', fontSize: '16px', lineHeight: '1.8' }}>{children}</li>,
                    strong: ({ children }) => <strong style={{ fontWeight: '700', color: 'var(--gold, #f5c14f)' }}>{children}</strong>,
                    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                    blockquote: ({ children }) => (
                      <blockquote style={{
                        borderLeft: '4px solid var(--gold, #f5c14f)',
                        background: 'rgba(245, 193, 79, 0.05)',
                        padding: '10px 16px',
                        margin: '16px 0',
                        borderRadius: '0 8px 8px 0',
                        fontStyle: 'italic'
                      }}>
                        {children}
                      </blockquote>
                    ),
                    code: ({ inline, className, children, ...props }: any) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline ? (
                        <pre style={{
                          background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                          padding: '12px',
                          borderRadius: '8px',
                          overflowX: 'auto',
                          margin: '16px 0',
                          border: `1px solid ${panelBorder}`
                        }}>
                          <code style={{ fontFamily: 'Consolas, monospace', fontSize: '0.85rem', color: textPrimary }} {...props}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code style={{
                          background: theme === 'dark' ? 'rgba(245,193,79,0.1)' : 'rgba(245,193,79,0.05)',
                          color: 'var(--gold, #f5c14f)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontFamily: 'Consolas, monospace',
                          fontSize: '0.9em'
                        }} {...props}>
                          {children}
                        </code>
                      );
                    },
                    table: ({ children }) => (
                      <div style={{ overflowX: 'auto', margin: '20px 0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead style={{ background: theme === 'dark' ? 'rgba(245,193,79,0.15)' : 'rgba(245,193,79,0.08)', borderBottom: '2px solid rgba(245,193,79,0.3)' }}>{children}</thead>,
                    th: ({ children }) => <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: 'var(--gold, #f5c14f)' }}>{children}</th>,
                    td: ({ children }) => <td style={{ padding: '8px 12px', borderBottom: `1px solid ${panelBorder}` }}>{children}</td>,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold, #f5c14f)', textDecoration: 'underline' }}>{children}</a>,
                    hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${panelBorder}`, margin: '20px 0' }} />,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}

          {/* THINKING LOADER */}
          {loading && !streaming && (
            <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', gap: '4px', maxWidth: '90%' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gold, #f5c14f)', letterSpacing: '0.04em', textTransform: 'uppercase', paddingLeft: '4px' }}>
                LEGATRIXON AI Assistant
              </div>
              <div style={{
                padding: '16px 24px',
                borderRadius: '16px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#ffffff',
                border: `1px solid ${panelBorder}`,
                boxShadow: theme === 'dark' ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 4px 20px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: 'fit-content'
              }}>
                <span style={{ width: '8px', height: '8px', background: 'var(--gold, #f5c14f)', borderRadius: '50%', display: 'inline-block', animation: 'bounce-dot 0.8s infinite 0s ease-in-out' }}></span>
                <span style={{ width: '8px', height: '8px', background: 'var(--gold, #f5c14f)', borderRadius: '50%', display: 'inline-block', animation: 'bounce-dot 0.8s infinite 0.15s ease-in-out' }}></span>
                <span style={{ width: '8px', height: '8px', background: 'var(--gold, #f5c14f)', borderRadius: '50%', display: 'inline-block', animation: 'bounce-dot 0.8s infinite 0.3s ease-in-out' }}></span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* SUGGESTED CHIPS */}
        {messages.length <= 1 && !loading && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: `1px solid ${panelBorder}`,
              background: 'rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '0.68rem', color: textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Suggested Questions:
            </div>
            <div
              style={{
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                paddingBottom: '4px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {SUGGESTIONS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleSend(chip.query)}
                  style={{
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                    border: `1px solid ${panelBorder}`,
                    color: textPrimary,
                    borderRadius: '16px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 193, 79, 0.15)';
                    e.currentTarget.style.borderColor = 'var(--gold, #f5c14f)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.borderColor = panelBorder;
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INPUT BOX */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${panelBorder}`,
            background: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              flex: 1,
              background: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
              border: `1px solid ${panelBorder}`,
              borderRadius: '10px',
              display: 'flex',
              padding: '2px 8px',
            }}
          >
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask GuideBot..."
              disabled={loading || streaming}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: textPrimary,
                fontSize: '0.86rem',
                lineHeight: 1.4,
                padding: '6px 2px',
                fontFamily: 'inherit',
                maxHeight: '80px',
              }}
            />
          </div>

          <button
            type="button"
            onClick={toggleVoiceMode}
            disabled={loading || streaming}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: state !== 'idle' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              color: state !== 'idle' ? '#ef4444' : (theme === 'dark' ? 'var(--gold, #f5c14f)' : '#8f6412'),
              border: `1.5px solid ${state !== 'idle' ? '#ef4444' : 'var(--gold, #f5c14f)'}`,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Voice Assistant Mode"
          >
            {state !== 'idle' ? <MicOff size={14} /> : <Mic size={14} />}
          </button>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || streaming || !input.trim()}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: input.trim() && !loading && !streaming ? 'var(--gold, #f5c14f)' : 'rgba(255, 255, 255, 0.03)',
              color: input.trim() && !loading && !streaming ? '#1a1a1a' : textSecondary,
              border: 'none',
              display: 'grid',
              placeItems: 'center',
              cursor: input.trim() && !loading && !streaming ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

export default function GuideBot() {
  return (
    <VoiceProvider>
      <GuideBotContent />
    </VoiceProvider>
  );
}
