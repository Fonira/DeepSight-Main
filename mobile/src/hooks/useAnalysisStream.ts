/**
 * useAnalysisStream — Hook SSE pour Streaming d'Analyse en Temps Réel (React Native)
 *
 * FONCTIONNALITÉS:
 * - Server-Sent Events avec reconnexion automatique
 * - Progression en temps réel avec étapes détaillées
 * - Affichage token par token (typing effect)
 * - Pause/Resume du streaming
 * - Gestion des erreurs avec retry intelligent
 * - Buffer pour reconstitution du texte
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from '../utils/storage';

// Types
export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'metadata'
  | 'transcript'
  | 'analyzing'
  | 'complete'
  | 'error'
  | 'paused'
  | 'cancelled';

export interface StreamStep {
  id: string;
  label: string;
  labelEn: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface VideoMetadata {
  title: string;
  channel: string;
  duration: number;
  thumbnail?: string;
  publishDate?: string;
  viewCount?: number;
  category?: string;
}

export interface StreamError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AnalysisStreamOptions {
  mode?: 'accessible' | 'standard' | 'expert';
  lang?: 'fr' | 'en';
  model?: string;
  webEnrich?: boolean;
  onToken?: (token: string, fullText: string) => void;
  onStatusChange?: (status: StreamStatus) => void;
  onComplete?: (data: { summaryId: number; text: string; metadata: VideoMetadata | null }) => void;
  onError?: (error: StreamError) => void;
  autoStart?: boolean;
  maxRetries?: number;
}

export interface AnalysisStreamState {
  status: StreamStatus;
  progress: number;
  text: string;
  metadata: VideoMetadata | null;
  steps: StreamStep[];
  error: StreamError | null;
  summaryId: number | null;
  startedAt: Date | null;
  duration: number;
}

export interface AnalysisStreamActions {
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
}

// Default steps
const DEFAULT_STEPS: StreamStep[] = [
  { id: 'connect', label: 'Connexion', labelEn: 'Connecting', status: 'pending' },
  { id: 'metadata', label: 'Métadonnées', labelEn: 'Metadata', status: 'pending' },
  { id: 'transcript', label: 'Transcription', labelEn: 'Transcript', status: 'pending' },
  { id: 'analysis', label: 'Analyse IA', labelEn: 'AI Analysis', status: 'pending' },
  { id: 'complete', label: 'Finalisation', labelEn: 'Finalizing', status: 'pending' },
];

const STEP_WEIGHTS: Record<string, number> = {
  connect: 5,
  metadata: 10,
  transcript: 25,
  analysis: 55,
  complete: 5,
};

// SSE Event Parser for React Native
class EventSourceParser {
  private buffer: string = '';
  private onEvent: (event: { type: string; data: string }) => void;

  constructor(onEvent: (event: { type: string; data: string }) => void) {
    this.onEvent = onEvent;
  }

  feed(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    let eventType = 'message';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        eventData = line.slice(5).trim();
      } else if (line === '') {
        if (eventData) {
          this.onEvent({ type: eventType, data: eventData });
          eventType = 'message';
          eventData = '';
        }
      }
    }
  }
}

// Main Hook
export function useAnalysisStream(
  videoId: string | null,
  options: AnalysisStreamOptions = {}
): [AnalysisStreamState, AnalysisStreamActions] {
  const {
    mode = 'standard',
    lang = 'fr',
    model = 'mistral-small-latest',
    webEnrich = false,
    onToken,
    onStatusChange,
    onComplete,
    onError,
    autoStart = false,
    maxRetries = 3,
  } = options;

  // State
  const [state, setState] = useState<AnalysisStreamState>({
    status: 'idle',
    progress: 0,
    text: '',
    metadata: null,
    steps: DEFAULT_STEPS.map(s => ({ ...s })),
    error: null,
    summaryId: null,
    startedAt: null,
    duration: 0,
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const textBufferRef = useRef<string>('');
  const retryCountRef = useRef(0);
  const pausedRef = useRef(false);
  const pauseBufferRef = useRef<{ type: string; data: string }[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metadataRef = useRef<VideoMetadata | null>(null);
  const completedOrErrorRef = useRef(false);
  const isMountedRef = useRef(true);

  // Helpers
  const updateStep = useCallback((stepId: string, updates: Partial<StreamStep>) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      ),
    }));
  }, []);

  const calculateProgress = useCallback((currentStep: string, stepProgress = 100) => {
    let totalProgress = 0;
    let foundCurrent = false;

    for (const step of DEFAULT_STEPS) {
      if (step.id === currentStep) {
        foundCurrent = true;
        totalProgress += (STEP_WEIGHTS[step.id] * stepProgress) / 100;
        break;
      }
      if (!foundCurrent) {
        totalProgress += STEP_WEIGHTS[step.id];
      }
    }

    return Math.min(100, Math.round(totalProgress));
  }, []);

  const setStatus = useCallback((status: StreamStatus) => {
    setState(prev => ({ ...prev, status }));
    onStatusChange?.(status);
  }, [onStatusChange]);

  // Event handler
  const handleEvent = useCallback((event: { type: string; data: string }) => {
    if (!isMountedRef.current) return;
    if (pausedRef.current) {
      pauseBufferRef.current.push(event);
      return;
    }

    try {
      const data = event.data ? JSON.parse(event.data) : {};

      switch (event.type) {
        case 'connected':
          updateStep('connect', { status: 'complete', completedAt: new Date() });
          updateStep('metadata', { status: 'active', startedAt: new Date() });
          setStatus('connecting');
          break;

        case 'metadata':
          metadataRef.current = data as VideoMetadata;
          setState(prev => ({
            ...prev,
            metadata: data as VideoMetadata,
            progress: calculateProgress('metadata'),
          }));
          updateStep('metadata', { status: 'complete', completedAt: new Date() });
          updateStep('transcript', { status: 'active', startedAt: new Date() });
          setStatus('metadata');
          break;

        case 'transcript':
          setState(prev => ({
            ...prev,
            progress: calculateProgress('transcript', data.progress || 50),
          }));
          setStatus('transcript');
          break;

        case 'transcript_complete':
          updateStep('transcript', { status: 'complete', completedAt: new Date() });
          updateStep('analysis', { status: 'active', startedAt: new Date() });
          break;

        case 'analysis_start':
          setStatus('analyzing');
          setState(prev => ({
            ...prev,
            progress: calculateProgress('analysis', 0),
          }));
          break;

        case 'token':
          textBufferRef.current += data.token;

          setState(prev => ({
            ...prev,
            text: textBufferRef.current,
            progress: calculateProgress('analysis', data.progress || 50),
          }));

          onToken?.(data.token, textBufferRef.current);
          break;

        case 'analysis_complete':
          updateStep('analysis', { status: 'complete', completedAt: new Date() });
          updateStep('complete', { status: 'active', startedAt: new Date() });
          break;

        case 'complete':
          completedOrErrorRef.current = true;
          updateStep('complete', { status: 'complete', completedAt: new Date() });

          setState(prev => ({
            ...prev,
            status: 'complete',
            progress: 100,
            summaryId: data.summary_id,
          }));

          onComplete?.({
            summaryId: data.summary_id,
            text: textBufferRef.current,
            metadata: metadataRef.current ?? null,
          });

          // Cleanup
          abortControllerRef.current?.abort();
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
          }
          break;

        case 'error':
          completedOrErrorRef.current = true;
          const error: StreamError = {
            code: data.code || 'UNKNOWN',
            message: data.message || 'Une erreur est survenue',
            retryable: data.retryable ?? true,
          };

          setState(prev => ({
            ...prev,
            status: 'error',
            error,
            steps: prev.steps.map(step =>
              step.status === 'active' ? { ...step, status: 'error' } : step
            ),
          }));

          onError?.(error);
          abortControllerRef.current?.abort();
          break;

        case 'heartbeat':
          // Keep-alive, ignore
          break;
      }
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  }, [calculateProgress, onComplete, onError, onToken, setStatus, updateStep]);

  // Start streaming
  const start = useCallback(async () => {
    if (!videoId) return;

    // Reset state
    textBufferRef.current = '';
    retryCountRef.current = 0;
    pausedRef.current = false;
    pauseBufferRef.current = [];
    metadataRef.current = null;
    completedOrErrorRef.current = false;

    setState({
      status: 'connecting',
      progress: 0,
      text: '',
      metadata: null,
      steps: DEFAULT_STEPS.map(s => ({ ...s })),
      error: null,
      summaryId: null,
      startedAt: new Date(),
      duration: 0,
    });

    // Start duration timer
    durationIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      setState(prev => ({
        ...prev,
        duration: prev.startedAt
          ? Math.floor((Date.now() - prev.startedAt.getTime()) / 1000)
          : 0,
      }));
    }, 1000);

    // Build URL
    const params = new URLSearchParams({
      mode,
      lang,
      model,
      web_enrich: String(webEnrich),
    });

    const token = await tokenStorage.getAccessToken();
    if (!isMountedRef.current) return;
    if (token) {
      params.set('token', token);
    }

    const url = `${API_BASE_URL}/api/videos/stream/${videoId}?${params}`;

    // Abort previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    updateStep('connect', { status: 'active', startedAt: new Date() });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: abortControllerRef.current.signal,
      });

      if (!isMountedRef.current) return;
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const parser = new EventSourceParser(handleEvent);
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Intentional abort
      }

      console.error('SSE connection error:', error);

      if (retryCountRef.current < maxRetries && !pausedRef.current) {
        retryCountRef.current++;
        setTimeout(() => start(), 1000 * Math.pow(2, retryCountRef.current));
      } else if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: {
            code: 'CONNECTION_ERROR',
            message: 'Connexion perdue. Veuillez réessayer.',
            retryable: true,
          },
        }));
      }
    }
  }, [videoId, mode, lang, model, webEnrich, maxRetries, handleEvent, updateStep]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setStatus('paused');
  }, [setStatus]);

  const resume = useCallback(() => {
    pausedRef.current = false;

    // Process buffered events
    while (pauseBufferRef.current.length > 0) {
      const event = pauseBufferRef.current.shift()!;
      handleEvent(event);
    }

    // Only set 'analyzing' if we didn't just process 'complete' or 'error'
    if (!completedOrErrorRef.current) {
      setStatus('analyzing');
    }
  }, [handleEvent, setStatus]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setStatus('cancelled');
  }, [setStatus]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    textBufferRef.current = '';
    retryCountRef.current = 0;
    pausedRef.current = false;
    pauseBufferRef.current = [];
    completedOrErrorRef.current = false;

    setState({
      status: 'idle',
      progress: 0,
      text: '',
      metadata: null,
      steps: DEFAULT_STEPS.map(s => ({ ...s })),
      error: null,
      summaryId: null,
      startedAt: null,
      duration: 0,
    });
  }, []);

  // Handle app state changes (pause when backgrounded)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' && state.status === 'analyzing') {
        // Don't pause - keep running in background
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [state.status]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && videoId) {
      start();
    }

    return () => {
      abortControllerRef.current?.abort();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [autoStart, videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const actions: AnalysisStreamActions = useMemo(() => ({
    start,
    pause,
    resume,
    cancel,
    reset,
  }), [start, pause, resume, cancel, reset]);

  return [state, actions];
}

// Utility: Typing text with cursor
export function useTypingText(
  text: string,
  options: { cursorChar?: string; blinkSpeed?: number } = {}
): string {
  const { cursorChar = '▋', blinkSpeed = 500 } = options;
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, blinkSpeed);

    return () => clearInterval(interval);
  }, [blinkSpeed]);

  return text + (showCursor ? cursorChar : ' ');
}

// Utility: Formatted duration
export function useFormattedDuration(seconds: number): string {
  return useMemo(() => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }, [seconds]);
}

export default useAnalysisStream;
