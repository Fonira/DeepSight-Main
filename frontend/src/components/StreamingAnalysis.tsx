/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📡 StreamingAnalysis — Composant d'Affichage Streaming en Temps Réel              ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FONCTIONNALITÉS:                                                                  ║
 * ║  • 📊 Progress stepper avec animations                                            ║
 * ║  • ✍️ Affichage texte avec effet typewriter                                       ║
 * ║  • ⏸️ Contrôles pause/resume/cancel                                               ║
 * ║  • 🎨 Thème adaptatif (light/dark)                                                ║
 * ║  • ♿ Accessible (ARIA labels, screen reader support)                             ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  
  CheckCircle2, 
  XCircle, 
  Pause, 
  Play, 
  X,
  RefreshCw,
  Wifi,
  FileText,
  Brain,
  Sparkles,
  Clock,
  AlertCircle
} from 'lucide-react';
import { DeepSightSpinner, DeepSightSpinnerMicro, DeepSightSpinnerSmall } from './ui';
import { 
  useAnalysisStream, 
  StreamStatus, 
  StreamStep,
  AnalysisStreamOptions,
  useFormattedDuration
} from '../hooks/useAnalysisStream';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface StreamingAnalysisProps {
  /** ID de la vidéo YouTube à analyser */
  videoId: string;
  /** Mode d'analyse */
  mode?: 'accessible' | 'standard' | 'expert';
  /** Langue de sortie */
  lang?: 'fr' | 'en';
  /** Modèle AI */
  model?: string;
  /** Enrichissement web */
  webEnrich?: boolean;
  /** Callback quand l'analyse est complète */
  onComplete?: (data: { summaryId: number; text: string }) => void;
  /** Callback en cas d'erreur */
  onError?: (error: { code: string; message: string }) => void;
  /** Callback pour annulation */
  onCancel?: () => void;
  /** Démarrer automatiquement */
  autoStart?: boolean;
  /** Afficher les métadonnées de la vidéo */
  showMetadata?: boolean;
  /** Hauteur maximale du conteneur de texte */
  maxHeight?: string;
  /** Classe CSS additionnelle */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 STEP ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const STEP_ICONS: Record<string, React.ElementType> = {
  connect: Wifi,
  metadata: FileText,
  transcript: FileText,
  analysis: Brain,
  complete: Sparkles,
};

const STEP_LABELS: Record<string, Record<'fr' | 'en', string>> = {
  connect: { fr: 'Connexion', en: 'Connecting' },
  metadata: { fr: 'Métadonnées', en: 'Metadata' },
  transcript: { fr: 'Transcription', en: 'Transcript' },
  analysis: { fr: 'Analyse IA', en: 'AI Analysis' },
  complete: { fr: 'Finalisation', en: 'Finalizing' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface StepIndicatorProps {
  step: StreamStep;
  isLast: boolean;
  lang: 'fr' | 'en';
}

const StepIndicator = memo<StepIndicatorProps>(({ step, isLast, lang }) => {
  const Icon = STEP_ICONS[step.id] || FileText;
  const label = STEP_LABELS[step.id]?.[lang] || step.label;
  
  const statusClasses = {
    pending: 'bg-bg-tertiary text-text-muted',
    active: 'bg-accent-primary/20 text-accent-primary animate-pulse',
    complete: 'bg-green-500/20 text-green-500',
    error: 'bg-red-500/20 text-red-500',
  };
  
  const lineClasses = {
    pending: 'bg-border-default',
    active: 'bg-accent-primary/50',
    complete: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center">
      {/* Step Circle */}
      <div className="relative flex flex-col items-center">
        <div 
          className={`
            w-10 h-10 rounded-full flex items-center justify-center
            transition-all duration-300 ease-out
            ${statusClasses[step.status]}
          `}
          role="status"
          aria-label={`${label}: ${step.status}`}
        >
          {step.status === 'active' ? (
            <DeepSightSpinnerMicro />
          ) : step.status === 'complete' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : step.status === 'error' ? (
            <XCircle className="w-5 h-5" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
        
        {/* Label */}
        <span className={`
          mt-2 text-xs font-medium transition-colors
          ${step.status === 'active' ? 'text-accent-primary' : 
            step.status === 'complete' ? 'text-green-500' :
            step.status === 'error' ? 'text-red-500' : 'text-text-muted'}
        `}>
          {label}
        </span>
      </div>
      
      {/* Connector Line */}
      {!isLast && (
        <div 
          className={`
            w-12 h-0.5 mx-2 transition-colors duration-500
            ${lineClasses[step.status]}
          `}
          aria-hidden="true"
        />
      )}
    </div>
  );
});

StepIndicator.displayName = 'StepIndicator';

// ═══════════════════════════════════════════════════════════════════════════════

interface ProgressBarProps {
  progress: number;
  status: StreamStatus;
}

const ProgressBar = memo<ProgressBarProps>(({ progress, status }) => {
  const colorClass = status === 'error' 
    ? 'bg-red-500' 
    : status === 'complete' 
      ? 'bg-green-500' 
      : 'bg-accent-primary';

  return (
    <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-300 ease-out ${colorClass}`}
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

// ═══════════════════════════════════════════════════════════════════════════════

interface TypewriterTextProps {
  text: string;
  isStreaming: boolean;
  maxHeight?: string;
}

const TypewriterText = memo<TypewriterTextProps>(({ text, isStreaming, maxHeight = '400px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new text arrives
  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  return (
    <div 
      ref={containerRef}
      className="overflow-y-auto scroll-smooth"
      style={{ maxHeight }}
    >
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {text.split('\n').map((paragraph, i) => (
          <p key={i} className="mb-4 last:mb-0">
            {paragraph}
            {/* Cursor on last paragraph while streaming */}
            {isStreaming && i === text.split('\n').length - 1 && (
              <span className="inline-block w-2 h-5 ml-1 bg-accent-primary animate-pulse" />
            )}
          </p>
        ))}
        
        {/* Empty state cursor */}
        {!text && isStreaming && (
          <span className="inline-block w-2 h-5 bg-accent-primary animate-pulse" />
        )}
      </div>
    </div>
  );
});

TypewriterText.displayName = 'TypewriterText';

// ═══════════════════════════════════════════════════════════════════════════════

interface ControlButtonsProps {
  status: StreamStatus;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  lang: 'fr' | 'en';
}

const ControlButtons = memo<ControlButtonsProps>(({ 
  status, 
  onPause, 
  onResume, 
  onCancel, 
  onRetry,
  lang 
}) => {
  const isActive = ['connecting', 'metadata', 'transcript', 'analyzing'].includes(status);
  const isPaused = status === 'paused';
  const isError = status === 'error';
  
  const labels = {
    pause: lang === 'fr' ? 'Pause' : 'Pause',
    resume: lang === 'fr' ? 'Reprendre' : 'Resume',
    cancel: lang === 'fr' ? 'Annuler' : 'Cancel',
    retry: lang === 'fr' ? 'Réessayer' : 'Retry',
  };

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {labels.retry}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          {labels.cancel}
        </button>
      </div>
    );
  }

  if (!isActive && !isPaused) return null;

  return (
    <div className="flex items-center gap-2">
      {isPaused ? (
        <button
          onClick={onResume}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white rounded-lg transition-colors"
          aria-label={labels.resume}
        >
          <Play className="w-4 h-4" />
          {labels.resume}
        </button>
      ) : (
        <button
          onClick={onPause}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded-lg transition-colors"
          aria-label={labels.pause}
        >
          <Pause className="w-4 h-4" />
          {labels.pause}
        </button>
      )}
      
      <button
        onClick={onCancel}
        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
        aria-label={labels.cancel}
      >
        <X className="w-4 h-4" />
        {labels.cancel}
      </button>
    </div>
  );
});

ControlButtons.displayName = 'ControlButtons';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const StreamingAnalysis: React.FC<StreamingAnalysisProps> = memo(({
  videoId,
  mode = 'standard',
  lang = 'fr',
  model,
  webEnrich = false,
  onComplete,
  onError,
  onCancel,
  autoStart = true,
  showMetadata = true,
  maxHeight = '400px',
  className = '',
}) => {
  const streamOptions: AnalysisStreamOptions = useMemo(() => ({
    mode,
    lang,
    model,
    webEnrich,
    onComplete,
    onError,
    autoStart,
  }), [mode, lang, model, webEnrich, onComplete, onError, autoStart]);

  const [state, actions] = useAnalysisStream(videoId, streamOptions);
  const formattedDuration = useFormattedDuration(state.duration);

  const handleCancel = useCallback(() => {
    actions.cancel();
    onCancel?.();
  }, [actions, onCancel]);

  const isStreaming = ['connecting', 'metadata', 'transcript', 'analyzing'].includes(state.status);
  const isComplete = state.status === 'complete';
  const isError = state.status === 'error';
  const isPaused = state.status === 'paused';

  // Status message
  const statusMessage = useMemo(() => {
    const messages: Record<StreamStatus, Record<'fr' | 'en', string>> = {
      idle: { fr: 'Prêt à analyser', en: 'Ready to analyze' },
      connecting: { fr: 'Connexion en cours...', en: 'Connecting...' },
      metadata: { fr: 'Récupération des métadonnées...', en: 'Fetching metadata...' },
      transcript: { fr: 'Transcription en cours...', en: 'Transcribing...' },
      analyzing: { fr: 'Analyse IA en cours...', en: 'AI analyzing...' },
      complete: { fr: 'Analyse terminée !', en: 'Analysis complete!' },
      error: { fr: 'Une erreur est survenue', en: 'An error occurred' },
      paused: { fr: 'En pause', en: 'Paused' },
      cancelled: { fr: 'Annulé', en: 'Cancelled' },
    };
    return messages[state.status]?.[lang] || '';
  }, [state.status, lang]);

  return (
    <div className={`bg-bg-elevated rounded-xl border border-border-default overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border-default">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Status Icon */}
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${isComplete ? 'bg-green-500/20 text-green-500' :
                isError ? 'bg-red-500/20 text-red-500' :
                'bg-accent-primary/20 text-accent-primary'}
            `}>
              {isStreaming || isPaused ? (
                <DeepSightSpinnerMicro />
              ) : isComplete ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Brain className="w-5 h-5" />
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-text-primary">{statusMessage}</h3>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Clock className="w-3 h-3" />
                <span>{formattedDuration}</span>
                <span>•</span>
                <span>{state.progress}%</span>
              </div>
            </div>
          </div>
          
          {/* Controls */}
          <ControlButtons
            status={state.status}
            onPause={actions.pause}
            onResume={actions.resume}
            onCancel={handleCancel}
            onRetry={actions.start}
            lang={lang}
          />
        </div>
        
        {/* Progress Bar */}
        <ProgressBar progress={state.progress} status={state.status} />
      </div>

      {/* Steps */}
      <div className="p-4 border-b border-border-default overflow-x-auto">
        <div className="flex items-start justify-center min-w-max">
          {state.steps.map((step, index) => (
            <StepIndicator
              key={step.id}
              step={step}
              isLast={index === state.steps.length - 1}
              lang={lang}
            />
          ))}
        </div>
      </div>

      {/* Metadata (optional) */}
      {showMetadata && state.metadata && (
        <div className="p-4 border-b border-border-default bg-bg-tertiary/50">
          <div className="flex items-center gap-4">
            {state.metadata.thumbnail && (
              <img 
                src={state.metadata.thumbnail} 
                alt=""
                className="w-24 h-14 object-cover rounded-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-text-primary truncate">
                {state.metadata.title}
              </h4>
              <p className="text-sm text-text-secondary truncate">
                {state.metadata.channel}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Error State */}
        {isError && state.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-500">
                  {lang === 'fr' ? 'Erreur' : 'Error'}: {state.error.code}
                </p>
                <p className="text-sm text-red-400 mt-1">
                  {state.error.message}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Text Content */}
        {(state.text || isStreaming) && (
          <TypewriterText 
            text={state.text} 
            isStreaming={isStreaming && !isPaused}
            maxHeight={maxHeight}
          />
        )}
        
        {/* Idle State */}
        {state.status === 'idle' && !state.text && (
          <div className="text-center py-8 text-text-muted">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>
              {lang === 'fr' 
                ? 'L\'analyse commencera automatiquement...' 
                : 'Analysis will start automatically...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

StreamingAnalysis.displayName = 'StreamingAnalysis';

export default StreamingAnalysis;
