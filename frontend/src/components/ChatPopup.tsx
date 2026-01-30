/**
 * 🗨️ CHAT POPUP v4.0 — Fenêtre Flottante, Draggable & Resizable
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🆕 v4.0:
 * • Fenêtre déplaçable (drag & drop sur le header)
 * • Redimensionnable (resize sur tous les bords)
 * • Fond ultra-opaque pour lisibilité maximale
 * • Position et taille mémorisées en localStorage
 * • Double-clic sur header pour maximiser/restaurer
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  MessageCircle, X, Send, Globe, Trash2,
  Minimize2, Maximize2, Sparkles, Bot, ExternalLink,
  Copy, Check, Shield, BookOpen, Lightbulb, Target, Info,
  GripVertical, Move
} from 'lucide-react';
import { DeepSightSpinnerMicro } from './ui';
import { parseAskQuestions, ClickableQuestionsBlock } from './ClickableQuestions';
import { cleanConceptMarkers } from './EnrichedMarkdown';
import { EnrichedMarkdown } from './EnrichedMarkdown';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatSource {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  web_search_used?: boolean;
  fact_checked?: boolean;
  enrichment_level?: string;
  timestamp?: Date;
}

interface ChatQuota {
  can_ask: boolean;
  reason?: string;
  daily_used: number;
  daily_limit: number;
}

interface Position { x: number; y: number; }
interface Size { width: number; height: number; }

interface ChatPopupProps {
  isOpen: boolean;
  onToggle: () => void;
  videoTitle?: string;
  videoId?: string;
  summaryId?: number;
  messages: ChatMessage[];
  quota?: ChatQuota | null;
  isLoading?: boolean;
  webSearchEnabled?: boolean;
  isProUser?: boolean;
  suggestedQuestions?: string[];
  onSendMessage: (message: string) => void;
  onClearHistory?: () => void;
  onToggleWebSearch?: (enabled: boolean) => void;
  onTimecodeClick?: (seconds: number) => void;
  language?: 'fr' | 'en';
  storageKey?: string; // Clé pour sauvegarder position/taille
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT DE MESSAGE ASSISTANT
// ═══════════════════════════════════════════════════════════════════════════════

const AssistantMessage: React.FC<{
  message: ChatMessage;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  language: 'fr' | 'en';
  onQuestionClick?: (question: string) => void;
  onTimecodeClick?: (seconds: number) => void;
  isLoading?: boolean;
}> = ({ message, onCopy, copiedId, language, onQuestionClick, onTimecodeClick, isLoading }) => {
  const t = language === 'fr' ? {
    sources: 'Sources vérifiées',
    copy: 'Copier',
    copied: 'Copié !',
    factChecked: 'Vérifié',
    webEnriched: 'Web',
  } : {
    sources: 'Verified sources',
    copy: 'Copy',
    copied: 'Copied!',
    factChecked: 'Verified',
    webEnriched: 'Web',
  };

  const isFactChecked = message.fact_checked || message.web_search_used || message.sources?.length;
  
  // 🔮 Parser les questions cliquables
  const { beforeQuestions, questions } = parseAskQuestions(message.content);
  
  // Pour le copier-coller, nettoyer les marqueurs
  const cleanContent = cleanConceptMarkers(message.content);
  
  return (
    <div className="w-full max-w-[98%]">
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(8, 25, 35, 1) 0%, rgba(12, 38, 48, 1) 100%)',
          border: '1px solid rgba(0, 160, 160, 0.4)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{
            background: 'linear-gradient(90deg, rgba(0, 140, 140, 0.25) 0%, rgba(0, 110, 110, 0.2) 100%)',
            borderBottom: '1px solid rgba(0, 160, 160, 0.3)',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/30 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-cyan-300" />
            </div>
            <span className="text-xs font-semibold text-cyan-200">Deep Sight AI</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            {isFactChecked && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                <Shield className="w-2.5 h-2.5" />
                {t.factChecked}
              </span>
            )}
            {message.web_search_used && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/30 text-amber-300 border border-amber-500/40">
                <Globe className="w-2.5 h-2.5" />
                {t.webEnriched}
              </span>
            )}
          </div>
        </div>

        {/* Content avec EnrichedMarkdown */}
        <div className="p-3">
          <EnrichedMarkdown
            language={language}
            onTimecodeClick={onTimecodeClick}
          >
            {beforeQuestions}
          </EnrichedMarkdown>
          
          {/* 🔮 Questions cliquables */}
          {questions.length > 0 && onQuestionClick && (
            <ClickableQuestionsBlock
              questions={questions}
              onQuestionClick={onQuestionClick}
              variant="video"
              disabled={isLoading}
            />
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="px-3 py-2 border-t border-cyan-500/25" style={{ background: 'rgba(0, 70, 70, 0.3)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-medium text-cyan-300">{t.sources}</span>
            </div>
            <div className="space-y-1">
              {message.sources.slice(0, 3).map((source, i) => (
                <a
                  key={i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/25 hover:bg-cyan-500/25 transition-all text-xs"
                >
                  <ExternalLink className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <span className="text-cyan-200 truncate">{source.title || 'Source'}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end px-3 py-1.5 border-t border-cyan-500/15">
          <button
            onClick={() => onCopy(message.content, message.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-all"
          >
            {copiedId === message.id ? (
              <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">{t.copied}</span></>
            ) : (
              <><Copy className="w-3 h-3" /><span>{t.copy}</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 HOOK POUR DRAG & DROP
// ═══════════════════════════════════════════════════════════════════════════════

const useDraggable = (
  initialPosition: Position,
  onPositionChange: (pos: Position) => void
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState(initialPosition);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onPositionChange(position);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onPositionChange, position]);

  return { position, setPosition, isDragging, handleMouseDown };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 HOOK POUR RESIZE
// ═══════════════════════════════════════════════════════════════════════════════

const useResizable = (
  initialSize: Size,
  minSize: Size,
  maxSize: Size,
  onSizeChange: (size: Size) => void
) => {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  const handleResizeStart = useCallback((direction: string, e: React.MouseEvent) => {
    setIsResizing(direction);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;
      
      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;

      if (isResizing.includes('e')) newWidth += deltaX;
      if (isResizing.includes('w')) newWidth -= deltaX;
      if (isResizing.includes('s')) newHeight += deltaY;
      if (isResizing.includes('n')) newHeight -= deltaY;

      newWidth = Math.max(minSize.width, Math.min(maxSize.width, newWidth));
      newHeight = Math.max(minSize.height, Math.min(maxSize.height, newHeight));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      onSizeChange(size);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minSize, maxSize, onSizeChange, size]);

  return { size, setSize, isResizing, handleResizeStart };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ChatPopup: React.FC<ChatPopupProps> = ({
  isOpen, onToggle, videoTitle, videoId, summaryId, messages, quota,
  isLoading = false, webSearchEnabled = false, isProUser = false,
  suggestedQuestions = [], onSendMessage, onClearHistory, onToggleWebSearch,
  onTimecodeClick, language = 'fr', storageKey = 'chat-popup',
}) => {
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger position/taille depuis localStorage
  const getStoredLayout = () => {
    try {
      const stored = localStorage.getItem(`${storageKey}-layout`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  };

  const defaultPosition = { x: window.innerWidth - 520, y: window.innerHeight - 720 };
  const defaultSize = { width: 480, height: 680 };
  const storedLayout = getStoredLayout();

  // Hooks pour drag & resize
  const { position, setPosition, isDragging, handleMouseDown } = useDraggable(
    storedLayout?.position || defaultPosition,
    (pos) => {
      localStorage.setItem(`${storageKey}-layout`, JSON.stringify({ position: pos, size }));
    }
  );

  const { size, setSize, isResizing, handleResizeStart } = useResizable(
    storedLayout?.size || defaultSize,
    { width: 320, height: 400 },
    { width: 800, height: 900 },
    (newSize) => {
      localStorage.setItem(`${storageKey}-layout`, JSON.stringify({ position, size: newSize }));
    }
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, isMinimized]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !summaryId) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDoubleClick = () => {
    if (isMaximized) {
      setIsMaximized(false);
      setSize(storedLayout?.size || defaultSize);
      setPosition(storedLayout?.position || defaultPosition);
    } else {
      setIsMaximized(true);
      setSize({ width: window.innerWidth - 40, height: window.innerHeight - 40 });
      setPosition({ x: 20, y: 20 });
    }
  };

  const t = language === 'fr' ? {
    title: 'Chat IA', subtitle: 'Fact-checking intégré',
    placeholder: 'Posez une question...', noVideo: 'Analysez une vidéo pour commencer',
    suggested: 'Questions suggérées', clear: 'Effacer', thinking: 'Analyse...',
    factCheck: 'Fact-check', drag: 'Déplacer',
  } : {
    title: 'AI Chat', subtitle: 'Built-in fact-checking',
    placeholder: 'Ask a question...', noVideo: 'Analyze a video to start',
    suggested: 'Suggested questions', clear: 'Clear', thinking: 'Analyzing...',
    factCheck: 'Fact-check', drag: 'Drag',
  };

  if (!isOpen) return null;

  // Style selon l'état
  const windowStyle: React.CSSProperties = isMaximized ? {
    position: 'fixed',
    top: '20px',
    left: '20px',
    width: 'calc(100vw - 40px)',
    height: 'calc(100vh - 40px)',
    zIndex: 9999,
  } : {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: isMinimized ? '280px' : `${size.width}px`,
    height: isMinimized ? '52px' : `${size.height}px`,
    zIndex: 9999,
  };

  return (
    <div
      className="transition-shadow duration-200"
      style={windowStyle}
    >
      <div
        className="w-full h-full rounded-xl overflow-hidden flex flex-col relative"
        style={{
          background: 'linear-gradient(180deg, rgba(4, 12, 18, 1) 0%, rgba(6, 18, 26, 1) 100%)',
          border: `2px solid ${isDragging || isResizing ? 'rgba(0, 200, 200, 0.8)' : 'rgba(212, 168, 83, 0.7)'}`,
          boxShadow: isDragging || isResizing 
            ? '0 20px 60px rgba(0, 200, 200, 0.3), 0 0 100px rgba(0, 150, 150, 0.2)'
            : '0 16px 48px rgba(0, 0, 0, 0.8), 0 0 80px rgba(0, 120, 120, 0.15)',
        }}
      >
        {/* ═══ RESIZE HANDLES ═══ */}
        {!isMinimized && !isMaximized && (
          <>
            {/* Coins */}
            <div onMouseDown={(e) => handleResizeStart('nw', e)} className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('ne', e)} className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('sw', e)} className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('se', e)} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" />
            {/* Bords */}
            <div onMouseDown={(e) => handleResizeStart('n', e)} className="absolute top-0 left-4 right-4 h-2 cursor-n-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('s', e)} className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('w', e)} className="absolute left-0 top-4 bottom-4 w-2 cursor-w-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('e', e)} className="absolute right-0 top-4 bottom-4 w-2 cursor-e-resize z-50" />
          </>
        )}

        {/* ═══ HEADER (Draggable) ═══ */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 select-none"
          style={{
            background: 'linear-gradient(90deg, rgba(10, 45, 55, 1) 0%, rgba(15, 60, 70, 1) 50%, rgba(10, 45, 55, 1) 100%)',
            borderBottom: '2px solid rgba(212, 168, 83, 0.5)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-gray-500" />
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/30 border border-cyan-500/40">
              <Bot className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-400">{t.title}</h3>
              {!isMinimized && <p className="text-[10px] text-cyan-400/80">{t.subtitle}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {quota && !isMinimized && (
              <span className="px-2 py-0.5 rounded bg-black/50 text-[10px] font-medium text-gray-300 mr-1">
                {quota.daily_used}/{quota.daily_limit}
              </span>
            )}
            {messages.length > 0 && !isMinimized && onClearHistory && (
              <button onClick={onClearHistory} className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/20 transition-all" title={t.clear}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onToggle} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        {!isMinimized && (
          <>
            {videoTitle && (
              <div className="px-3 py-1.5 border-b border-cyan-500/25 bg-cyan-500/10">
                <p className="text-[10px] text-cyan-300/90 truncate flex items-center gap-1.5">
                  <Target className="w-3 h-3 flex-shrink-0" />{videoTitle}
                </p>
              </div>
            )}

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: 'rgba(2, 8, 12, 0.8)' }}>
              {!summaryId ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center bg-amber-500/15 border border-amber-500/30">
                      <Sparkles className="w-7 h-7 text-amber-500/70" />
                    </div>
                    <p className="text-gray-400 text-sm">{t.noVideo}</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="space-y-4 py-3">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center bg-cyan-500/20 border border-cyan-500/40">
                      <Lightbulb className="w-6 h-6 text-cyan-400 animate-pulse" />
                    </div>
                    <p className="text-gray-300 text-sm">{language === 'fr' ? 'Posez une question' : 'Ask a question'}</p>
                  </div>
                  {suggestedQuestions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider flex items-center gap-1.5 px-1">
                        <Info className="w-3 h-3" />{t.suggested}
                      </p>
                      {suggestedQuestions.slice(0, 3).map((q, i) => (
                        <button key={i} onClick={() => { if (!isLoading && summaryId) onSendMessage(q); }} disabled={isLoading}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-200 bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all disabled:opacity-50">
                          <span className="text-cyan-400 mr-1.5">→</span>{q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'user' ? (
                        <div className="max-w-[85%] rounded-xl rounded-tr-sm px-3 py-2"
                          style={{ background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.95) 0%, rgba(170, 130, 50, 0.95) 100%)' }}>
                          <p className="text-sm font-medium text-gray-900">{msg.content}</p>
                        </div>
                      ) : (
                        <AssistantMessage 
                          message={msg} 
                          onCopy={copyToClipboard} 
                          copiedId={copiedId} 
                          language={language}
                          onQuestionClick={onSendMessage}
                          onTimecodeClick={onTimecodeClick}
                          isLoading={isLoading}
                        />
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-xl px-4 py-3 bg-cyan-900/40 border border-cyan-500/30">
                        <div className="flex items-center gap-2">
                          <DeepSightSpinnerMicro />
                          <span className="text-sm text-gray-300">{t.thinking}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* INPUT */}
            <div className="flex-shrink-0 p-3 border-t border-cyan-500/30" style={{ background: 'rgba(5, 15, 22, 1)' }}>
              {isProUser && onToggleWebSearch && (
                <div className="flex items-center mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <div className={`relative w-8 h-4 rounded-full transition-all ${webSearchEnabled ? 'bg-emerald-500/50' : 'bg-gray-700/70'}`}
                      onClick={() => onToggleWebSearch(!webSearchEnabled)}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${webSearchEnabled ? 'left-4 bg-emerald-400' : 'left-0.5 bg-gray-500'}`} />
                    </div>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1"><Shield className="w-3 h-3" />{t.factCheck}</span>
                  </label>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder={t.placeholder} disabled={isLoading || !summaryId || (quota && !quota.can_ask)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-100 placeholder-gray-500 bg-cyan-900/40 border border-cyan-500/30 focus:border-cyan-400/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50 transition-all" />
                <button type="submit" disabled={!input.trim() || isLoading || !summaryId}
                  className="px-3 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-40 flex items-center"
                  style={{ background: input.trim() ? 'linear-gradient(135deg, rgba(212, 168, 83, 0.95) 0%, rgba(170, 130, 50, 0.95) 100%)' : 'rgba(70, 70, 70, 0.5)', color: input.trim() ? '#0a1a1f' : '#555' }}>
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

export default ChatPopup;
