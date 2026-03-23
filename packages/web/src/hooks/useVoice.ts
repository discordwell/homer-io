import { useState, useRef, useCallback } from 'react';
import { api } from '../api/client.js';

// Detect supported audio MIME type
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export interface UseVoiceReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  voiceEnabled: boolean;
  toggleVoice: () => void;
  startRecording: () => void;
  stopRecording: () => Promise<string | null>;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  error: string | null;
  supported: boolean;
}

export function useVoice(): UseVoiceReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const supported = typeof MediaRecorder !== 'undefined' && !!getSupportedMimeType();

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((v) => !v);
    setError(null);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    // Stop any playing audio
    stopSpeaking();

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      // Release microphone if we got the stream but MediaRecorder failed
      stream?.getTracks().forEach((t) => t.stop());
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setError('Could not access microphone.');
      }
    }
  }, [stopSpeaking]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      setIsRecording(false);
      return null;
    }

    return new Promise<string | null>((resolve) => {
      recorder.onstop = async () => {
        setIsRecording(false);
        // Stop all tracks to release the microphone
        recorder.stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size === 0) {
          setError('No audio recorded.');
          resolve(null);
          return;
        }

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, `recording.${recorder.mimeType.includes('webm') ? 'webm' : 'mp4'}`);
          const result = await api.upload<{ text: string }>('/ai/transcribe', formData);
          setIsTranscribing(false);
          setError(null);
          resolve(result.text || null);
        } catch (err) {
          setIsTranscribing(false);
          setError(err instanceof Error ? err.message : 'Transcription failed.');
          resolve(null);
        }
      };
      recorder.stop();
    });
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    stopSpeaking();
    setIsSpeaking(true);

    try {
      const { accessToken } = (await import('../stores/auth.js')).useAuthStore.getState();
      const API_BASE = import.meta.env.VITE_API_URL || '/api';

      const res = await fetch(`${API_BASE}/ai/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error('TTS request failed');
      }

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        stopSpeaking();
      };
      audio.onerror = () => {
        stopSpeaking();
      };
      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  }, [stopSpeaking]);

  return {
    isRecording,
    isTranscribing,
    isSpeaking,
    voiceEnabled,
    toggleVoice,
    startRecording,
    stopRecording,
    speak,
    stopSpeaking,
    error,
    supported,
  };
}
