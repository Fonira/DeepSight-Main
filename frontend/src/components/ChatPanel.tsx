/**
 * 💬 CHAT PANEL v1.0 — Interface Chat IA Épurée & Minimaliste
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Remplace FloatingChatWindow avec un design clean :
 *   - Header compact : miniature vidéo + titre + fermer
 *   - Zone de chat propre (bulles user/assistant, markdown rendu)
 *   - Input en bas avec bouton envoyer
 *   - Mode overlay (panneau latéral desktop / plein écran mobile)
 *   - Conserve : streaming SSE, web search, EnrichedMarkdown, [ask:] cliquables
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Bot, User, Globe, Copy, Check,
  ExternalLink, Search, Lock, ArrowDown
} from 'lucide-react';
import { parseAskQuestions } from './ClickableQuestions';
import { AudioPlayerButton } from './AudioPlayerButton';
import { TTSToggle } from './TTSToggle';
import { useTTSContext } from '../contexts/TTSContext';
import { EnrichedMarkdown, cleanConceptMarkers } from './EnrichedMarkdown';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatSource {
  title: string;
  url: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  web_search_used?: boolean;
}

interface WebSearchQuota {
  used: number;
  limit: number;
  remaining: number;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  videoId: string;
  thumbnailUrl?: string;
  messages: ChatMessage[];
  isLoading: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: (enabled: boolean) => void;
  onSendMessage: (message: string, options?: { useWebSearch?: boolean }) => void;
  onClearHistory?: () => void;
  language?: 'fr' | 'en';
  userPlan?: string;
  webSearchQuota?: WebSearchQuota;
  onUpgrade?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const canUseWebSearch = (plan?: string): boolean => {
  if (!plan) return false;
  return plan.toLowerCase() === 'pro';
};

const getThumbnailUrl = (videoId: string, thumbnailUrl?: string): string => {
  if (thumbnailUrl) return thumbnailUrl;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  videoTitle,
  videoId,
  thumbnailUrl,
  messages,
  isLoading,
  webSearchEnabled,
  onToggleWebSearch,
  onSendMessage,
  onClearHistory,
  language = 'fr',
  userPlan,
  webSearchQuota,
  onUpgrade,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasWebSearch = canUseWebSearch(userPlan);
  const isFree = !userPlan || userPlan === 'free';
  const quotaRemaining = webSearchQuota?.remaining ?? 0;
  const quotaLimit = webSearchQuota?.limit ?? 0;
  const { autoPlayEnabled, playText, stopPlaying } = useTTSContext();
  const prevMsgCountRef = useRef(messages.length);

  // ─── Translations ───
  const t = language === 'fr' ? {
    placeholder: 'Posez votre question...',
    analyzing: 'Réflexion en cours...',
    copy: 'Copier',
    copied: 'Copié !',
    emptyTitle: 'Discutez avec l\'IA',
    emptySubtitle: 'Posez n\'importe quelle question sur le contenu de cette vidéo.',
    deepen: 'Approfondir (web)',
    deepenLocked: 'Dès le plan Pro',
    webEnriched: 'Enrichi par le web',
    sources: 'Sources :',
  } : {
    placeholder: 'Ask your question...',
    analyzing: 'Thinking...',
    copy: 'Copy',
    copied: 'Copied!',
    emptyTitle: 'Chat with the AI',
    emptySubtitle: 'Ask any question about this video\'s content.',
    deepen: 'Deepen (web)',
    deepenLocked: 'From Pro plan',
    webEnriched: 'Web enriched',
    sources: 'Sources:',
  };

  const suggestedQuestions = language === 'fr'
    ? [
        'Quels sont les points clés ?',
        'Résume en 3 bullet points',
        'Y a-t-il des biais ?',
      ]
    : [
        'What are the key takeaways?',
        'Summarize in 3 bullet points',
        'Are there any biases?',
      ];

  // ─── Auto-scroll ───
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Detect scroll position for "scroll to bottom" button ───
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Auto-play TTS on new assistant message ───
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current && autoPlayEnabled) {
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        const text = typeof last.content === 'string' ? last.content : '';
        playText(text.slice(0, 5000));
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, autoPlayEnabled, playText]);

  // ─── Focus input on open ───
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // ─── Auto-resize textarea ───
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // ─── Submit ───
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      stopPlaying();
      onSendMessage(input.trim());
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ─── Copy ───
  const copyToClipboard = async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(cleanConceptMarkers(content));
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* */ }
  };

  // ─── Deepen with web search ───
  const handleDeepen = (msgIndex: number) => {
    if (!hasWebSearch || isLoading) return;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        onSendMessage(messages[i].content, { useWebSearch: true });
        return;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`
          fixed z-[9999] flex flex-col
          bg-bg-secondary/98 backdrop-blur-sm
          border-l border-border-default
          transition-transform duration-300 ease-out

          /* Mobile: plein écran */
          inset-0

          /* Desktop: panneau latéral droit */
          md:inset-y-0 md:left-auto md:right-0
          md:w-[440px] lg:w-[480px]
          md:shadow-[-8px_0_40px_rgba(0,0,0,0.5)]
        `}
      >
        {/* ═══════════════════════════════════════════════════════════════════════
           HEADER — Miniature + Titre + Fermer
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
          {/* Miniature vidéo */}
          <img
            src={getThumbnailUrl(videoId, thumbnailUrl)}
            alt=""
            className="w-12 h-[27px] rounded object-cover flex-shrink-0 opacity-80"
          />

          {/* Titre */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white/90 truncate leading-tight">
              {videoTitle}
            </h3>
            <p className="text-[11px] text-white/30 mt-0.5">
              {language === 'fr' ? 'Chat IA' : 'AI Chat'}
            </p>
          </div>

          {/* Fermer */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/40 hover:text-white/70 flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
           MESSAGES AREA
        ═══════════════════════════════════════════════════════════════════════ */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
        >
          {messages.length === 0 ? (
            /* ─── Empty State ─── */
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
                <Bot className="w-7 h-7 text-cyan-400/70" />
              </div>
              <h3 className="text-base font-semibold text-white/80 mb-2">
                {t.emptyTitle}
              </h3>
              <p className="text-sm text-white/35 mb-8 max-w-[280px] leading-relaxed">
                {t.emptySubtitle}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-[300px]">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => !isLoading && onSendMessage(q)}
                    disabled={isLoading}
                    className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.1] text-white/60 hover:text-white/80 text-sm rounded-xl transition-all duration-200 text-left disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ─── Message List ─── */
            messages.map((msg, msgIndex) => {
              const contentStr = typeof msg.content === 'string'
                ? msg.content
                : String(msg.content || '');

              const { beforeQuestions, questions } = msg.role === 'assistant'
                ? parseAskQuestions(contentStr)
                : { beforeQuestions: contentStr, questions: [] };

              const isUser = msg.role === 'user';
              const isWebEnriched = msg.web_search_used === true;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 animate-[fadeSlideIn_0.2s_ease-out] ${isUser ? 'justify-end' : ''}`}
                >
                  {/* Assistant avatar */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 relative group ${
                      isUser
                        ? 'bg-blue-600/90 text-white rounded-br-md'
                        : 'bg-white/[0.05] text-white/80 rounded-bl-md'
                    }`}
                  >
                    {/* Web enriched badge */}
                    {!isUser && isWebEnriched && (
                      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/[0.06]">
                        <Globe className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-wider">
                          {t.webEnriched}
                        </span>
                      </div>
                    )}

                    {/* Content */}
                    {isUser ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{contentStr}</p>
                    ) : (
                      <>
                        <div className="prose prose-invert prose-sm max-w-none
                          prose-p:text-white/75 prose-p:leading-relaxed prose-p:text-sm
                          prose-headings:text-white/90 prose-headings:font-semibold
                          prose-strong:text-white/90
                          prose-code:text-cyan-300 prose-code:bg-white/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                          prose-pre:bg-[#0a0a14] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl
                          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                          prose-li:text-white/70 prose-li:text-sm
                          prose-ul:my-2 prose-ol:my-2
                        ">
                          <EnrichedMarkdown language={language} className="text-sm leading-relaxed">
                            {beforeQuestions}
                          </EnrichedMarkdown>
                        </div>

                        {/* TTS button */}
                        <div className="mt-2 pt-1.5 flex justify-end">
                          <AudioPlayerButton text={beforeQuestions} size="md" />
                        </div>

                        {/* [ask:] Suggested follow-up questions */}
                        {questions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                            {questions.map((q, qi) => (
                              <button
                                key={qi}
                                onClick={() => !isLoading && onSendMessage(
                                  q.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, term, display) => display || term)
                                )}
                                disabled={isLoading}
                                className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/70 text-xs rounded-lg transition-all disabled:opacity-40"
                              >
                                {q.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, _term, display) => display || _term)}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                        <p className="text-[10px] font-medium text-white/30 mb-1.5 uppercase tracking-wider">
                          {t.sources}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {msg.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] rounded-full transition-colors flex items-center gap-1 text-white/40 hover:text-white/60"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              {src.title || 'Source'}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions (copy + deepen) — assistant only */}
                    {!isUser && (
                      <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => copyToClipboard(contentStr, msg.id)}
                          className="text-[11px] text-white/25 hover:text-white/60 flex items-center gap-1 transition-colors"
                        >
                          {copiedId === msg.id
                            ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">{t.copied}</span></>
                            : <><Copy className="w-3 h-3" />{t.copy}</>
                          }
                        </button>

                        {!isWebEnriched && (
                          <button
                            onClick={() => {
                              if (isFree && onUpgrade) onUpgrade();
                              else handleDeepen(msgIndex);
                            }}
                            disabled={isLoading || (hasWebSearch && quotaRemaining <= 0)}
                            className={`text-[11px] flex items-center gap-1 transition-colors ${
                              isFree
                                ? 'text-white/20 cursor-pointer'
                                : hasWebSearch && quotaRemaining > 0
                                  ? 'text-cyan-400/50 hover:text-cyan-400 cursor-pointer'
                                  : 'text-white/15 cursor-not-allowed'
                            } disabled:opacity-30`}
                          >
                            {isFree ? <Lock className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                            <span>{isFree ? t.deepenLocked : t.deepen}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User avatar */}
                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Loading / Streaming indicator */}
          {isLoading && (
            <div className="flex gap-2.5 animate-[fadeSlideIn_0.2s_ease-out]">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="bg-white/[0.05] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-[bounce_1.2s_ease-in-out_infinite]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-[bounce_1.2s_ease-in-out_0.2s_infinite]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-[bounce_1.2s_ease-in-out_0.4s_infinite]" />
                  </div>
                  <span className="text-xs text-white/30">{t.analyzing}</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
            <button
              onClick={scrollToBottom}
              className="p-2 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-white/50 hover:text-white/80 transition-all shadow-lg backdrop-blur-sm"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
           INPUT AREA
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="px-4 py-3 border-t border-white/[0.06] flex-shrink-0 bg-[#0a0a12]/80 backdrop-blur-xl">
          {/* Web search toggle + TTS toggle */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isFree) onUpgrade?.();
                else if (hasWebSearch && quotaRemaining > 0) onToggleWebSearch(!webSearchEnabled);
              }}
              disabled={!isFree && (!hasWebSearch || quotaRemaining <= 0)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                isFree
                  ? 'text-white/25 hover:text-white/40 cursor-pointer'
                  : webSearchEnabled && hasWebSearch
                    ? 'text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20'
                    : 'text-white/25 hover:text-white/40'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {isFree ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              <span>Web</span>
              {hasWebSearch && !isFree && (
                <span className="text-[10px] opacity-60">{quotaRemaining}/{quotaLimit}</span>
              )}
            </button>
            <TTSToggle />
            </div>

            {onClearHistory && messages.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-[11px] text-white/20 hover:text-red-400/70 transition-colors"
              >
                {language === 'fr' ? 'Effacer' : 'Clear'}
              </button>
            )}
          </div>

          {/* Input row */}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t.placeholder}
              rows={1}
              className="flex-1 resize-none bg-white/[0.04] text-white/90 placeholder:text-white/20 rounded-xl px-4 py-2.5 border border-white/[0.06] focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20 outline-none transition-all text-sm leading-relaxed"
              style={{ maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-white/[0.04] disabled:text-white/15 text-white transition-all duration-200 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Keyframe animation (injected via style tag) */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default ChatPanel;
