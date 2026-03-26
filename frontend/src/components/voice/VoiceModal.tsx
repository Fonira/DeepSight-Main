/**
 * VoiceModal — Main voice conversation interface
 * Full-screen modal with live transcript, status indicators, and controls
 */

import React, { useEffect, useRef, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
  ArrowUpCircle,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  channelName?: string;
  /** Status de la conversation voice */
  voiceStatus: 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'quota_exceeded';
  /** L'IA est en train de parler */
  isSpeaking: boolean;
  /** Messages de la conversation (transcript live) */
  messages: Array<{ text: string; source: 'user' | 'ai' }>;
  /** Timer en secondes */
  elapsedSeconds: number;
  /** Minutes restantes dans le quota */
  remainingMinutes: number;
  /** Callbacks */
  onStart: () => void | Promise<void>;
  onStop: () => void | Promise<void>;
  onMuteToggle: () => void;
  isMuted: boolean;
  /** Erreur eventuelle */
  error?: string;
}

/** Format seconds to MM:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pulsing microphone indicator */
const PulsingMic: React.FC = () => (
  <div className="relative flex items-center justify-center">
    <motion.div
      className="absolute w-20 h-20 rounded-full bg-green-500/20"
      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.1, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute w-14 h-14 rounded-full bg-green-500/30"
      animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.2, 0.6] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
    />
    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center z-10">
      <Mic className="w-5 h-5 text-white" />
    </div>
  </div>
);

/** Animated thinking dots */
const ThinkingDots: React.FC = () => (
  <div className="flex items-center gap-1.5">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2.5 h-2.5 rounded-full bg-indigo-400"
        animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

/** Sound wave bars for speaking state */
const SoundWave: React.FC = () => (
  <div className="flex items-center gap-1 h-10">
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <motion.div
        key={i}
        className="w-1 rounded-full bg-violet-400"
        animate={{ height: [8, 24 + Math.random() * 16, 8] }}
        transition={{
          duration: 0.6 + Math.random() * 0.4,
          repeat: Infinity,
          delay: i * 0.08,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  videoTitle,
  channelName,
  voiceStatus,
  isSpeaking: _isSpeaking,
  messages,
  elapsedSeconds,
  remainingMinutes,
  onStart,
  onStop,
  onMuteToggle,
  isMuted,
  error,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const { language } = useTranslation();

  const tr = useCallback(
    (fr: string, en: string) => (language === 'fr' ? fr : en),
    [language]
  );

  // Wrap async callbacks to prevent unhandled promise rejections
  const safeStart = useCallback(() => {
    try { Promise.resolve(onStart()).catch(() => {}); } catch { /* handled internally */ }
  }, [onStart]);

  const safeStop = useCallback(() => {
    try { Promise.resolve(onStop()).catch(() => {}); } catch { /* handled internally */ }
  }, [onStop]);

  const isActive = voiceStatus === 'listening' || voiceStatus === 'thinking' || voiceStatus === 'speaking';
  const remainingFormatted = formatTime(remainingMinutes * 60);

  // Body scroll lock + focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
    } else {
      document.body.style.overflow = 'unset';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Escape key + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const renderCenterContent = () => {
    switch (voiceStatus) {
      case 'idle':
        return (
          <motion.button
            onClick={safeStart}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-lg shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5" />
              {tr('Demarrer la conversation', 'Start conversation')}
            </div>
          </motion.button>
        );

      case 'connecting':
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-white/60 text-sm">
              {tr('Connexion en cours...', 'Connecting...')}
            </p>
          </div>
        );

      case 'listening':
        return (
          <div className="flex flex-col items-center gap-4">
            <PulsingMic />
            <p className="text-green-400 text-sm font-medium">
              {tr("A l'ecoute...", 'Listening...')}
            </p>
          </div>
        );

      case 'thinking':
        return (
          <div className="flex flex-col items-center gap-4">
            <ThinkingDots />
            <p className="text-indigo-300 text-sm">
              {tr('Reflexion...', 'Thinking...')}
            </p>
          </div>
        );

      case 'speaking':
        return (
          <div className="flex flex-col items-center gap-4">
            <SoundWave />
            <p className="text-violet-300 text-sm font-medium">
              {tr('DeepSight parle...', 'DeepSight is speaking...')}
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-red-300 text-sm">
              {error || tr('Une erreur est survenue', 'An error occurred')}
            </p>
            <button
              onClick={safeStart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors text-sm focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <RotateCcw className="w-4 h-4" />
              {tr('Reessayer', 'Retry')}
            </button>
          </div>
        );

      case 'quota_exceeded':
        return (
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-amber-300 text-sm font-medium">
              {tr('Quota de minutes epuise', 'Voice minutes quota exceeded')}
            </p>
            <p className="text-white/40 text-xs">
              {tr(
                'Passez au plan superieur pour continuer vos conversations vocales.',
                'Upgrade your plan to continue voice conversations.'
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <ArrowUpCircle className="w-4 h-4" />
                {tr('Passer au plan superieur', 'Upgrade plan')}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[#0a0a0f]/95 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            className="relative z-10 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[720px] sm:mx-4 sm:rounded-2xl bg-white/5 backdrop-blur-xl border-0 sm:border sm:border-white/10 flex flex-col focus:outline-none overflow-hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id={descId} className="sr-only">
              {tr('Conversation vocale avec DeepSight', 'Voice conversation with DeepSight')}
            </p>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <h2
                  id={titleId}
                  className="text-sm sm:text-base font-semibold text-white truncate"
                  title={videoTitle}
                >
                  {videoTitle}
                </h2>
                {channelName && (
                  <p className="text-xs text-white/40 mt-0.5 truncate">{channelName}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href="/settings"
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-white/70 hover:bg-white/10 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-indigo-400"
                  title={tr('Paramètres voix', 'Voice settings')}
                >
                  <Settings2 className="w-4 h-4" />
                </a>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-indigo-400"
                  aria-label={tr('Fermer', 'Close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Center — status zone */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-[200px]">
              {renderCenterContent()}
            </div>

            {/* Transcript zone */}
            {messages.length > 0 && (
              <div
                ref={transcriptRef}
                className="mx-4 mb-3 max-h-[200px] overflow-y-auto rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3 scroll-smooth"
                aria-label={tr('Transcription de la conversation', 'Conversation transcript')}
                role="log"
                aria-live="polite"
              >
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.source === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        msg.source === 'user'
                          ? 'bg-indigo-500/20 border border-indigo-500/20 text-indigo-100'
                          : 'bg-white/5 border border-white/10 text-white/80'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer — controls */}
            {isActive && (
              <motion.div
                className="flex items-center justify-between px-5 py-4 border-t border-white/5 flex-shrink-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {/* Mute toggle */}
                <button
                  onClick={onMuteToggle}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    isMuted
                      ? 'bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25'
                      : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  aria-label={isMuted ? tr('Reactiver le micro', 'Unmute microphone') : tr('Couper le micro', 'Mute microphone')}
                >
                  {isMuted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
                </button>

                {/* Timer */}
                <div className="flex flex-col items-center">
                  <span className="text-white font-mono text-lg font-medium tabular-nums">
                    {formatTime(elapsedSeconds)}
                  </span>
                  <span className="text-white/30 text-[10px] font-mono tabular-nums">
                    / {remainingFormatted} {tr('restantes', 'remaining')}
                  </span>
                </div>

                {/* End call */}
                <button
                  onClick={safeStop}
                  className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label={tr('Terminer la conversation', 'End conversation')}
                >
                  <PhoneOff className="w-4.5 h-4.5" />
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default VoiceModal;
