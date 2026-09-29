import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VoiceContextProps {
  state: VoiceState;
  setState: (state: VoiceState) => void;
  micStream: MediaStream | null;
  speakingVolume: number;
  setSpeakingVolume: (v: number) => void;
  micVolume: number;
  setMicVolume: (v: number) => void;
  voiceTranscript: string;
  setVoiceTranscript: (text: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
  requestMicAccess: () => Promise<MediaStream | null>;
  releaseMicAccess: () => void;
  stopTTSPlayback: () => void;
  registerStopTTSCallback: (cb: () => void) => void;
  getAudioContext: () => AudioContext;
}

const VoiceContext = createContext<VoiceContextProps | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setStateState] = useState<VoiceState>('idle');
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [speakingVolume, setSpeakingVolume] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const stopTTSCallbackRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Lazy initialize/fetch the shared AudioContext
  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    return audioContextRef.current;
  };

  // High quality logging for state transitions
  const setState = (newState: VoiceState) => {
    console.log(`[VoiceState] Transition: ${state} -> ${newState}`);
    setStateState(newState);
  };

  const requestMicAccess = async (): Promise<MediaStream | null> => {
    // Resume AudioContext inside the user gesture handler
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
        console.log('[VoiceProvider] Shared AudioContext resumed successfully.');
      }
    } catch (e) {
      console.warn('[VoiceProvider] Failed to resume AudioContext during user gesture:', e);
    }

    if (streamRef.current) {
      console.log('[VoiceProvider] Returning existing active MediaStream.');
      return streamRef.current;
    }

    // Verify browser API support
    if (!navigator?.mediaDevices?.getUserMedia) {
      const supportErr = 'Browser does not support getUserMedia or mediaDevices API.';
      console.error(`[VoiceProvider] ${supportErr}`);
      setError(supportErr);
      setState('idle');
      return null;
    }

    try {
      setError(null);
      console.log('[VoiceProvider] Microphone permission requested...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      if (!stream) {
        throw new Error('MediaStream not received from getUserMedia API.');
      }

      const audioTracks = stream.getAudioTracks();
      console.log(`[VoiceProvider] MediaStream received. Number of audio tracks: ${audioTracks.length}`);

      if (audioTracks.length === 0) {
        throw new Error('No audio tracks are available in the received MediaStream.');
      }

      // Check track states
      audioTracks.forEach((track, index) => {
        console.log(`[VoiceProvider] Track ${index} - Label: "${track.label}", ReadyState: "${track.readyState}", Enabled: ${track.enabled}`);
        if (track.readyState !== 'live') {
          console.warn(`[VoiceProvider] Audio track ${index} is not live: "${track.readyState}"`);
        } else {
          console.log('[VoiceProvider] Audio track live');
        }
      });

      streamRef.current = stream;
      setMicStream(stream);
      console.log('[VoiceProvider] Microphone permission granted.');
      return stream;
    } catch (err: any) {
      console.error('[VoiceProvider] Failed to access microphone:', err);
      setError(`Microphone access failed: ${err instanceof Error ? err.message : String(err)}`);
      setState('idle');
      return null;
    }
  };

  const releaseMicAccess = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMicStream(null);
    }
    setMicVolume(0);
  };

  const registerStopTTSCallback = (cb: () => void) => {
    stopTTSCallbackRef.current = cb;
  };

  const stopTTSPlayback = () => {
    if (stopTTSCallbackRef.current) {
      try {
        stopTTSCallbackRef.current();
      } catch (err) {
        console.warn('Error during stopTTSCallback:', err);
      }
    }
    setSpeakingVolume(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseMicAccess();
    };
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        state,
        setState,
        micStream,
        speakingVolume,
        setSpeakingVolume,
        micVolume,
        setMicVolume,
        voiceTranscript,
        setVoiceTranscript,
        error,
        setError,
        requestMicAccess,
        releaseMicAccess,
        stopTTSPlayback,
        registerStopTTSCallback,
        getAudioContext,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
