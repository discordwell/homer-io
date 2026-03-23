import OpenAI from 'openai';
import { config } from '../../config.js';

const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
];

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB (Whisper limit is 25 MB)

const MIME_TO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/x-m4a': 'm4a',
};

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!config.openai.apiKey) {
    throw new Error('Voice features require OPENAI_API_KEY to be configured');
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return cachedClient;
}

export function isVoiceConfigured(): boolean {
  return !!config.openai.apiKey;
}

export function validateAudioMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.some((allowed) => mimeType.startsWith(allowed));
}

export function validateAudioSize(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_AUDIO_BYTES;
}

/**
 * Transcribe audio using OpenAI Whisper API.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const client = getClient();
  const ext = MIME_TO_EXT[mimeType] || 'webm';
  const file = new File([new Uint8Array(audioBuffer)], `audio.${ext}`, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    model: config.voice.whisperModel,
    file,
  });

  return response.text;
}

/**
 * Convert text to speech using OpenAI TTS API.
 * Returns an MP3 buffer.
 */
export async function synthesizeSpeech(
  text: string,
  voice?: string,
): Promise<Buffer> {
  const client = getClient();

  const response = await client.audio.speech.create({
    model: config.voice.ttsModel,
    voice: (voice || config.voice.ttsVoice) as any,
    input: text,
    response_format: 'mp3',
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
