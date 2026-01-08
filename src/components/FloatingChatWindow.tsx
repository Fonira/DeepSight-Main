/**
 * 🗨️ FLOATING CHAT WINDOW v2.1 — Fenêtre Chat Universelle
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 🔧 CORRECTIONS v2.1:
 *   - ✅ Import correct de cleanConceptMarkers depuis EnrichedMarkdown
 *   - ✅ Support complet des [[concepts]] dans le chat
 *   - ✅ Meilleur rendu des messages assistant avec markdown
 *   - ✅ Déplaçable (drag sur le header)
 *   - ✅ Redimensionnable (resize sur les bords)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, Loader2, Globe, Bot, User,
  Minimize2, Maximize2, Layers, Move, Copy, Check,
  ExternalLink
} from 'lucide-react';
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
  
  const t = language === 'fr' ? {
    web: 'Web',
    placeholder: 'Posez votre question...',
    thinking: 'Réflexion en cours...',
    copy: 'Copier',
    copied: 'Copié !',
  } : {
    web: 'Web',
    placeholder: 'Ask your question...',
    thinking: 'Thinking...',
    copy: 'Copy',
    copied: 'Copied!',
  };

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 99999 }}>
      <div
        className="pointer-events-auto flex flex-col"
        style={{
          position: 'absolute',
          top: position.y,
          left: position.x,
          width: isMinimized ? 280 : size.width,
          height: isMinimized ? 'auto' : size.height,
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
          background: isPlaylist 
            ? 'linear-gradient(145deg, rgba(30, 10, 50, 0.98) 0%, rgba(50, 20, 80, 0.98) 100%)'
            : 'linear-gradient(145deg, rgba(5, 15, 25, 0.98) 0%, rgba(10, 30, 40, 0.98) 100%)',
          backdropFilter: 'blur(16px)',
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

        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 select-none"
          style={{
            background: isPlaylist 
              ? 'linear-gradient(90deg, rgba(88, 28, 135, 0.8) 0%, rgba(126, 34, 206, 0.8) 50%, rgba(88, 28, 135, 0.8) 100%)'
              : 'linear-gradient(90deg, rgba(10, 45, 55, 1) 0%, rgba(15, 60, 70, 1) 50%, rgba(10, 45, 55, 1) 100%)',
            borderBottom: `2px solid ${isPlaylist ? 'rgba(168, 85, 247, 0.5)' : 'rgba(212, 168, 83, 0.5)'}`,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-gray-500" />
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPlaylist ? 'bg-purple-500/30 border border-purple-500/40' : 'bg-cyan-500/30 border border-cyan-500/40'}`}>
              {isPlaylist ? <Layers className="w-4 h-4 text-purple-300" /> : <MessageCircle className="w-4 h-4 text-cyan-300" />}
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isPlaylist ? 'text-purple-300' : 'text-amber-400'}`}>{title}</h3>
              {subtitle && !isMinimized && <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{subtitle}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: 'rgba(2, 6, 10, 0.9)' }}>
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <Bot className={`w-12 h-12 mx-auto mb-3 ${isPlaylist ? 'text-purple-400/50' : 'text-cyan-400/50'}`} />
                    <p className="text-gray-400 text-sm">
                      {language === 'fr' 
                        ? `Posez une question sur ${isPlaylist ? 'ce corpus' : 'cette vidéo'}`
                        : `Ask about this ${type}`}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const { beforeQuestions, questions } = msg.role === 'assistant' 
                      ? parseAskQuestions(msg.content) 
                      : { beforeQuestions: msg.content, questions: [] };
                    
                    return (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isPlaylist ? 'bg-purple-500/30' : 'bg-cyan-500/30'}`}>
                          <Bot className={`w-3.5 h-3.5 ${isPlaylist ? 'text-purple-300' : 'text-cyan-300'}`} />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                        msg.role === 'user' 
                          ? isPlaylist ? 'bg-purple-600/80 text-white' : 'bg-amber-500/90 text-gray-900'
                          : 'bg-gray-800/80 text-gray-200'
                      }`}>
                        {msg.role === 'assistant' ? (
                          <>
                            {/* 🔧 v2.0: EnrichedMarkdown avec support [[concepts]] */}
                            <EnrichedMarkdown language={language} className="text-sm">
                              {beforeQuestions}
                            </EnrichedMarkdown>
                            {questions.length > 0 && (
                              <ClickableQuestionsBlock
                                questions={questions}
                                onQuestionClick={onSendMessage}
                                variant={isPlaylist ? 'playlist' : 'video'}
                                disabled={isLoading}
                              />
                            )}
                          </>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/20">
                            <p className="text-[10px] text-gray-400 mb-1">Sources:</p>
                            {msg.sources.slice(0, 3).map((src, i) => (
                              <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" 
                                className="flex items-center gap-1 text-[10px] text-cyan-400 hover:underline">
                                <ExternalLink className="w-2.5 h-2.5" />{src.title || 'Source'}
                              </a>
                            ))}
                          </div>
                        )}
                        {msg.role === 'assistant' && (
                          <button onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="mt-1 text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1">
                            {copiedId === msg.id ? <><Check className="w-2.5 h-2.5" />{t.copied}</> : <><Copy className="w-2.5 h-2.5" />{t.copy}</>}
                          </button>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isPlaylist ? 'bg-purple-700/50' : 'bg-amber-600/50'}`}>
                          <User className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </div>
                  )})}
                  {isLoading && (
                    <div className="flex gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPlaylist ? 'bg-purple-500/30' : 'bg-cyan-500/30'}`}>
                        <Loader2 className={`w-3.5 h-3.5 animate-spin ${isPlaylist ? 'text-purple-300' : 'text-cyan-300'}`} />
                      </div>
                      <div className="bg-gray-800/80 rounded-xl px-3 py-2">
                        <span className="text-sm text-gray-400">{t.thinking}</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-700/50" style={{ background: 'rgba(4, 10, 16, 1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => onToggleWebSearch(!webSearchEnabled)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                    webSearchEnabled 
                      ? isPlaylist ? 'bg-purple-500/80 text-white' : 'bg-cyan-500/80 text-white'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  {t.web}
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.placeholder}
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-100 placeholder-gray-500 bg-gray-800/60 border border-gray-600/50 focus:border-cyan-500/50 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={`px-3 py-2 rounded-lg transition-all disabled:opacity-40 ${
                    isPlaylist ? 'bg-purple-500 hover:bg-purple-600' : 'bg-amber-500 hover:bg-amber-600'
                  } text-white`}
                >
                  <Send className="w-4 h-4" />
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
