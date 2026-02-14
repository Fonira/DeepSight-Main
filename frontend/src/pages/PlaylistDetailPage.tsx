/**
 * 🎬 DEEP SIGHT — Playlist/Corpus Detail Page v2.0
 *
 * Page complète pour naviguer dans un corpus analysé :
 * - Vidéos : liste avec statut, clic → détail inline
 * - Synthèse : méta-analyse générée par l'IA
 * - Chat IA : poser des questions sur l'ensemble du corpus
 * - Stats : graphiques et distribution
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import {
  playlistApi,
  type PlaylistFullResponse,
  type PlaylistVideoItem,
  type PlaylistDetailsResponse,
  type CorpusChatMessage,
  type CorpusChatResponse,
} from '../services/api';
import {
  ListVideo, Loader2, AlertCircle, Clock, ArrowLeft,
  ChevronRight, ChevronLeft, CheckCircle, XCircle,
  RefreshCw, Sparkles, BarChart3, PieChart, TrendingUp,
  FileText, Video, Tag, Layers, MessageSquare,
  Target, Send, Trash2, Bot, User, BookOpen,
  ExternalLink, Hash,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

type TabId = 'videos' | 'synthesis' | 'chat' | 'stats';

interface PlaylistStats {
  totalVideos: number;
  analyzedCount: number;
  totalDuration: number;
  totalWords: number;
  averageReliability: number;
  categories: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  durationDistribution: Array<{ range: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${s}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const CATEGORY_COLORS: Record<string, string> = {
  education: '#10B981', technology: '#3B82F6', business: '#8B5CF6',
  science: '#06B6D4', entertainment: '#F59E0B', news: '#EF4444',
  gaming: '#EC4899', music: '#6366F1', sports: '#14B8A6',
  health: '#22C55E', lifestyle: '#F97316', other: '#6B7280',
};

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
}> = ({ icon, label, value, sublabel, color = 'text-accent-primary' }) => (
  <div className="card p-4 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl bg-bg-tertiary flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary">{label}</p>
      {sublabel && <p className="text-xs text-text-muted">{sublabel}</p>}
    </div>
  </div>
);

const CategoryChart: React.FC<{
  categories: Record<string, number>;
  language: string;
}> = ({ categories, language }) => {
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const total = sortedCategories.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
        <PieChart className="w-5 h-5 text-violet-400" />
        {language === 'fr' ? 'Répartition par catégorie' : 'Category Distribution'}
      </h3>
      <div className="space-y-3">
        {sortedCategories.map(([category, count]) => {
          const percent = Math.round((count / total) * 100);
          const color = CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.other;
          return (
            <div key={category}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary capitalize">{category}</span>
                <span className="text-text-muted">{count} ({percent}%)</span>
              </div>
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DurationChart: React.FC<{
  distribution: Array<{ range: string; count: number }>;
  language: string;
}> = ({ distribution, language }) => {
  const maxCount = Math.max(...distribution.map(d => d.count), 1);
  if (distribution.length === 0) return null;

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        {language === 'fr' ? 'Distribution par durée' : 'Duration Distribution'}
      </h3>
      <div className="flex items-end gap-2 h-32">
        {distribution.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-500"
              style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: item.count > 0 ? '8px' : '0' }}
            />
            <span className="text-xs text-text-muted mt-2 text-center">{item.range}</span>
            <span className="text-xs text-text-secondary">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Video List Item ──────────────────────────────────────────────────────────

const VideoListItem: React.FC<{
  video: PlaylistVideoItem;
  isAnalyzed: boolean;
  isActive: boolean;
  onClick: () => void;
  language: string;
  position?: number;
}> = ({ video, isAnalyzed, isActive, onClick, language, position }) => (
  <div
    className={`p-4 transition-all cursor-pointer border-b border-border-subtle last:border-b-0 ${
      isActive
        ? 'bg-accent-primary/10 border-l-4 border-l-accent-primary'
        : 'hover:bg-bg-secondary/50'
    }`}
    onClick={onClick}
  >
    <div className="flex items-center gap-4">
      {/* Position */}
      {position !== undefined && (
        <span className="text-sm font-mono text-text-muted w-6 text-center flex-shrink-0">
          {position}
        </span>
      )}

      {/* Thumbnail */}
      <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden bg-bg-tertiary">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-6 h-6 text-text-muted" />
          </div>
        )}
        {video.video_duration && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
            {formatDuration(video.video_duration)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-text-primary truncate">{video.video_title}</h4>
        <p className="text-sm text-text-secondary truncate">{video.video_channel}</p>
        <div className="flex items-center gap-2 mt-1">
          {isAnalyzed ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="w-3 h-3" />
              {language === 'fr' ? 'Analysé' : 'Analyzed'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              <Loader2 className="w-3 h-3" />
              {language === 'fr' ? 'En attente' : 'Pending'}
            </span>
          )}
          {video.category && (
            <span className="text-xs text-text-muted capitalize">• {video.category}</span>
          )}
          {video.reliability_score != null && (
            <span className={`text-xs ${
              video.reliability_score >= 70 ? 'text-green-400' :
              video.reliability_score >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              • {Math.round(video.reliability_score * 100)}% fiable
            </span>
          )}
        </div>
      </div>

      <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform ${
        isActive ? 'text-accent-primary rotate-90' : 'text-text-muted'
      }`} />
    </div>
  </div>
);

// ── Video Detail Panel (inline) ──────────────────────────────────────────────

const VideoDetailPanel: React.FC<{
  video: PlaylistVideoItem;
  playlistId: string;
  onClose: () => void;
  onOpenInDashboard: () => void;
  language: string;
}> = ({ video, playlistId, onClose, onOpenInDashboard, language }) => {
  return (
    <div className="card border-l-4 border-l-accent-primary animate-in slide-in-from-top-2">
      {/* Header */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-tertiary transition-colors">
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <h3 className="font-semibold text-text-primary text-lg">{video.video_title}</h3>
            <p className="text-sm text-text-secondary">{video.video_channel} • {formatDuration(video.video_duration || 0)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {video.video_url && (
            <a
              href={video.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              YouTube
            </a>
          )}
          <button onClick={onOpenInDashboard} className="btn btn-primary text-sm">
            <BookOpen className="w-4 h-4" />
            {language === 'fr' ? 'Vue complète' : 'Full view'}
          </button>
        </div>
      </div>

      {/* Metadata badges */}
      <div className="p-4 border-b border-border-subtle flex flex-wrap gap-2">
        {video.category && (
          <span className="px-2 py-1 bg-violet-500/20 text-violet-400 rounded-full text-xs capitalize">
            {video.category}
          </span>
        )}
        {video.mode && (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
            Mode: {video.mode}
          </span>
        )}
        {video.word_count && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
            {formatNumber(video.word_count)} mots
          </span>
        )}
        {video.reliability_score != null && (
          <span className={`px-2 py-1 rounded-full text-xs ${
            video.reliability_score >= 0.7 ? 'bg-green-500/20 text-green-400' :
            video.reliability_score >= 0.5 ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            Fiabilité: {Math.round(video.reliability_score * 100)}%
          </span>
        )}
        {video.tags && video.tags.split(',').filter(Boolean).map((tag, i) => (
          <span key={i} className="px-2 py-1 bg-bg-tertiary text-text-secondary rounded-full text-xs">
            #{tag.trim()}
          </span>
        ))}
      </div>

      {/* Summary Content */}
      <div className="p-6">
        {video.summary_content ? (
          <div className="prose prose-invert max-w-none text-text-secondary leading-relaxed">
            <ReactMarkdown>{video.summary_content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-8 text-text-muted">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{language === 'fr' ? 'Analyse non disponible' : 'Analysis not available'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Corpus Chat Component ────────────────────────────────────────────────────

const CorpusChat: React.FC<{
  playlistId: string;
  playlistTitle: string;
  language: string;
}> = ({ playlistId, playlistTitle, language }) => {
  const [messages, setMessages] = useState<CorpusChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await playlistApi.getChatHistory(playlistId, 50);
        setMessages(data.messages || []);
      } catch {
        // No history yet, that's fine
      } finally {
        setIsFetchingHistory(false);
      }
    };
    loadHistory();
  }, [playlistId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: CorpusChatMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await playlistApi.chatWithCorpus(playlistId, trimmed, {
        lang: language,
        mode: 'standard',
      });

      const assistantMsg: CorpusChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.response,
        created_at: new Date().toISOString(),
        sources: response.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const msg = err?.message || '';
      let errorText: string;
      if (msg.includes('timeout') || msg.includes('Timeout') || msg === 'Request timeout') {
        errorText = language === 'fr'
          ? '⏳ Le serveur met trop de temps à répondre. Réessayez avec une question plus courte.'
          : '⏳ Server is taking too long. Try a shorter question.';
      } else if (msg.includes('Failed to fetch') || msg.includes('Network error')) {
        errorText = language === 'fr'
          ? '🔌 Erreur réseau — le serveur n\'a pas répondu. Réessayez dans quelques secondes.'
          : '🔌 Network error — server did not respond. Try again in a few seconds.';
      } else {
        errorText = msg || (language === 'fr' ? 'Erreur lors de la réponse' : 'Error getting response');
      }
      setError(errorText);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = async () => {
    try {
      await playlistApi.clearChatHistory(playlistId);
      setMessages([]);
    } catch {
      // Ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = language === 'fr' ? [
    'Quels sont les thèmes principaux abordés ?',
    'Quels points de vue divergent entre les vidéos ?',
    'Résume les conclusions les plus importantes.',
    'Quelles vidéos se contredisent ?',
  ] : [
    'What are the main themes covered?',
    'Which videos have divergent viewpoints?',
    'Summarize the most important conclusions.',
    'Which videos contradict each other?',
  ];

  if (isFetchingHistory) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary mx-auto mb-2" />
        <p className="text-text-muted">{language === 'fr' ? 'Chargement du chat...' : 'Loading chat...'}</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col" style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
      {/* Header */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-accent-primary" />
          <span className="font-semibold text-text-primary">
            {language === 'fr' ? 'Chat IA Corpus' : 'Corpus AI Chat'}
          </span>
          <span className="text-xs text-text-muted">— {playlistTitle}</span>
        </div>
        {messages.length > 0 && (
          <button onClick={handleClear} className="p-2 rounded hover:bg-bg-tertiary transition-colors text-text-muted hover:text-red-400" title={language === 'fr' ? 'Effacer l\'historique' : 'Clear history'}>
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-text-muted opacity-50" />
            <h3 className="font-semibold text-text-primary mb-2">
              {language === 'fr' ? 'Posez une question sur le corpus' : 'Ask a question about the corpus'}
            </h3>
            <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
              {language === 'fr'
                ? 'L\'IA a accès à toutes les synthèses et transcriptions du corpus pour vous répondre.'
                : 'The AI has access to all corpus summaries and transcriptions to answer you.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="px-3 py-2 bg-bg-tertiary hover:bg-bg-secondary text-text-secondary text-sm rounded-lg transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-accent-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl p-4 ${
                msg.role === 'user'
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-secondary text-text-secondary'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs font-medium mb-1 opacity-70">
                      {language === 'fr' ? 'Sources :' : 'Sources:'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {msg.sources.map((src, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-white/10 rounded-full">
                          {src.video_title} ({Math.round(src.relevance_score * 100)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-text-muted" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-accent-primary" />
            </div>
            <div className="bg-bg-secondary rounded-xl p-4">
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{language === 'fr' ? 'Analyse du corpus...' : 'Analyzing corpus...'}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-500/10 text-red-400 rounded-lg p-3 text-sm">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border-subtle">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={language === 'fr' ? 'Posez une question sur le corpus...' : 'Ask a question about the corpus...'}
            className="flex-1 resize-none bg-bg-secondary text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 border border-border-subtle focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 outline-none transition-colors"
            rows={1}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="btn btn-primary p-3 rounded-xl"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export const PlaylistDetailPage: React.FC = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  // Lire le query param ?tab=chat pour pré-sélectionner l'onglet
  const initialTab = (['videos', 'synthesis', 'chat', 'stats'].includes(searchParams.get('tab') || '')
    ? searchParams.get('tab') as TabId
    : 'videos');

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

  // Data State
  const [playlist, setPlaylist] = useState<PlaylistFullResponse | null>(null);
  const [details, setDetails] = useState<PlaylistDetailsResponse | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // ═══════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════

  const videos = playlist?.videos || [];

  const stats = useMemo<PlaylistStats>(() => {
    const analyzedVideos = videos.filter(v => !!v.summary_content);

    const categories: Record<string, number> = {};
    analyzedVideos.forEach(v => {
      const cat = v.category || 'other';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    const tagCounts: Record<string, number> = {};
    analyzedVideos.forEach(v => {
      const tags = v.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];
      tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    const durationRanges = [
      { range: '0-5m', min: 0, max: 300 },
      { range: '5-15m', min: 300, max: 900 },
      { range: '15-30m', min: 900, max: 1800 },
      { range: '30-60m', min: 1800, max: 3600 },
      { range: '60m+', min: 3600, max: Infinity },
    ];
    const durationDistribution = durationRanges.map(r => ({
      range: r.range,
      count: analyzedVideos.filter(v => (v.video_duration || 0) >= r.min && (v.video_duration || 0) < r.max).length,
    }));

    const reliabilityScores = analyzedVideos
      .filter(v => v.reliability_score != null)
      .map(v => v.reliability_score!);
    const averageReliability = reliabilityScores.length > 0
      ? Math.round(reliabilityScores.reduce((a, b) => a + b, 0) / reliabilityScores.length * 100)
      : 0;

    return {
      totalVideos: videos.length,
      analyzedCount: analyzedVideos.length,
      totalDuration: playlist?.total_duration || analyzedVideos.reduce((sum, v) => sum + (v.video_duration || 0), 0),
      totalWords: playlist?.total_words || analyzedVideos.reduce((sum, v) => sum + (v.word_count || 0), 0),
      averageReliability,
      categories,
      topTags,
      durationDistribution,
    };
  }, [videos, playlist]);

  const selectedVideo = useMemo(
    () => videos.find(v => v.id === selectedVideoId) || null,
    [videos, selectedVideoId]
  );

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  const loadPlaylistData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      // Appel du bon endpoint: GET /api/playlists/{id}
      const data = await playlistApi.get(id);
      setPlaylist(data);

      // Charger aussi les détails (stats enrichies)
      try {
        const detailsData = await playlistApi.getDetails(id);
        setDetails(detailsData);
      } catch {
        // Details endpoint optionnel
      }
    } catch (err: any) {
      console.error('Error loading playlist:', err);
      setError(
        language === 'fr'
          ? 'Erreur lors du chargement du corpus. Vérifiez que l\'analyse est terminée.'
          : 'Error loading corpus. Check that the analysis is complete.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [id, language]);

  useEffect(() => {
    loadPlaylistData();
  }, [loadPlaylistData]);

  // ═══════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  const handleRegenerateSynthesis = async () => {
    if (!id || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const result = await playlistApi.generateCorpusSummary(id, {
        mode: 'standard',
        lang: language,
      });
      // Mettre à jour la méta-analyse dans le state
      if (playlist) {
        setPlaylist({ ...playlist, meta_analysis: result.meta_analysis });
      }
      setActiveTab('synthesis');
    } catch (err: any) {
      console.error('Error generating synthesis:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleVideoClick = (videoId: number) => {
    if (selectedVideoId === videoId) {
      setSelectedVideoId(null);
    } else {
      setSelectedVideoId(videoId);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // TAB CONFIG
  // ═══════════════════════════════════════════════════════════════════

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; badge?: string }> = [
    {
      id: 'videos',
      label: language === 'fr' ? 'Vidéos' : 'Videos',
      icon: <ListVideo className="w-4 h-4" />,
      badge: `${stats.analyzedCount}/${stats.totalVideos}`,
    },
    {
      id: 'synthesis',
      label: language === 'fr' ? 'Méta-analyse' : 'Meta-analysis',
      icon: <Sparkles className="w-4 h-4" />,
      badge: playlist?.meta_analysis ? '✓' : undefined,
    },
    {
      id: 'chat',
      label: language === 'fr' ? 'Chat IA' : 'AI Chat',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      id: 'stats',
      label: language === 'fr' ? 'Statistiques' : 'Statistics',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-accent-primary mx-auto mb-4" />
            <p className="text-text-secondary">
              {language === 'fr' ? 'Chargement du corpus...' : 'Loading corpus...'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-text-primary font-semibold mb-2">
              {language === 'fr' ? 'Corpus introuvable' : 'Corpus not found'}
            </p>
            <p className="text-text-secondary mb-4">{error}</p>
            <button onClick={() => navigate('/playlists')} className="btn btn-primary">
              <ArrowLeft className="w-4 h-4" />
              {language === 'fr' ? 'Retour aux corpus' : 'Back to corpus list'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <DoodleBackground variant="video" />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className="flex-1 overflow-x-hidden">
        <div className="container max-w-6xl mx-auto px-4 py-8">

          {/* BACK BUTTON */}
          <button
            onClick={() => navigate('/playlists')}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'fr' ? 'Retour aux corpus' : 'Back to corpus list'}
          </button>

          {/* HEADER */}
          <div className="card p-6 mb-6">
            <div className="flex items-start gap-6">
              <div className="w-40 h-24 rounded-lg overflow-hidden bg-bg-tertiary flex-shrink-0">
                {videos[0]?.thumbnail_url ? (
                  <img src={videos[0].thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ListVideo className="w-10 h-10 text-text-muted" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-text-primary mb-2 truncate">
                  {playlist.playlist_title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <Video className="w-4 h-4" />
                    {stats.analyzedCount}/{stats.totalVideos} {language === 'fr' ? 'vidéos' : 'videos'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(stats.totalDuration)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {formatNumber(stats.totalWords)} {language === 'fr' ? 'mots' : 'words'}
                  </span>
                  {playlist.status && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      playlist.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      playlist.status === 'processing' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-bg-tertiary text-text-muted'
                    }`}>
                      {playlist.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleRegenerateSynthesis}
                  disabled={isRegenerating || stats.analyzedCount === 0}
                  className="btn btn-primary"
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {language === 'fr' ? (playlist.meta_analysis ? 'Regénérer' : 'Générer synthèse') : (playlist.meta_analysis ? 'Regenerate' : 'Generate synthesis')}
                </button>
                <button onClick={loadPlaylistData} className="btn btn-secondary">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Video className="w-6 h-6" />}
              label={language === 'fr' ? 'Vidéos analysées' : 'Analyzed videos'}
              value={`${stats.analyzedCount}/${stats.totalVideos}`}
              color="text-violet-400"
            />
            <StatCard
              icon={<Clock className="w-6 h-6" />}
              label={language === 'fr' ? 'Durée totale' : 'Total duration'}
              value={formatDuration(stats.totalDuration)}
              color="text-blue-400"
            />
            <StatCard
              icon={<FileText className="w-6 h-6" />}
              label={language === 'fr' ? 'Mots analysés' : 'Words analyzed'}
              value={formatNumber(stats.totalWords)}
              color="text-green-400"
            />
            <StatCard
              icon={<Target className="w-6 h-6" />}
              label={language === 'fr' ? 'Fiabilité moyenne' : 'Avg reliability'}
              value={stats.averageReliability > 0 ? `${stats.averageReliability}%` : 'N/A'}
              color={stats.averageReliability >= 70 ? 'text-green-400' :
                     stats.averageReliability >= 50 ? 'text-amber-400' : 'text-red-400'}
            />
          </div>

          {/* TABS */}
          <div className="flex gap-1 mb-6 border-b border-border-subtle pb-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedVideoId(null); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-accent-primary text-white'
                    : 'text-text-secondary hover:bg-bg-secondary'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-bg-tertiary'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ═══ TAB: VIDEOS ═══ */}
          {activeTab === 'videos' && (
            <div className="space-y-4">
              {/* Video Detail Panel (if selected) */}
              {selectedVideo && (
                <VideoDetailPanel
                  video={selectedVideo}
                  playlistId={id!}
                  onClose={() => setSelectedVideoId(null)}
                  onOpenInDashboard={() => navigate(`/dashboard?id=${selectedVideo.id}`)}
                  language={language}
                />
              )}

              {/* Video List */}
              <div className="card">
                {videos.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    <ListVideo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{language === 'fr' ? 'Aucune vidéo dans ce corpus' : 'No videos in this corpus'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {videos.map((video, index) => (
                      <VideoListItem
                        key={video.id}
                        video={video}
                        isAnalyzed={!!video.summary_content}
                        isActive={selectedVideoId === video.id}
                        onClick={() => handleVideoClick(video.id)}
                        language={language}
                        position={video.position ?? index + 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: META-ANALYSIS ═══ */}
          {activeTab === 'synthesis' && (
            <div className="space-y-6">
              {playlist.meta_analysis ? (
                <div className="card p-6">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-violet-400" />
                    {language === 'fr' ? 'Méta-analyse du corpus' : 'Corpus Meta-Analysis'}
                  </h3>
                  <div className="prose prose-invert max-w-none text-text-secondary leading-relaxed">
                    <ReactMarkdown>{playlist.meta_analysis}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-text-muted" />
                  <h3 className="font-semibold text-text-primary mb-2">
                    {language === 'fr' ? 'Pas encore de méta-analyse' : 'No meta-analysis yet'}
                  </h3>
                  <p className="text-text-secondary mb-4 max-w-md mx-auto">
                    {language === 'fr'
                      ? 'La méta-analyse croise toutes les synthèses pour dégager les thèmes, convergences et divergences du corpus.'
                      : 'Meta-analysis cross-references all summaries to identify themes, convergences and divergences.'}
                  </p>
                  <button
                    onClick={handleRegenerateSynthesis}
                    disabled={isRegenerating || stats.analyzedCount === 0}
                    className="btn btn-primary"
                  >
                    {isRegenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {language === 'fr' ? 'Générer la méta-analyse' : 'Generate meta-analysis'}
                  </button>
                </div>
              )}

              {/* Individual summaries overview */}
              {stats.analyzedCount > 0 && (
                <div className="card p-6">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    {language === 'fr' ? `Synthèses individuelles (${stats.analyzedCount})` : `Individual summaries (${stats.analyzedCount})`}
                  </h3>
                  <div className="grid gap-3">
                    {videos.filter(v => !!v.summary_content).map((video, i) => (
                      <div
                        key={video.id}
                        className="p-4 bg-bg-secondary/50 rounded-lg cursor-pointer hover:bg-bg-secondary transition-colors"
                        onClick={() => { setActiveTab('videos'); setSelectedVideoId(video.id); }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-sm font-mono text-text-muted w-6">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-text-primary truncate text-sm">{video.video_title}</h4>
                            <p className="text-xs text-text-muted mt-1 line-clamp-2">
                              {video.summary_content?.substring(0, 200)}...
                            </p>
                          </div>
                          {video.category && (
                            <span className="text-xs px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full capitalize flex-shrink-0">
                              {video.category}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: CHAT IA ═══ */}
          {activeTab === 'chat' && (
            <CorpusChat
              playlistId={id!}
              playlistTitle={playlist.playlist_title}
              language={language}
            />
          )}

          {/* ═══ TAB: STATS ═══ */}
          {activeTab === 'stats' && (
            <div className="grid md:grid-cols-2 gap-6">
              <CategoryChart categories={stats.categories} language={language} />
              <DurationChart distribution={stats.durationDistribution} language={language} />

              {/* Channels distribution */}
              {details?.channels && Object.keys(details.channels).length > 0 && (
                <div className="card p-6">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Hash className="w-5 h-5 text-cyan-400" />
                    {language === 'fr' ? 'Chaînes YouTube' : 'YouTube Channels'}
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(details.channels).sort((a, b) => b[1] - a[1]).map(([channel, count]) => (
                      <div key={channel} className="flex justify-between items-center py-1">
                        <span className="text-sm text-text-secondary truncate">{channel}</span>
                        <span className="text-sm text-text-muted">{count} {language === 'fr' ? 'vidéos' : 'videos'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Tags */}
              {stats.topTags.length > 0 && (
                <div className="card p-6">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-violet-400" />
                    {language === 'fr' ? 'Tags les plus fréquents' : 'Most frequent tags'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {stats.topTags.map(({ tag, count }) => (
                      <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-bg-tertiary rounded-full text-sm">
                        <span className="text-text-secondary">{tag}</span>
                        <span className="text-text-muted">({count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reliability Distribution */}
              <div className="card p-6 md:col-span-2">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-400" />
                  {language === 'fr' ? 'Score de fiabilité' : 'Reliability Score'}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-green-400">
                      {videos.filter(v => (v.reliability_score || 0) >= 0.7).length}
                    </p>
                    <p className="text-sm text-text-muted">{language === 'fr' ? 'Fiable (≥70%)' : 'Reliable (≥70%)'}</p>
                  </div>
                  <div className="p-4 bg-amber-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-amber-400">
                      {videos.filter(v => (v.reliability_score || 0) >= 0.5 && (v.reliability_score || 0) < 0.7).length}
                    </p>
                    <p className="text-sm text-text-muted">{language === 'fr' ? 'Modéré (50-69%)' : 'Moderate (50-69%)'}</p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-red-400">
                      {videos.filter(v => v.reliability_score != null && v.reliability_score < 0.5).length}
                    </p>
                    <p className="text-sm text-text-muted">{language === 'fr' ? 'À vérifier (<50%)' : 'To verify (<50%)'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default PlaylistDetailPage;
