import { useRef, useEffect, useCallback } from 'react';
import { useVoice } from '@/context/VoiceProvider';
import { calculateRMS } from '@/lib/voice';
import { API_BASE_URL } from '@/lib/api';

export function useTTS() {
  const { setState, setError, setSpeakingVolume, registerStopTTSCallback, getAudioContext } = useVoice();
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopTTSPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (err) {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setSpeakingVolume(0);
  }, [setSpeakingVolume]);

  useEffect(() => {
    registerStopTTSCallback(stopTTSPlayback);
  }, [registerStopTTSCallback, stopTTSPlayback]);

  const speakText = useCallback(async (text: string, apiToken: string, onPlaybackEnded?: () => void) => {
    try {
      stopTTSPlayback();
      setState('thinking');

      console.log('[useTTS] Generating speech for text:', text.substring(0, 40) + '...');
      const res = await fetch(`${API_BASE_URL}/chat/guidebot/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`TTS HTTP error: ${res.status}`);
      }

      const audioData = await res.arrayBuffer();
      
      const audioCtx = getAudioContext();

      // Ensure AudioContext is active
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const audioBuffer = await audioCtx.decodeAudioData(audioData);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      
      sourceNodeRef.current = source;

      const dataArray = new Float32Array(analyser.fftSize);
      const monitorPlayback = () => {
        if (!sourceNodeRef.current) return;
        analyser.getFloatTimeDomainData(dataArray);
        const rms = calculateRMS(dataArray);
        setSpeakingVolume(rms);
        rafRef.current = requestAnimationFrame(monitorPlayback);
      };

      source.onended = () => {
        console.log('[useTTS] Speech playback ended.');
        stopTTSPlayback();
        if (onPlaybackEnded) onPlaybackEnded();
      };

      console.log('[useTTS] Playing audio...');
      setState('speaking');
      source.start(0);
      monitorPlayback();

    } catch (err) {
      console.error('[useTTS] Speaking failed, attempting Web Speech API fallback:', err);
      try {
        const synth = window.speechSynthesis;
        if (synth) {
          synth.cancel(); // cancel any ongoing speech
          const utterance = new SpeechSynthesisUtterance(text);
          let volumeInterval: NodeJS.Timeout;

          utterance.onstart = () => {
            console.log('[useTTS] Web Speech API playback started.');
            console.log('[useTTS] Playing audio...');
            setState('speaking');
            
            // Simulate speaking volume for the visual orb
            volumeInterval = setInterval(() => {
              if (!synth.speaking) {
                clearInterval(volumeInterval);
                setSpeakingVolume(0);
                return;
              }
              const level = 0.15 + Math.random() * 0.55;
              setSpeakingVolume(level);
            }, 100);
          };

          utterance.onend = () => {
            console.log('[useTTS] Web Speech API playback ended.');
            if (volumeInterval) clearInterval(volumeInterval);
            setSpeakingVolume(0);
            if (onPlaybackEnded) {
              onPlaybackEnded();
            } else {
              setState('idle');
            }
          };

          utterance.onerror = (e) => {
            console.error('[useTTS] Web Speech API utterance error:', e);
            if (volumeInterval) clearInterval(volumeInterval);
            setSpeakingVolume(0);
            setState('idle');
            setError('Failed to play synthesized speech.');
          };

          synth.speak(utterance);
        } else {
          throw new Error('Web Speech API (speechSynthesis) not supported in this browser.');
        }
      } catch (fallbackErr) {
        console.error('[useTTS] Fallback speech synthesis failed:', fallbackErr);
        setError('Failed to synthesize speech.');
        setState('idle');
      }
    }
  }, [setState, setError, stopTTSPlayback, setSpeakingVolume, getAudioContext]);

  useEffect(() => {
    return () => {
      stopTTSPlayback();
    };
  }, [stopTTSPlayback]);

  return {
    speakText,
    stopTTSPlayback,
  };
}
