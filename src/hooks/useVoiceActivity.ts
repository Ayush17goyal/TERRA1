import { useEffect, useRef } from 'react';
import { useVoice } from '@/context/VoiceProvider';
import { calculateRMS } from '@/lib/voice';

interface UseVoiceActivityProps {
  silenceTimeoutMs?: number;
  speechThreshold?: number;
  onSilenceDetected?: () => void;
  onSpeechDetected?: () => void;
  onInterrupted?: () => void;
}

export function useVoiceActivity({
  silenceTimeoutMs = 800,
  speechThreshold = 0.01,
  onSilenceDetected,
  onSpeechDetected,
  onInterrupted,
}: UseVoiceActivityProps) {
  const { micStream, state, setMicVolume, getAudioContext } = useVoice();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Use refs for callbacks and current state to keep the useEffect completely stable
  const onSilenceDetectedRef = useRef(onSilenceDetected);
  const onSpeechDetectedRef = useRef(onSpeechDetected);
  const onInterruptedRef = useRef(onInterrupted);
  const stateRef = useRef(state);

  useEffect(() => {
    onSilenceDetectedRef.current = onSilenceDetected;
    onSpeechDetectedRef.current = onSpeechDetected;
    onInterruptedRef.current = onInterrupted;
    stateRef.current = state;
  });

  useEffect(() => {
    if (!micStream) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setMicVolume(0);
      return;
    }

    let sourceNode: MediaStreamAudioSourceNode | null = null;
    const audioContext = getAudioContext();

    try {
      sourceNode = audioContext.createMediaStreamSource(micStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      sourceNode.connect(analyser);
      analyserRef.current = analyser;
      console.log('[useVoiceActivity] AnalyserNode initialized successfully.');
    } catch (e) {
      console.error('[useVoiceActivity] Failed to create media stream source:', e);
      return;
    }

    const dataArray = new Float32Array(analyserRef.current.fftSize);

    const updateVolume = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getFloatTimeDomainData(dataArray);
      const rms = calculateRMS(dataArray);

      const currentState = stateRef.current;

      if (currentState === 'listening') {
        setMicVolume(rms);
      } else {
        setMicVolume(0);
      }

      if (rms > speechThreshold) {
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          console.log(`[useVoiceActivity] User speech detected. Volume RMS = ${rms.toFixed(4)}`);
          onSpeechDetectedRef.current?.();
        }

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (currentState === 'speaking') {
          console.log('[useVoiceActivity] Interruption detected! User started speaking while AI was speaking.');
          onInterruptedRef.current?.();
        }
      } else {
        if (isSpeakingRef.current) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              isSpeakingRef.current = false;
              console.log('[useVoiceActivity] Silence detected (800ms). Triggering onSilenceDetected...');
              onSilenceDetectedRef.current?.();
              silenceTimerRef.current = null;
            }, silenceTimeoutMs);
          }
        }
      }

      rafRef.current = requestAnimationFrame(updateVolume);
    };

    rafRef.current = requestAnimationFrame(updateVolume);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (sourceNode && analyserRef.current) {
        try {
          sourceNode.disconnect();
        } catch (e) {}
      }
      analyserRef.current = null;
    };
  }, [micStream, silenceTimeoutMs, speechThreshold, setMicVolume, getAudioContext]);
}
