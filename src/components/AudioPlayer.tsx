/**
 * 🎙️ AUDIO PLAYER v2.0 — Lecteur audio pour résumés Deep Sight
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Lecteur audio élégant avec:
 * - Contrôles play/pause, volume, vitesse
 * - Barre de progression cliquable
 * - Choix de la voix (warm, calm, soft, narrative)
 * - Choix du provider (auto, openai HD pour Pro/Expert)
 * - Téléchargement MP3
 * - Animation pendant la génération
 * 
 * Providers:
 * - Auto: ElevenLabs avec fallback OpenAI (Starter+)
 * - OpenAI HD: Voix OpenAI haute qualité (Pro/Expert uniquement)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Download, 
  Loader2, Mic, AlertCircle, RotateCcw,
  ChevronDown, Headphones, Sparkles, Crown, Zap, Radio
} from 'lucide-react';
import { ttsApi, VoiceStyle, TTSProvider, TTSEstimate } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AudioPlayerProps {
  /** ID du résumé à lire */
  summaryId?: number;
  /** ID de la playlist (pour méta-analyse) */
  playlistId?: string;
  /** Texte libre à convertir */
  text?: string;
  /** Titre affiché */
  title?: string;
  /** Langue du contenu */
  language?: 'fr' | 'en';
  /** Style compact ou full */
  variant?: 'compact' | 'full' | 'mini';
  /** Callback quand l'audio est prêt */
  onReady?: () => void;
  /** Callback en cas d'erreur */
  onError?: (error: string) => void;
  /** Classes CSS additionnelles */
  className?: string;
}

interface VoiceOption {
  id: VoiceStyle;
  name: string;
  description: string;
  icon: string;
}

interface ProviderOption {
  id: TTSProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresPro: boolean;
  badge?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'warm', name: 'Rachel', description: 'Chaleureuse', icon: '🌸' },
  { id: 'calm', name: 'Drew', description: 'Calme', icon: '🌿' },
  { id: 'soft', name: 'Bella', description: 'Douce', icon: '🌙' },
  { id: 'narrative', name: 'Antoni', description: 'Narrateur', icon: '📖' },
];

