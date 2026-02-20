/**
 * 🗨️ FLOATING CHAT WINDOW v3.0 — Modern Messaging UI
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🔧 REFONTE v3.0:
 *   - ✅ iMessage/WhatsApp-style message bubbles with proper alignment
 *   - ✅ Typing indicator with 3 pulsing dots
 *   - ✅ Rounded modern input with inline web toggle pill
 *   - ✅ Compact header with subtle border
 *   - ✅ Suggestion pills as horizontal scrollable chips
 *   - ✅ Panel slide-in + message fade-in animations
 *   - ✅ Darker uniform message area with empty state
 *   - ✅ Preserved: drag, resize, copy, all props & logic
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, Globe, Bot, User,
  Minimize2, Maximize2, Layers, Move, Copy, Check,
  ExternalLink
} from 'lucide-react';
import { DeepSightSpinnerMicro } from './ui';
import { parseAskQuestions, ClickableQuestionsBlock } from './ClickableQuestions';
// 🔧 v2.0: Import depuis EnrichedMarkdown (plus de WikiTooltip séparé)
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

interface Position { x: number; y: number; }
interface Size { width: number; height: number; }

interface FloatingChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  type: 'video' | 'playlist';
  messages: ChatMessage[];
  isLoading: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
  markdownComponents?: Record<string, React.ComponentType<any>>;
  language?: 'fr' | 'en';
  storageKey?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CSS KEYFRAMES (injected once)
// ═══════════════════════════════════════════════════════════════════════════════

const STYLE_ID = 'fcw-v3-styles';

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes fcw-slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fcw-fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fcw-dotPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
    .fcw-panel-enter {
      animation: fcw-slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .fcw-msg-enter {
      animation: fcw-fadeIn 0.2s ease-out both;
    }
    .fcw-dot-1 { animation: fcw-dotPulse 1.4s ease-in-out infinite; }
    .fcw-dot-2 { animation: fcw-dotPulse 1.4s ease-in-out 0.2s infinite; }
    .fcw-dot-3 { animation: fcw-dotPulse 1.4s ease-in-out 0.4s infinite; }
    .fcw-suggestions-scroll::-webkit-scrollbar { display: none; }
    .fcw-suggestions-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  `;
  document.head.appendChild(style);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

const useDraggable = (initialPos: Position, storageKey: string) => {
  const [position, setPosition] = useState<Position>(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}-pos`);
      return stored ? JSON.parse(stored) : initialPos;
    } catch { return initialPos; }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
      setPosition({ x, y });
    };
    const handleUp = () => {
      setIsDragging(false);
      localStorage.setItem(`${storageKey}-pos`, JSON.stringify(position));
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, position, storageKey]);

  return { position, setPosition, isDragging, handleMouseDown };
};

const useResizable = (initialSize: Size, minSize: Size, maxSize: Size, storageKey: string) => {
  const [size, setSize] = useState<Size>(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}-size`);
      return stored ? JSON.parse(stored) : initialSize;
    } catch { return initialSize; }
  });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleResizeStart = useCallback((dir: string, e: React.MouseEvent) => {
    setIsResizing(dir);
    startRef.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      let w = startRef.current.w, h = startRef.current.h;
      if (isResizing.includes('e')) w += dx;
      if (isResizing.includes('w')) w -= dx;
      if (isResizing.includes('s')) h += dy;
      if (isResizing.includes('n')) h -= dy;
      w = Math.max(minSize.width, Math.min(maxSize.width, w));
      h = Math.max(minSize.height, Math.min(maxSize.height, h));
      setSize({ width: w, height: h });
    };
    const handleUp = () => {
      setIsResizing(null);
      localStorage.setItem(`${storageKey}-size`, JSON.stringify(size));
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing, minSize, maxSize, size, storageKey]);

  return { size, setSize, isResizing, handleResizeStart };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const FloatingChatWindow: React.FC<FloatingChatWindowProps> = ({
  isOpen, onClose, title, subtitle, type, messages, isLoading,
  webSearchEnabled, onToggleWebSearch, onSendMessage,
  language = 'fr', storageKey = 'floating-chat'
}) => {
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultPos = { x: window.innerWidth - 620, y: 100 };
  const defaultSize = { width: 580, height: 650 };

  const { position, setPosition, isDragging, handleMouseDown } = useDraggable(defaultPos, storageKey);
  const { size, setSize, isResizing, handleResizeStart } = useResizable(
    defaultSize, { width: 350, height: 400 }, { width: 900, height: 850 }, storageKey
  );

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, isMinimized]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  // 🔧 v2.0: Utiliser cleanConceptMarkers pour copier sans les [[]]
  const copyToClipboard = async (content: string, msgId: string) => {
    try {
      const cleanContent = cleanConceptMarkers(content);
      await navigator.clipboard.writeText(cleanContent);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleDoubleClick = () => {
    if (isMaximized) {
      setSize(defaultSize);
      setPosition(defaultPos);
    } else {
      setSize({ width: window.innerWidth - 80, height: window.innerHeight - 120 });
      setPosition({ x: 40, y: 60 });
    }
    setIsMaximized(!isMaximized);
  };

  if (!isOpen) return null;

  const isPlaylist = type === 'playlist';
  const accent = isPlaylist ? 'rgba(168, 85, 247,' : 'rgba(0, 188, 212,';

  const t = language === 'fr' ? {
    web: 'Web',
    placeholder: 'Message...',
    thinking: 'Réflexion en cours...',
    copy: 'Copier',
    copied: 'Copié !',
    emptyState: isPlaylist ? 'Posez une question sur ce corpus' : 'Posez une question sur cette vidéo',
  } : {
    web: 'Web',
    placeholder: 'Message...',
    thinking: 'Thinking...',
    copy: 'Copy',
    copied: 'Copied!',
    emptyState: `Ask a question about this ${type}`,
  };

  // Helper: check if previous message is from the same role (for tighter grouping)
  const isSameAuthorAsPrev = (index: number): boolean => {
    if (index === 0) return false;
    return messages[index].role === messages[index - 1].role;
  };

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 99999 }}>
      <div
        className="pointer-events-auto flex flex-col fcw-panel-enter"
        style={{
          position: 'absolute',
          top: position.y,
          left: position.x,
          width: isMinimized ? 280 : size.width,
          height: isMinimized ? 'auto' : size.height,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)`,
          background: 'rgba(8, 12, 20, 0.98)',
          backdropFilter: 'blur(20px)',
          transition: isDragging || isResizing ? 'none' : 'width 0.2s, height 0.2s',
        }}
      >
        {/* Resize Handles */}
        {!isMinimized && (
          <>
            <div onMouseDown={(e) => handleResizeStart('se', e)} className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('s', e)} className="absolute left-4 right-4 bottom-0 h-2 cursor-s-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('e', e)} className="absolute right-0 top-4 bottom-4 w-2 cursor-e-resize z-50" />
          </>
        )}

        {/* ─── Header (compact) ─── */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          className="flex items-center justify-between px-3 py-2 flex-shrink-0 select-none"
          style={{
            background: 'rgba(10, 14, 22, 0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <div className="flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-gray-600" />
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: isPlaylist ? 'rgba(168, 85, 247, 0.2)' : 'rgba(0, 188, 212, 0.2)',
                border: `1px solid ${isPlaylist ? 'rgba(168, 85, 247, 0.3)' : 'rgba(0, 188, 212, 0.3)'}`,
              }}
            >
              {isPlaylist
                ? <Layers className="w-3.5 h-3.5" style={{ color: '#a855f7' }} />
                : <MessageCircle className="w-3.5 h-3.5" style={{ color: '#00bcd4' }} />
              }
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-200 truncate">{title}</h3>
              {subtitle && !isMinimized && (
                <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ─── Content ─── */}
        {!isMinimized && (
          <>
            {/* ─── Messages Area ─── */}
            <div
              className="flex-1 overflow-y-auto px-4 py-3"
              style={{ background: 'rgba(2, 6, 12, 0.95)' }}
            >
              {messages.length === 0 ? (
                /* ─── Empty State ─── */
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{
                        background: `${accent} 0.1)`,
                        border: `1px solid ${accent} 0.15)`,
                      }}
                    >
                      {isPlaylist
                        ? <Layers className="w-7 h-7" style={{ color: 'rgba(168, 85, 247, 0.5)' }} />
                        : <MessageCircle className="w-7 h-7" style={{ color: 'rgba(0, 188, 212, 0.5)' }} />
                      }
                    </div>
                    <p className="text-gray-500 text-sm">{t.emptyState}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col">
                    {messages.map((msg, index) => {
                      // 🔧 S'assurer que content est une string
                      const contentStr = typeof msg.content === 'string'
                        ? msg.content
                        : (msg.content && typeof msg.content === 'object'
                            ? JSON.stringify(msg.content)
                            : String(msg.content || ''));

                      const { beforeQuestions, questions } = msg.role === 'assistant'
                        ? parseAskQuestions(contentStr)
                        : { beforeQuestions: contentStr, questions: [] };

                      const sameAsPrev = isSameAuthorAsPrev(index);
                      const isUser = msg.role === 'user';

                      return (
                        <div
                          key={msg.id}
                          className="fcw-msg-enter"
                          style={{ marginTop: sameAsPrev ? 4 : 12 }}
                        >
                          <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                            {/* Assistant avatar */}
                            {!isUser && (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                                style={{
                                  background: isPlaylist ? 'rgba(168, 85, 247, 0.2)' : 'rgba(0, 188, 212, 0.3)',
                                  visibility: sameAsPrev ? 'hidden' : 'visible',
                                }}
                              >
                                <Bot className="w-3.5 h-3.5" style={{ color: isPlaylist ? '#c084fc' : '#67e8f9' }} />
                              </div>
                            )}

                            {/* Message Bubble */}
                            <div
                              className="max-w-[80%] px-3.5 py-2.5 relative group"
                              style={isUser ? {
                                background: isPlaylist ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0, 188, 212, 0.15)',
                                border: `1px solid ${isPlaylist ? 'rgba(168, 85, 247, 0.25)' : 'rgba(0, 188, 212, 0.25)'}`,
                                borderRadius: '18px 18px 4px 18px',
                                color: '#e2e8f0',
                              } : {
                                background: '#1a2332',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '18px 18px 18px 4px',
                                color: '#d1d5db',
                              }}
                            >
                              {msg.role === 'assistant' ? (
                                <>
                                  {/* 🔧 v2.0: EnrichedMarkdown avec support [[concepts]] */}
                                  <EnrichedMarkdown language={language} className="text-sm leading-relaxed">
                                    {beforeQuestions}
                                  </EnrichedMarkdown>
                                  {/* Suggestions as horizontal scrollable pills */}
                                  {questions.length > 0 && (
                                    <div
                                      className="fcw-suggestions-scroll mt-3 pt-2 flex gap-2 overflow-x-auto"
                                      style={{
                                        borderTop: '1px solid rgba(255,255,255,0.06)',
                                        flexWrap: 'nowrap',
                                      }}
                                    >
                                      {questions.map((q, qi) => (
                                        <button
                                          key={qi}
                                          onClick={() => !isLoading && onSendMessage(q.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, term, display) => display || term))}
                                          disabled={isLoading}
                                          className="flex-shrink-0 text-xs transition-all duration-200 hover:scale-[1.02] disabled:opacity-50"
                                          style={{
                                            padding: '6px 14px',
                                            borderRadius: 16,
                                            background: 'transparent',
                                            border: `1px solid ${isPlaylist ? 'rgba(168, 85, 247, 0.4)' : 'rgba(0, 188, 212, 0.4)'}`,
                                            color: isPlaylist ? '#c084fc' : '#67e8f9',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {q.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, _term, display) => display || _term)}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className="text-sm leading-relaxed">{contentStr}</p>
                              )}

                              {/* Sources */}
                              {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                  <p className="text-[10px] text-gray-500 mb-1">Sources:</p>
                                  {msg.sources.slice(0, 3).map((src, i) => (
                                    <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[10px] hover:underline"
                                      style={{ color: isPlaylist ? '#c084fc' : '#67e8f9' }}
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />{src.title || 'Source'}
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Copy button (assistant only) */}
                              {msg.role === 'assistant' && (
                                <button
                                  onClick={() => copyToClipboard(contentStr, msg.id)}
                                  className="mt-1.5 text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  {copiedId === msg.id
                                    ? <><Check className="w-2.5 h-2.5" />{t.copied}</>
                                    : <><Copy className="w-2.5 h-2.5" />{t.copy}</>
                                  }
                                </button>
                              )}
                            </div>

                            {/* User avatar */}
                            {isUser && (
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                                style={{
                                  background: isPlaylist ? 'rgba(168, 85, 247, 0.5)' : 'rgba(0, 188, 212, 0.5)',
                                  visibility: sameAsPrev ? 'hidden' : 'visible',
                                }}
                              >
                                <User className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* ─── Typing Indicator ─── */}
                    {isLoading && (
                      <div className="fcw-msg-enter" style={{ marginTop: 12 }}>
                        <div className="flex gap-2 justify-start">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                            style={{
                              background: isPlaylist ? 'rgba(168, 85, 247, 0.2)' : 'rgba(0, 188, 212, 0.3)',
                            }}
                          >
                            <Bot className="w-3.5 h-3.5" style={{ color: isPlaylist ? '#c084fc' : '#67e8f9' }} />
                          </div>
                          <div
                            className="flex items-center gap-1.5 px-4 py-3"
                            style={{
                              background: '#1a2332',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '18px 18px 18px 4px',
                            }}
                          >
                            <span
                              className="fcw-dot-1 inline-block w-2 h-2 rounded-full"
                              style={{ background: isPlaylist ? '#a855f7' : '#00bcd4' }}
                            />
                            <span
                              className="fcw-dot-2 inline-block w-2 h-2 rounded-full"
                              style={{ background: isPlaylist ? '#a855f7' : '#00bcd4' }}
                            />
                            <span
                              className="fcw-dot-3 inline-block w-2 h-2 rounded-full"
                              style={{ background: isPlaylist ? '#a855f7' : '#00bcd4' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* ─── Input Area ─── */}
            <div className="px-3 py-2.5 flex-shrink-0" style={{ background: 'rgba(6, 10, 18, 0.98)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <div
                  className="flex-1 flex items-center gap-2 px-1 transition-colors"
                  style={{
                    background: 'rgba(15, 20, 30, 0.9)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 24,
                  }}
                >
                  {/* Web toggle pill inside input */}
                  <button
                    type="button"
                    onClick={() => onToggleWebSearch(!webSearchEnabled)}
                    className="flex-shrink-0 flex items-center gap-1 ml-1.5 transition-all"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 500,
                      background: webSearchEnabled
                        ? (isPlaylist ? 'rgba(168, 85, 247, 0.3)' : 'rgba(0, 188, 212, 0.3)')
                        : 'rgba(255,255,255,0.05)',
                      color: webSearchEnabled
                        ? (isPlaylist ? '#c084fc' : '#67e8f9')
                        : '#6b7280',
                      border: webSearchEnabled
                        ? `1px solid ${isPlaylist ? 'rgba(168, 85, 247, 0.4)' : 'rgba(0, 188, 212, 0.4)'}`
                        : '1px solid transparent',
                    }}
                  >
                    <Globe className="w-3 h-3" />
                    {t.web}
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t.placeholder}
                    disabled={isLoading}
                    className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none disabled:opacity-50 py-2.5"
                  />
                </div>
                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="flex-shrink-0 flex items-center justify-center transition-all disabled:opacity-30"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: isPlaylist
                      ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
                      : 'linear-gradient(135deg, #00bcd4, #0097a7)',
                    color: '#fff',
                    boxShadow: (!input.trim() || isLoading) ? 'none' : `0 2px 12px ${isPlaylist ? 'rgba(168, 85, 247, 0.4)' : 'rgba(0, 188, 212, 0.4)'}`,
                  }}
                >
                  <Send className="w-4 h-4" style={{ marginLeft: 1 }} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FloatingChatWindow;
