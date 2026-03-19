/**
 * 💬 CHAT PAGE v3.0 — Interface épurée type Claude
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Refonte complète : zéro clutter, chat plein écran centré.
 * - Pas de DoodleBackground, pas de décorations
 * - Sélecteur d'analyse discret en haut
 * - Chat centré avec max-width, bulles propres
 * - Input en bas, sticky
 * - Mobile responsive (375px min)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send, Bot, User, ArrowLeft, Loader2, ChevronDown,
  Copy, Check, Globe, ExternalLink, Sparkles, MessageSquare, Search, Video, Clock,
} from 'lucide-react';
import { videoApi, chatApi, Summary } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { SEO } from '../components/SEO';
import { normalizePlanId, CONVERSION_TRIGGERS } from '../config/planPrivileges';
import { EnrichedMarkdown, cleanConceptMarkers } from '../components/EnrichedMarkdown';
import { parseAskQuestions } from '../components/ClickableQuestions';

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
// 🎯 CHAT PAGE — Épurée
// ═══════════════════════════════════════════════════════════════════════════════

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useTranslation();
  const { user } = useAuth();

  const plan = normalizePlanId(user?.plan);
  const canChat = plan !== 'free';

  // ── State ──
  const [analyses, setAnalyses] = useState<Summary[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Summary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAnalysisPicker, setShowAnalysisPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const urlSummaryId = searchParams.get('summary');

  // ── Textes ──
  const t = language === 'fr' ? {
    placeholder: 'Posez votre question...',
    thinking: 'Réflexion en cours...',
    copy: 'Copier',
    copied: 'Copié !',
    emptyTitle: 'Posez votre première question',
    emptySubtitle: 'L\'IA a accès au contenu complet de l\'analyse pour vous répondre.',
    selectVideo: 'Choisir une vidéo',
    changeVideo: 'Changer de vidéo',
    searchPlaceholder: 'Rechercher...',
    noResults: 'Aucune analyse trouvée',
    analyze: 'Analyser une vidéo',
    sources: 'Sources',
    webEnriched: 'Enrichi par le web',
    upgradeTitle: 'Débloquez le Chat IA',
    upgradeDesc: 'Le chat contextuel est disponible à partir du plan Starter.',
    upgrade: 'Voir les plans',
    back: 'Retour',
    suggestions: [
      'Résume les points clés',
      'Quels sont les arguments principaux ?',
      'Y a-t-il des biais dans le raisonnement ?',
    ],
  } : {
    placeholder: 'Ask your question...',
    thinking: 'Thinking...',
    copy: 'Copy',
    copied: 'Copied!',
    emptyTitle: 'Ask your first question',
    emptySubtitle: 'The AI has access to the full analysis content to answer you.',
    selectVideo: 'Choose a video',
    changeVideo: 'Change video',
    searchPlaceholder: 'Search...',
    noResults: 'No analyses found',
    analyze: 'Analyze a video',
    sources: 'Sources',
    webEnriched: 'Web enriched',
    upgradeTitle: 'Unlock AI Chat',
    upgradeDesc: 'Contextual chat is available from the Starter plan.',
    upgrade: 'View plans',
    back: 'Back',
    suggestions: [
      'Summarize the key points',
      'What are the main arguments?',
      'Are there any reasoning biases?',
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
        if (urlSummaryId) {
          const found = items.find((a: Summary) => a.id === parseInt(urlSummaryId));
          if (found) setSelectedAnalysis(found);
        }
      } catch (err) {
        console.error('[ChatPage] Failed to fetch analyses:', err);
      } finally {
        setIsLoadingAnalyses(false);
      }
    };
    fetchAnalyses();
  }, [urlSummaryId]);

  // ── Fetch chat history ──
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

  // ── Close picker on outside click ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAnalysisPicker(false);
      }
    };
    if (showAnalysisPicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAnalysisPicker]);

  // ── Select analysis ──
  const handleSelectAnalysis = (analysis: Summary) => {
    setSelectedAnalysis(analysis);
    setMessages([]);
    setSearchParams({ summary: String(analysis.id) });
    setShowAnalysisPicker(false);
    setPickerSearch('');
  };

  // ── Send message ──
  const handleSend = useCallback(async (text?: string) => {
    const message = text || inputValue.trim();
    if (!message || !selectedAnalysis || isSending) return;

    setInputValue('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

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
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: language === 'fr'
          ? '❌ Une erreur est survenue. Veuillez réessayer.'
          : '❌ An error occurred. Please try again.',
      }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, selectedAnalysis, isSending, language]);

  // ── Copy ──
  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(cleanConceptMarkers(content));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Auto-resize textarea ──
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // ── Relative time ──
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

  const filteredAnalyses = analyses.filter(a =>
    a.video_title?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    a.video_channel?.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔒 UPGRADE CTA (free users)
  // ═══════════════════════════════════════════════════════════════════════════════

  if (!canChat) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-blue-400/60" />
          </div>
          <h1 className="text-2xl font-bold text-white/90 mb-3">{t.upgradeTitle}</h1>
          <p className="text-white/40 mb-8">{t.upgradeDesc}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {CONVERSION_TRIGGERS.trialEnabled && (
              <button
                onClick={() => navigate('/upgrade?trial=true')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {language === 'fr'
                  ? `Essayer gratuitement ${CONVERSION_TRIGGERS.trialDays} jours`
                  : `Try free for ${CONVERSION_TRIGGERS.trialDays} days`}
              </button>
            )}
            <button
              onClick={() => navigate('/upgrade')}
              className="px-6 py-3 rounded-xl border border-white/[0.08] text-white/50 font-medium hover:text-white/80 hover:border-white/[0.15] transition-all"
            >
              {t.upgrade}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎨 RENDER — Interface épurée
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      <SEO title="Chat IA" path="/chat" />

      {/* ─── Header minimal ─── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors text-white/30 hover:text-white/60"
            aria-label={t.back}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Analysis picker dropdown */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowAnalysisPicker(!showAnalysisPicker)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors max-w-[320px] sm:max-w-[400px]"
            >
              {selectedAnalysis ? (
                <>
                  {selectedAnalysis.thumbnail_url && (
                    <img
                      src={selectedAnalysis.thumbnail_url}
                      alt=""
                      className="w-8 h-5 rounded object-cover flex-shrink-0 opacity-70"
                    />
                  )}
                  <span className="text-sm text-white/70 truncate font-medium">
                    {selectedAnalysis.video_title}
                  </span>
                </>
              ) : (
                <span className="text-sm text-white/40">{t.selectVideo}</span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform ${showAnalysisPicker ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {showAnalysisPicker && (
              <div className="absolute top-full left-0 mt-1 w-80 sm:w-96 max-h-[420px] bg-[#12121a] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                {/* Search */}
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/80 placeholder-white/20 text-sm focus:outline-none focus:border-white/[0.12] transition-colors"
                      autoFocus
                    />
                  </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto max-h-[350px]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                  {isLoadingAnalyses ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                    </div>
                  ) : filteredAnalyses.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <p className="text-sm text-white/30">{t.noResults}</p>
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="mt-3 text-sm text-blue-400/70 hover:text-blue-400 transition-colors"
                      >
                        {t.analyze}
                      </button>
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredAnalyses.map((analysis) => (
                        <button
                          key={analysis.id}
                          onClick={() => handleSelectAnalysis(analysis)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                            selectedAnalysis?.id === analysis.id
                              ? 'bg-blue-500/10 text-white/90'
                              : 'hover:bg-white/[0.04] text-white/60'
                          }`}
                        >
                          <div className="w-12 h-7 rounded overflow-hidden bg-white/[0.04] flex-shrink-0">
                            {analysis.thumbnail_url ? (
                              <img src={analysis.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-3 h-3 text-white/15" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{analysis.video_title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-white/30 truncate">{analysis.video_channel}</span>
                              <span className="text-[10px] text-white/20 flex items-center gap-0.5">
                                <Clock className="w-2 h-2" />
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
            )}
          </div>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedAnalysis ? (
          /* ═══ No analysis selected — centered prompt ═══ */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Bot className="w-7 h-7 text-white/20" />
              </div>
              <h2 className="text-lg font-semibold text-white/70 mb-2">{t.selectVideo}</h2>
              <p className="text-sm text-white/30 mb-6">
                {language === 'fr'
                  ? 'Sélectionnez une vidéo analysée pour commencer à discuter avec l\'IA.'
                  : 'Select an analyzed video to start chatting with the AI.'}
              </p>
              <button
                onClick={() => setShowAnalysisPicker(true)}
                className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/60 hover:text-white/80 text-sm font-medium transition-all"
              >
                {t.selectVideo}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ═══ Messages area ═══ */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
            >
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                {/* Loading history */}
                {isLoadingMessages && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-white/15 animate-spin" />
                  </div>
                )}

                {/* Empty state */}
                {!isLoadingMessages && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-5">
                      <Sparkles className="w-6 h-6 text-cyan-400/40" />
                    </div>
                    <h3 className="text-base font-semibold text-white/70 mb-1.5">{t.emptyTitle}</h3>
                    <p className="text-sm text-white/30 mb-8 max-w-[300px]">{t.emptySubtitle}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {t.suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(s)}
                          className="px-4 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.1] text-white/45 hover:text-white/70 text-sm transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {messages.map((msg) => {
                  const contentStr = typeof msg.content === 'string' ? msg.content : String(msg.content || '');
                  const { beforeQuestions, questions } = msg.role === 'assistant'
                    ? parseAskQuestions(contentStr)
                    : { beforeQuestions: contentStr, questions: [] };
                  const isUser = msg.role === 'user';

                  return (
                    <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
                      {/* Assistant avatar */}
                      {!isUser && (
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-cyan-400/70" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 relative group ${
                        isUser
                          ? 'bg-blue-600/80 text-white rounded-br-md'
                          : 'bg-white/[0.04] text-white/80 rounded-bl-md'
                      }`}>
                        {/* Web badge */}
                        {!isUser && msg.web_search_used && (
                          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/[0.06]">
                            <Globe className="w-3 h-3 text-emerald-400/80" />
                            <span className="text-[10px] font-medium text-emerald-400/70 uppercase tracking-wider">{t.webEnriched}</span>
                          </div>
                        )}

                        {/* Content */}
                        {isUser ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{contentStr}</p>
                        ) : (
                          <>
                            <div className="prose prose-invert prose-sm max-w-none
                              prose-p:text-white/70 prose-p:leading-relaxed prose-p:text-sm prose-p:my-2
                              prose-headings:text-white/85 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                              prose-strong:text-white/85
                              prose-code:text-cyan-300/90 prose-code:bg-white/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                              prose-pre:bg-[#08080e] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl prose-pre:my-3
                              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                              prose-li:text-white/65 prose-li:text-sm
                              prose-ul:my-2 prose-ol:my-2
                              prose-blockquote:border-white/10 prose-blockquote:text-white/50
                            ">
                              <EnrichedMarkdown language={language} className="text-sm leading-relaxed">
                                {beforeQuestions}
                              </EnrichedMarkdown>
                            </div>

                            {/* Follow-up questions */}
                            {questions.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-white/[0.05] flex flex-wrap gap-1.5">
                                {questions.map((q, qi) => (
                                  <button
                                    key={qi}
                                    onClick={() => !isSending && handleSend(
                                      q.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, term, display) => display || term)
                                    )}
                                    disabled={isSending}
                                    className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.07] text-white/40 hover:text-white/65 text-xs rounded-lg transition-all disabled:opacity-40"
                                  >
                                    {q.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, _t, display) => display || _t)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-white/[0.05]">
                            <p className="text-[10px] text-white/25 mb-1.5 font-medium uppercase tracking-wider">{t.sources}</p>
                            <div className="flex flex-wrap gap-1">
                              {msg.sources.map((src, i) => (
                                <a
                                  key={i}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] px-2.5 py-1 bg-white/[0.03] hover:bg-white/[0.07] rounded-full transition-colors flex items-center gap-1 text-white/35 hover:text-white/55"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {src.title || 'Source'}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Copy button */}
                        {!isUser && (
                          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopy(msg.id, contentStr)}
                              className="text-[11px] text-white/20 hover:text-white/50 flex items-center gap-1 transition-colors"
                            >
                              {copiedId === msg.id
                                ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">{t.copied}</span></>
                                : <><Copy className="w-3 h-3" />{t.copy}</>
                              }
                            </button>
                          </div>
                        )}
                      </div>

                      {/* User avatar */}
                      {isUser && (
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5 text-blue-400/70" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Thinking indicator */}
                {isSending && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-cyan-400/70" />
                    </div>
                    <div className="bg-white/[0.04] rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-white/25">{t.thinking}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* ═══ Input area ═══ */}
            <div className="flex-shrink-0 border-t border-white/[0.04] bg-[#0a0a0f]/90 backdrop-blur-xl">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={t.placeholder}
                    rows={1}
                    className="flex-1 resize-none px-4 py-2.5 rounded-xl bg-white/[0.04] text-white/85 placeholder-white/20 border border-white/[0.06] focus:border-cyan-500/25 focus:ring-1 focus:ring-cyan-500/15 outline-none transition-all text-sm leading-relaxed"
                    style={{ maxHeight: '160px' }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isSending}
                    className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/[0.04] disabled:text-white/15 text-white transition-all flex-shrink-0"
                    aria-label={language === 'fr' ? 'Envoyer' : 'Send'}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
