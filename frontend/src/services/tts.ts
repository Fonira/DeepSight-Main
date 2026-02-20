/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🔊 TTS SERVICE — Text-to-Speech API Client                                        ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Handles TTS generation requests and audio URL management                          ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { API_URL } from './api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSFormat = 'mp3' | 'opus' | 'aac' | 'flac';

export interface TTSGenerateRequest {
  text: string;
  voice?: TTSVoice;
  speed?: number;
  format?: TTSFormat;
}

export interface TTSGenerateResponse {
  success: boolean;
  audio_url: string;
  cache_key: string;
  duration_estimate: number | null;
  text_length: number;
  cached: boolean;
}

export interface TTSStatusResponse {
  available: boolean;
  provider: string | null;
  voices: string[];
  max_text_length: number;
  supported_formats: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 AUTH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎙️ TTS API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if TTS service is available
 */
export async function getTTSStatus(): Promise<TTSStatusResponse> {
  const response = await fetch(`${API_URL}/api/tts/status`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to get TTS status');
  }

  return response.json();
}

/**
 * Generate TTS audio from text
 */
export async function generateTTS(request: TTSGenerateRequest): Promise<TTSGenerateResponse> {
  const response = await fetch(`${API_URL}/api/tts/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      text: request.text,
      voice: request.voice || 'nova',
      speed: request.speed || 1.0,
      format: request.format || 'mp3',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'TTS generation failed' }));
    throw new Error(error.detail || 'TTS generation failed');
  }

  return response.json();
}

/**
 * Generate TTS audio from a saved summary
 */
export async function generateSummaryTTS(
  summaryId: number,
  options?: {
    voice?: TTSVoice;
    speed?: number;
    format?: TTSFormat;
  }
): Promise<TTSGenerateResponse> {
  const params = new URLSearchParams();
  if (options?.voice) params.append('voice', options.voice);
  if (options?.speed) params.append('speed', options.speed.toString());
  if (options?.format) params.append('format', options.format);

  const url = `${API_URL}/api/tts/generate/summary/${summaryId}${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'TTS generation failed' }));
    throw new Error(error.detail || 'TTS generation failed');
  }

  return response.json();
}

/**
 * Get the full audio URL from a relative path
 */
export function getAudioUrl(relativePath: string): string {
  if (relativePath.startsWith('http')) {
    return relativePath;
  }
  return `${API_URL}${relativePath}`;
}

/**
 * Get streaming audio URL for better mobile performance
 */
export function getStreamingAudioUrl(relativePath: string): string {
  if (relativePath.startsWith('http')) {
    return `${relativePath}/stream`;
  }
  return `${API_URL}${relativePath}/stream`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 VOICE METADATA
// ═══════════════════════════════════════════════════════════════════════════════

export const VOICE_OPTIONS: { value: TTSVoice; label: string; description: string }[] = [
  { value: 'nova', label: 'Nova', description: 'Warm and engaging female voice' },
  { value: 'alloy', label: 'Alloy', description: 'Neutral and balanced voice' },
  { value: 'echo', label: 'Echo', description: 'Clear and articulate voice' },
  { value: 'fable', label: 'Fable', description: 'Expressive storytelling voice' },
  { value: 'onyx', label: 'Onyx', description: 'Deep and authoritative male voice' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright and cheerful voice' },
];

export const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x', description: 'Very slow' },
  { value: 0.75, label: '0.75x', description: 'Slow' },
  { value: 1, label: '1x', description: 'Normal' },
  { value: 1.25, label: '1.25x', description: 'Fast' },
  { value: 1.5, label: '1.5x', description: 'Faster' },
  { value: 2, label: '2x', description: 'Very fast' },
];