const PROVIDER_OPTIONS: ProviderOption[] = [
  { 
    id: 'auto', 
    name: 'Auto', 
    description: 'ElevenLabs + fallback', 
    icon: <Radio className="w-4 h-4" />,
    requiresPro: false 
  },
  { 
    id: 'openai', 
    name: 'OpenAI HD', 
    description: 'Voix premium OpenAI', 
    icon: <Zap className="w-4 h-4" />,
    requiresPro: true,
    badge: 'PRO'
  },
];

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  summaryId,
  playlistId,
  text,
  title = 'Résumé audio',
  language = 'fr',
  variant = 'full',
  onReady,
  onError,
  className = '',
}) => {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // États
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedVoice, setSelectedVoice] = useState<VoiceStyle>('warm');
  const [selectedProvider, setSelectedProvider] = useState<TTSProvider>('auto');
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<TTSEstimate | null>(null);

  // Vérifier si l'utilisateur peut utiliser TTS
  const canUseTTS = user?.plan !== 'free';
  // Vérifier si l'utilisateur peut utiliser OpenAI HD (Pro/Expert)
  const canUseOpenAI = user?.plan === 'pro' || user?.plan === 'expert';

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎙️ GÉNÉRATION AUDIO
  // ═══════════════════════════════════════════════════════════════════════════════

  const generateAudio = useCallback(async () => {
    if (!canUseTTS) {
      setError('Abonnement requis pour la synthèse vocale');
      return;
    }

    // Vérifier l'accès au provider OpenAI
    if (selectedProvider === 'openai' && !canUseOpenAI) {
      setError('OpenAI HD est réservé aux abonnés Pro et Expert');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let url: string;

      if (summaryId) {
        url = await ttsApi.generateSummaryAudio(summaryId, selectedVoice, selectedProvider);
      } else if (playlistId) {
        url = await ttsApi.generatePlaylistAudio(playlistId, selectedVoice);
      } else if (text) {
        url = await ttsApi.generateFromText(text, language, selectedVoice);
      } else {
        throw new Error('Aucun contenu à convertir');
      }

      // Libérer l'ancienne URL si existante
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      setAudioUrl(url);
      onReady?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de génération';
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  }, [summaryId, playlistId, text, language, selectedVoice, selectedProvider, canUseTTS, canUseOpenAI, audioUrl, onReady, onError]);

  // Charger l'estimation au montage
  useEffect(() => {
    const loadEstimate = async () => {
      if (summaryId) {
        try {
          const est = await ttsApi.estimateSummary(summaryId);
          setEstimate(est);
        } catch {
          // Ignore
        }
      }
    };
    loadEstimate();
  }, [summaryId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎮 CONTRÔLES AUDIO
  // ═══════════════════════════════════════════════════════════════════════════════

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration;
    setCurrentTime(current);
    setProgress((current / total) * 100);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setProgress(percent * 100);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const changeSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `deepsight_${title.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.mp3`;
    a.click();
  }, [audioUrl, title]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDU - VERSION MINI
  // ═══════════════════════════════════════════════════════════════════════════════

  if (variant === 'mini') {
    return (
      <button
        onClick={audioUrl ? togglePlay : generateAudio}
        disabled={isLoading || !canUseTTS}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          canUseTTS
            ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
            : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
        } ${className}`}
        title={canUseTTS ? 'Écouter le résumé' : 'Abonnement requis'}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Headphones className="w-4 h-4" />
        )}
        {isLoading ? 'Génération...' : isPlaying ? 'Pause' : 'Écouter'}
        {!canUseTTS && <Crown className="w-3 h-3 text-amber-400" />}
        
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
          />
        )}
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDU - VERSION COMPACTE
  // ═══════════════════════════════════════════════════════════════════════════════

  if (variant === 'compact') {
    return (
      <div className={`bg-bg-tertiary rounded-xl p-4 ${className}`}>
        {!canUseTTS ? (
          <div className="flex items-center gap-3 text-text-secondary">
            <Crown className="w-5 h-5 text-amber-400" />
            <span className="text-sm">Abonnement Starter ou Pro requis</span>
          </div>
        ) : !audioUrl ? (
          <button
            onClick={generateAudio}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-medium transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Génération en cours...</span>
                <Sparkles className="w-4 h-4 animate-pulse" />
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>🎙️ Écouter le résumé</span>
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Contrôles */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center bg-purple-500 hover:bg-purple-400 rounded-full text-white transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              
              {/* Barre de progression */}
              <div 
                className="flex-1 h-2 bg-bg-hover rounded-full cursor-pointer overflow-hidden"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {/* Temps */}
              <span className="text-xs text-text-tertiary w-16 text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDU - VERSION COMPLÈTE
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className={`bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded-2xl p-6 border border-border-subtle ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{title}</h3>
            <p className="text-xs text-text-tertiary">
              {estimate 
                ? `~${Math.ceil(estimate.estimated_duration_seconds / 60)} min`
                : 'Synthèse vocale ElevenLabs'}
            </p>
          </div>
        </div>

        {!canUseTTS && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-lg">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-300">Pro</span>
          </div>
        )}
      </div>

      {/* Contenu principal */}
      {!canUseTTS ? (
        <div className="text-center py-8">
          <Crown className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-text-secondary mb-2">Fonctionnalité Premium</p>
          <p className="text-sm text-text-tertiary mb-4">
            La synthèse vocale est réservée aux abonnés Starter et Pro
          </p>
          <a
            href="/upgrade"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-white font-medium hover:opacity-90 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Passer à Pro
          </a>
        </div>
      ) : !audioUrl ? (
        <div className="space-y-4">
          {/* Sélection du provider (Pro/Expert) */}
          {canUseOpenAI && (
            <div className="relative">
              <button
                onClick={() => setShowProviderMenu(!showProviderMenu)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30 hover:border-amber-500/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    {PROVIDER_OPTIONS.find(p => p.id === selectedProvider)?.icon}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">
                        {PROVIDER_OPTIONS.find(p => p.id === selectedProvider)?.name}
                      </p>
                      {selectedProvider === 'openai' && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                          PRO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary">
                      {PROVIDER_OPTIONS.find(p => p.id === selectedProvider)?.description}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showProviderMenu ? 'rotate-180' : ''}`} />
              </button>

              {showProviderMenu && (
                <div className="absolute z-20 w-full mt-2 bg-bg-elevated rounded-xl border border-border-subtle shadow-xl overflow-hidden">
                  {PROVIDER_OPTIONS.map((provider) => {
                    const isAvailable = !provider.requiresPro || canUseOpenAI;
                    return (
                      <button
                        key={provider.id}
                        onClick={() => {
                          if (isAvailable) {
                            setSelectedProvider(provider.id);
                            setShowProviderMenu(false);
                          }
                        }}
                        disabled={!isAvailable}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-all ${
                          selectedProvider === provider.id ? 'bg-amber-500/10' : ''
                        } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className={`p-2 rounded-lg ${provider.id === 'openai' ? 'bg-amber-500/20' : 'bg-bg-tertiary'}`}>
                          {provider.icon}
                        </div>
                        <div className="text-left flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-text-primary">{provider.name}</p>
                            {provider.badge && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                                {provider.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-tertiary">{provider.description}</p>
                        </div>
                        {selectedProvider === provider.id && (
                          <div className="w-2 h-2 bg-amber-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sélection de la voix */}
          <div className="relative">
            <button
              onClick={() => setShowVoiceMenu(!showVoiceMenu)}
              className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary rounded-xl border border-border-subtle hover:border-purple-500/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.icon}
                </span>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-primary">
                    {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.description}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${showVoiceMenu ? 'rotate-180' : ''}`} />
            </button>

            {showVoiceMenu && (
              <div className="absolute z-20 w-full mt-2 bg-bg-elevated rounded-xl border border-border-subtle shadow-xl overflow-hidden">
                {VOICE_OPTIONS.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => {
                      setSelectedVoice(voice.id);
                      setShowVoiceMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-all ${
                      selectedVoice === voice.id ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    <span className="text-lg">{voice.icon}</span>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-text-primary">{voice.name}</p>
                      <p className="text-xs text-text-tertiary">{voice.description}</p>
                    </div>
                    {selectedVoice === voice.id && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bouton générer */}
          <button
            onClick={generateAudio}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl text-white font-semibold text-lg transition-all disabled:opacity-50 shadow-lg ${
              selectedProvider === 'openai' 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/25'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-purple-500/25'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>
                  {selectedProvider === 'openai' ? 'Génération OpenAI HD...' : 'Génération audio...'}
                </span>
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                <span>
                  {selectedProvider === 'openai' ? '✨ Générer (OpenAI HD)' : '🎙️ Générer l\'audio'}
                </span>
              </>
            )}
          </button>

          {estimate && (
            <p className="text-center text-xs text-text-tertiary">
              Durée estimée : ~{Math.ceil(estimate.estimated_duration_seconds / 60)} min
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lecteur */}
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-400 hover:to-blue-400 rounded-full text-white shadow-lg shadow-purple-500/30 transition-all"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>

            {/* Barre de progression */}
            <div className="flex-1">
              <div 
                className="h-3 bg-bg-hover rounded-full cursor-pointer overflow-hidden group"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-text-tertiary">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Contrôles secondaires */}
          <div className="flex items-center justify-between">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-text-secondary hover:text-text-primary transition-colors">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-bg-hover rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Vitesse */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 px-3 py-1.5 bg-bg-tertiary rounded-lg text-sm text-text-secondary hover:text-text-primary transition-all"
              >
                {playbackSpeed}x
                <ChevronDown className={`w-3 h-3 transition-transform ${showSpeedMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showSpeedMenu && (
                <div className="absolute z-20 bottom-full mb-2 right-0 bg-bg-elevated rounded-lg border border-border-subtle shadow-xl overflow-hidden">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => changeSpeed(speed)}
                      className={`block w-full px-4 py-2 text-sm text-left hover:bg-bg-hover transition-all ${
                        playbackSpeed === speed ? 'text-purple-400 bg-purple-500/10' : 'text-text-secondary'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAudioUrl(null);
                  setProgress(0);
                  setCurrentTime(0);
                }}
                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-all"
                title="Régénérer avec une autre voix"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-all"
                title="Télécharger MP3"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
