/**
 * 💬 CHAT PAGE v2.0 — Page de chat IA dédiée
 *
 * Accessible depuis la sidebar → /chat
 * Intègre Sidebar + DoodleBackground + historique vidéos.
 * Même design que DashboardPage.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Search,
  Clock,
  Send,
  Bot,
  User,
  ArrowLeft,
  Loader2,
  Video,
  Globe,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { videoApi, chatApi, Summary } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { normalizePlanId } from '../config/planPrivileges';
import { EnrichedMarkdown, cleanConceptMarkers } from '../components/EnrichedMarkdown';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { ErrorBoundary } from '../components/ErrorBoundary';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 CHAT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useTranslation();
  const { user } = useAuth();

  const plan = normalizePlanId(user?.plan);
  const canChat = plan !== 'free';

  // ── Sidebar state ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── State ──
  const [analyses, setAnalyses] = useState<Summary[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<Summary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Récupérer le summaryId depuis l'URL si présent
  const urlSummaryId = searchParams.get('summary');

  // ── Textes localisés ──
  const texts = language === 'fr' ? {
    title: 'Chat IA',
    subtitle: 'Discutez avec l\'IA sur vos analyses vidéo',
    searchPlaceholder: 'Rechercher une analyse...',
    selectAnalysis: 'Sélectionnez une analyse',
    selectAnalysisDesc: 'Choisissez une vidéo analysée dans la liste de gauche pour commencer à discuter avec l\'IA.',
    noAnalyses: 'Aucune analyse trouvée',
    noAnalysesDesc: 'Analysez une vidéo pour commencer',
    startAnalysis: 'Analyser une vidéo',
    inputPlaceholder: 'Posez votre question...',
    send: 'Envoyer',
    back: 'Retour',
    sources: 'Sources',
    webEnriched: 'Enrichi par le web',
    upgradeTitle: 'Débloquez le Chat IA',
    upgradeDesc: 'Le chat contextuel est disponible à partir du plan Starter.',
    upgrade: 'Voir les plans',
    emptyChat: 'Posez votre première question !',
    emptyChatDesc: 'L\'IA a accès au contenu complet de l\'analyse pour vous répondre.',
    recentAnalyses: 'Vos analyses',
    suggestions: [
      'Résume les points clés de cette vidéo',
      'Quels sont les arguments principaux ?',
      'Que peut-on retenir de cette analyse ?',
    ],
  } : {
    title: 'AI Chat',
    subtitle: 'Chat with AI about your video analyses',
    searchPlaceholder: 'Search an analysis...',
    selectAnalysis: 'Select an analysis',
    selectAnalysisDesc: 'Choose an analyzed video from the left panel to start chatting with the AI.',
    noAnalyses: 'No analyses found',
    noAnalysesDesc: 'Analyze a video to start',
    startAnalysis: 'Analyze a video',
    inputPlaceholder: 'Ask your question...',
    send: 'Send',
    back: 'Back',
    sources: 'Sources',
    webEnriched: 'Web enriched',
    upgradeTitle: 'Unlock AI Chat',
    upgradeDesc: 'Contextual chat is available from the Starter plan.',
    upgrade: 'View plans',
    emptyChat: 'Ask your first question!',
    emptyChatDesc: 'The AI has access to the full analysis content to answer you.',
    recentAnalyses: 'Your analyses',
    suggestions: [
      'Summarize the key points of this video',
      'What are the main arguments?',
      'What can we learn from this analysis?',
    ],
  };

  // ── Fetch analyses ──
  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setIsLoadingAnalyses(true);
        const response = await videoApi.getHistory({ limit: 50, page: 1 });
        const items = response.items || [];
        setAnalyses(items);

        // Si summaryId dans l'URL, sélectionner automatiquement
        if (urlSummaryId) {
          const found = items.find((a: Summary) => a.id === parseInt(urlSummaryId));
          if (found) {
            setSelectedAnalysis(found);
          }
        }
      } catch (err) {
        console.error('[ChatPage] Failed to fetch analyses:', err);
      } finally {
        setIsLoadingAnalyses(false);
      }
    };
    fetchAnalyses();
  }, [language, urlSummaryId]);

  // ── Fetch chat history quand une analyse est sélectionnée ──
  useEffect(() => {
    if (!selectedAnalysis) return;

    const fetchHistory = async () => {
      try {
        setIsLoadingMessages(true);
        const history = await chatApi.getHistory(selectedAnalysis.id);
        const mapped: ChatMessage[] = (history || []).map((msg: any, i: number) => ({
          id: `history-${i}`,
          role: msg.role,
          content: msg.content,
          sources: msg.sources,
          web_search_used: msg.web_search_used,
        }));
        setMessages(mapped);
      } catch (err) {
        console.error('[ChatPage] Failed to fetch chat history:', err);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    fetchHistory();
  }, [selectedAnalysis]);

  // ── Auto scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Sélectionner une analyse ──
  const handleSelectAnalysis = (analysis: Summary) => {
    setSelectedAnalysis(analysis);
    setMessages([]);
    setSearchParams({ summary: String(analysis.id) });
  };

  // ── Envoyer un message ──
  const handleSend = useCallback(async (text?: string) => {
    const message = text || inputValue.trim();
    if (!message || !selectedAnalysis || isSending) return;

    setInputValue('');
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    try {
      const response = await chatApi.send(selectedAnalysis.id, message, false);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.response || '',
        sources: response.sources,
        web_search_used: response.web_search_used,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[ChatPage] Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: language === 'fr'
          ? '❌ Une erreur est survenue. Veuillez réessayer.'
          : '❌ An error occurred. Please try again.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, selectedAnalysis, isSending, language]);

  // ── Copy message ──
  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(cleanConceptMarkers(content));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Formatage date relative ──
  const getRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);
    if (diffMin < 60) return `${diffMin}min`;
    if (diffH < 24) return `${diffH}h`;
    if (diffD < 7) return `${diffD}j`;
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  // Filtre recherche
  const filteredAnalyses = analyses.filter(a =>
    a.video_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.video_channel?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Upgrade CTA ──
  if (!canChat) {
    return (
      <div className="min-h-screen bg-bg-primary relative">
        <ErrorBoundary fallback={null}><DoodleBackground variant="default" /></ErrorBoundary>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'}`}>
          <div className="min-h-screen flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md text-center"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-accent-primary" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-3">{texts.upgradeTitle}</h1>
              <p className="text-text-secondary mb-6">{texts.upgradeDesc}</p>
              <button
                onClick={() => navigate('/upgrade')}
                className="px-6 py-3 rounded-xl bg-accent-primary text-white font-medium hover:bg-accent-primary-hover transition-colors"
              >
                {texts.upgrade}
              </button>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <ErrorBoundary fallback={null}><DoodleBackground variant="default" /></ErrorBoundary>

      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main content */}
      <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'}`}>
        <div className="min-h-screen flex flex-col lg:flex-row pt-2 lg:pt-0">

          {/* ── Panel gauche : liste des analyses ── */}
          <div className={`
            ${selectedAnalysis ? 'hidden lg:flex' : 'flex'}
            flex-col w-full lg:w-80 xl:w-96 lg:border-r border-border-subtle lg:min-h-screen
            bg-bg-primary/80 backdrop-blur-sm
          `}>
            {/* Header */}
            <div className="p-4 lg:p-5 border-b border-border-subtle">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-accent-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text-primary">{texts.title}</h1>
                  <p className="text-xs text-text-secondary">{texts.subtitle}</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={texts.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-secondary border border-border-subtle text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50 transition-all"
                />
              </div>
            </div>

            {/* Analyses list */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingAnalyses && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
                </div>
              )}

              {!isLoadingAnalyses && filteredAnalyses.length === 0 && (
                <div className="text-center py-12 px-4">
                  <Video className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary mb-1">{texts.noAnalyses}</p>
                  <p className="text-xs text-text-secondary mb-4">{texts.noAnalysesDesc}</p>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-4 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary-hover transition-colors"
                  >
                    {texts.startAnalysis}
                  </button>
                </div>
              )}

              {!isLoadingAnalyses && filteredAnalyses.length > 0 && (
                <div className="p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-2 py-2">
                    {texts.recentAnalyses} ({filteredAnalyses.length})
                  </p>
                  {filteredAnalyses.map((analysis) => (
                    <button
                      key={analysis.id}
                      onClick={() => handleSelectAnalysis(analysis)}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-xl mb-1
                        transition-all text-left
                        ${selectedAnalysis?.id === analysis.id
                          ? 'bg-accent-primary/10 border border-accent-primary/20'
                          : 'hover:bg-bg-secondary/80 border border-transparent'
                        }
                      `}
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-11 rounded-lg overflow-hidden bg-bg-tertiary flex-shrink-0">
                        {analysis.thumbnail_url ? (
                          <img src={analysis.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-4 h-4 text-text-muted" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${selectedAnalysis?.id === analysis.id ? 'text-accent-primary' : 'text-text-primary'}`}>
                          {analysis.video_title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-text-tertiary truncate">{analysis.video_channel}</span>
                          <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {getRelativeTime(analysis.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Panel droit : conversation ── */}
          <div className="flex-1 flex flex-col min-h-0">
            {!selectedAnalysis ? (
              /* Empty state — aucune analyse sélectionnée */
              <div className="flex-1 flex items-center justify-center p-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center max-w-sm"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center">
                    <Bot className="w-8 h-8 text-text-muted" />
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary mb-2">{texts.selectAnalysis}</h2>
                  <p className="text-sm text-text-secondary">{texts.selectAnalysisDesc}</p>
                </motion.div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 p-3 border-b border-border-subtle bg-bg-secondary/30 backdrop-blur-sm">
                  <button
                    onClick={() => {
                      setSelectedAnalysis(null);
                      setSearchParams({});
                    }}
                    className="lg:hidden p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
                    aria-label={texts.back}
                  >
                    <ArrowLeft className="w-4 h-4 text-text-secondary" />
                  </button>

                  {selectedAnalysis.thumbnail_url && (
                    <img
                      src={selectedAnalysis.thumbnail_url}
                      alt=""
                      className="w-12 h-8 rounded-lg object-cover flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{selectedAnalysis.video_title}</p>
                    <p className="text-xs text-text-tertiary truncate">{selectedAnalysis.video_channel}</p>
                  </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingMessages && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
                    </div>
                  )}

                  {!isLoadingMessages && messages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8"
                    >
                      <Sparkles className="w-10 h-10 text-accent-primary/40 mx-auto mb-3" />
                      <p className="text-sm font-medium text-text-primary mb-1">{texts.emptyChat}</p>
                      <p className="text-xs text-text-secondary mb-6">{texts.emptyChatDesc}</p>

                      {/* Suggestions */}
                      <div className="flex flex-wrap justify-center gap-2">
                        {texts.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(suggestion)}
                            className="px-3 py-1.5 rounded-full bg-bg-secondary/80 border border-border-subtle text-xs text-text-secondary hover:text-accent-primary hover:border-accent-primary/30 transition-all backdrop-blur-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Messages */}
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-accent-primary" />
                        </div>
                      )}

                      <div className={`
                        max-w-[85%] lg:max-w-[70%] rounded-2xl px-4 py-3 relative group
                        ${msg.role === 'user'
                          ? 'bg-accent-primary text-white rounded-br-md'
                          : 'bg-bg-secondary/90 backdrop-blur-sm border border-border-subtle rounded-bl-md'
                        }
                      `}>
                        {/* Web search badge */}
                        {msg.web_search_used && (
                          <div className="flex items-center gap-1 mb-1.5">
                            <Globe className="w-3 h-3 text-cyan-400" />
                            <span className="text-[10px] text-cyan-400 font-medium">{texts.webEnriched}</span>
                          </div>
                        )}

                        {msg.role === 'assistant' ? (
                          <div className="text-sm text-text-primary prose prose-sm prose-invert max-w-none">
                            <EnrichedMarkdown>{msg.content}</EnrichedMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}

                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border-subtle/50">
                            <p className="text-[10px] text-text-muted mb-1 font-medium">{texts.sources}</p>
                            <div className="flex flex-wrap gap-1">
                              {msg.sources.map((src, i) => (
                                <a
                                  key={i}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-accent-primary hover:underline"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {src.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Copy button */}
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-bg-tertiary transition-all"
                            aria-label="Copier"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-text-muted" />
                            )}
                          </button>
                        )}
                      </div>

                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-accent-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-4 h-4 text-accent-primary" />
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Loading indicator */}
                  {isSending && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-accent-primary" />
                      </div>
                      <div className="bg-bg-secondary/90 backdrop-blur-sm border border-border-subtle rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
                          <span className="text-sm text-text-secondary">
                            {language === 'fr' ? 'Réflexion en cours...' : 'Thinking...'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="p-3 border-t border-border-subtle bg-bg-primary/80 backdrop-blur-sm">
                  <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={texts.inputPlaceholder}
                      rows={1}
                      className="flex-1 resize-none px-4 py-2.5 rounded-xl bg-bg-secondary border border-border-subtle text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50 transition-all max-h-32"
                      style={{ minHeight: '42px' }}
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!inputValue.trim() || isSending}
                      className="p-2.5 rounded-xl bg-accent-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-primary-hover transition-colors flex-shrink-0"
                      aria-label={texts.send}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
