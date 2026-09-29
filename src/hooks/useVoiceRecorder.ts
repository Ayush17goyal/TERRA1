import { useRef, useCallback, useEffect } from 'react';
import { useVoice } from '@/context/VoiceProvider';
import { API_BASE_URL } from '@/lib/api';

export function useVoiceRecorder() {
  const { micStream, setState, setError } = useVoice();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Keep a mutable ref of micStream to prevent stale closure issues
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = micStream;
  }, [micStream]);

  const startRecording = useCallback((customStream?: MediaStream) => {
    const activeStream = customStream || streamRef.current;
    if (!activeStream) {
      console.warn('[useVoiceRecorder] Cannot start recording: micStream is null.');
      return;
    }

    try {
      chunksRef.current = [];
      const options = { mimeType: 'audio/webm;codecs=opus' };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(activeStream, options);
        console.log('[useVoiceRecorder] Recorder initialized with opus options.');
      } catch (e) {
        // Fallback for browsers that don't support audio/webm;codecs=opus
        recorder = new MediaRecorder(activeStream);
        console.log('[useVoiceRecorder] Recorder initialized with default options fallback.');
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      console.log('[useVoiceRecorder] Recording started.');
    } catch (err) {
      console.error('[useVoiceRecorder] Failed to start MediaRecorder:', err);
      setError('Failed to start microphone recording.');
      setState('idle');
    }
  }, [setState, setError]);

  const stopRecordingAndTranscribe = useCallback(async (apiToken: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        console.log('[useVoiceRecorder] Recording stopped.');
        try {
          setState('thinking');
          const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (audioBlob.size < 1000) {
            console.log('[useVoiceRecorder] Audio clip is too short or empty.');
            resolve(null);
            return;
          }

          const formData = new FormData();
          formData.append('file', audioBlob, 'voice.webm');

          console.log('[useVoiceRecorder] Uploading audio chunk to backend STT...');
          const res = await fetch(`${API_BASE_URL}/chat/guidebot/stt`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiToken}`,
            },
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const data = await res.json();
          console.log('[useVoiceRecorder] Received transcription text:', data.text);
          resolve(data.text);
        } catch (err) {
          console.error('[useVoiceRecorder] STT upload failed:', err);
          setError('Failed to transcribe speech.');
          resolve(null);
        }
      };

      recorder.stop();
      mediaRecorderRef.current = null;
    });
  }, [setState, setError]);

  const isRecording = useCallback(() => {
    return mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording';
  }, []);

  return {
    startRecording,
    stopRecordingAndTranscribe,
    isRecording,
  };
}
