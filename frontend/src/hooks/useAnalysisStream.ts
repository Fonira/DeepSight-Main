/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📡 useAnalysisStream — Hook SSE pour Streaming d'Analyse en Temps Réel           ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FONCTIONNALITÉS:                                                                  ║
 * ║  • 🔄 Server-Sent Events avec reconnexion automatique                             ║
 * ║  • 📊 Progression en temps réel avec étapes détaillées                            ║
 * ║  • ✍️ Affichage token par token (typing effect)                                   ║
 * ║  • ⏸️ Pause/Resume du streaming                                                   ║
 * ║  • 🛡️ Gestion des erreurs avec retry intelligent                                  ║
 * ║  • 💾 Buffer pour reconstitution du texte                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { getAccessToken, API_URL } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

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
  /** Mode d'analyse: accessible, standard, expert */
  mode?: 'accessible' | 'standard' | 'expert';
  /** Langue de sortie */
  lang?: 'fr' | 'en';
  /** Modèle AI à utiliser */
  model?: string;
  /** Activer l'enrichissement web */
  webEnrich?: boolean;
  /** Callback appelé à chaque token reçu */
  onToken?: (token: string, fullText: string) => void;
  /** Callback appelé quand le statut change */
  onStatusChange?: (status: StreamStatus) => void;
  /** Callback appelé à la complétion */
  onComplete?: (data: { summaryId: number; text: string; metadata: VideoMetadata }) => void;
  /** Callback appelé en cas d'erreur */
  onError?: (error: StreamError) => void;
  /** Auto-start le streaming */
  autoStart?: boolean;
  /** Nombre de tentatives de reconnexion */
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

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_STEPS: StreamStep[] = [
  { id: 'connect', label: 'Connexion', status: 'pending' },
  { id: 'metadata', label: 'Métadonnées', status: 'pending' },
  { id: 'transcript', label: 'Transcription', status: 'pending' },
  { id: 'analysis', label: 'Analyse IA', status: 'pending' },
  { id: 'complete', label: 'Finalisation', status: 'pending' },
];

const STEP_WEIGHTS: Record<string, number> = {
  connect: 5,
  metadata: 10,
  transcript: 25,
  analysis: 55,
  complete: 5,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎣 useAnalysisStream — Hook Principal
// ═══════════════════════════════════════════════════════════════════════════════

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
  const eventSourceRef = useRef<EventSource | null>(null);
  const textBufferRef = useRef<string>('');
  const retryCountRef = useRef(0);
  const pausedRef = useRef(false);
  const pauseBufferRef = useRef<string[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔧 HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📡 SSE EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  const handleEvent = useCallback((event: MessageEvent) => {
    if (pausedRef.current) {
      pauseBufferRef.current.push(event.data);
      return;
    }

    try {
      const data = JSON.parse(event.data);
      
      switch (event.type) {
        case 'connected':
          updateStep('connect', { status: 'complete', completedAt: new Date() });
          updateStep('metadata', { status: 'active', startedAt: new Date() });
          setStatus('connecting');
          break;

        case 'metadata':
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
          // Append token to buffer
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
            metadata: state.metadata!,
          });
          
          // Cleanup
          eventSourceRef.current?.close();
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
          }
          break;

        case 'error':
          const error: StreamError = {
            code: data.code || 'UNKNOWN',
            message: data.message || 'Une erreur est survenue',
            retryable: data.retryable ?? true,
          };
          
          setState(prev => ({
            ...prev,
            status: 'error',
            error,
          }));
          
          onError?.(error);
          
          // Mark current step as error
          setState(prev => ({
            ...prev,
            steps: prev.steps.map(step => 
              step.status === 'active' ? { ...step, status: 'error' } : step
            ),
          }));
          
          eventSourceRef.current?.close();
          break;

        case 'heartbeat':
          // Keep-alive, ignore
          break;
      }
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  }, [calculateProgress, onComplete, onError, onToken, setStatus, state.metadata, updateStep]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎮 ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  const start = useCallback(() => {
    if (!videoId) return;
    
    // Reset state
    textBufferRef.current = '';
    retryCountRef.current = 0;
    pausedRef.current = false;
    pauseBufferRef.current = [];

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
      setState(prev => ({
        ...prev,
        duration: prev.startedAt 
          ? Math.floor((Date.now() - prev.startedAt.getTime()) / 1000)
          : 0,
      }));
    }, 1000);

    // Build SSE URL
    const params = new URLSearchParams({
      mode,
      lang,
      model,
      web_enrich: String(webEnrich),
    });
    
    const token = getAccessToken();
    if (token) {
      params.set('token', token);
    }

    const url = `${API_URL}/api/videos/stream/${videoId}?${params}`;

    // Close existing connection
    eventSourceRef.current?.close();

    // Create new EventSource
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Set up event listeners for all event types
    const eventTypes = [
      'connected', 'metadata', 'transcript', 'transcript_complete',
      'analysis_start', 'token', 'analysis_complete', 'complete',
      'error', 'heartbeat'
    ];

    eventTypes.forEach(type => {
      eventSource.addEventListener(type, handleEvent);
    });

    // Handle connection errors
    eventSource.onerror = (e) => {
      console.error('SSE connection error:', e);
      
      if (retryCountRef.current < maxRetries && !pausedRef.current) {
        retryCountRef.current++;
        setTimeout(() => {
          if (eventSourceRef.current === eventSource) {
            start();
          }
        }, 1000 * Math.pow(2, retryCountRef.current));
      } else {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: {
            code: 'CONNECTION_ERROR',
            message: 'Connexion perdue. Veuillez réessayer.',
            retryable: true,
          },
        }));
        eventSource.close();
      }
    };

    updateStep('connect', { status: 'active', startedAt: new Date() });
  }, [videoId, mode, lang, model, webEnrich, maxRetries, handleEvent, updateStep]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setStatus('paused');
  }, [setStatus]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    
    // Process buffered events
    while (pauseBufferRef.current.length > 0) {
      const eventData = pauseBufferRef.current.shift()!;
      handleEvent({ data: eventData, type: 'message' } as MessageEvent);
    }
    
    setStatus('analyzing');
  }, [handleEvent, setStatus]);

  const cancel = useCallback(() => {
    eventSourceRef.current?.close();
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setStatus('cancelled');
  }, [setStatus]);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    textBufferRef.current = '';
    retryCountRef.current = 0;
    pausedRef.current = false;
    pauseBufferRef.current = [];

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔄 EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════════

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && videoId) {
      start();
    }
    
    return () => {
      eventSourceRef.current?.close();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [autoStart, videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📤 RETURN
  // ═══════════════════════════════════════════════════════════════════════════════

  const actions: AnalysisStreamActions = useMemo(() => ({
    start,
    pause,
    resume,
    cancel,
    reset,
  }), [start, pause, resume, cancel, reset]);

  return [state, actions];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook pour afficher le texte avec un effet de typing cursor
 */
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

/**
 * Hook pour formater la durée en temps lisible
 */
export function useFormattedDuration(seconds: number): string {
  return useMemo(() => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }, [seconds]);
}
