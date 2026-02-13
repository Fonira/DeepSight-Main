/**
 * CHAT POPUP v5.0 — Modern Messaging UI (iMessage/WhatsApp style)
 * ==============================================================================
 * v5.0:
 * - Bubble-based messages with avatar icons
 * - User bubbles (teal/cyan) right-aligned, AI bubbles (dark grey) left-aligned
 * - Typing indicator with pulsing dots
 * - Smooth auto-scroll & streaming word-by-word
 * - Suggestion chips/pills below last AI message
 * - Slide-in panel animation from the right
 * - Mobile fullscreen overlay
 * - Web toggle in input bar
 * - Simplified markdown in AI bubbles (links in teal)
 * ==============================================================================
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X, Send, Globe, Trash2,
  Minimize2, Maximize2, Bot, ExternalLink,
  Copy, Check, Shield, BookOpen, Sparkles, User, MessageCircle,
  Move
} from 'lucide-react';
import { DeepSightSpinnerMicro } from './ui';
import { parseAskQuestions, ClickableQuestionsBlock } from './ClickableQuestions';
import { EnrichedMarkdown } from './EnrichedMarkdown';

// =============================================================================
// TYPES
// =============================================================================

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
  storageKey?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TEAL = '#00BCD4';
const TEAL_DIM = 'rgba(0, 188, 212, 0.15)';
const TEAL_BORDER = 'rgba(0, 188, 212, 0.3)';
const TEAL_GLOW = 'rgba(0, 188, 212, 0.25)';
const AI_BG = '#1E293B';
const AI_BORDER = 'rgba(255, 255, 255, 0.08)';
const PANEL_BG = '#0B1120';
const HEADER_BG = '#0F172A';
const INPUT_BG = '#111827';
const MOBILE_BREAKPOINT = 768;

// =============================================================================
// RELATIVE TIME FORMATTER
// =============================================================================

function formatRelativeTime(date: Date | undefined, lang: 'fr' | 'en'): string {
  if (!date) return '';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);

  if (diffMin < 1) return lang === 'fr' ? "a l'instant" : 'just now';
  if (diffMin < 60) return lang === 'fr' ? `il y a ${diffMin} min` : `${diffMin}m ago`;
  if (diffHr < 24) {
    const h = new Date(date).getHours().toString().padStart(2, '0');
    const m = new Date(date).getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  const h = new Date(date).getHours().toString().padStart(2, '0');
  const m = new Date(date).getMinutes().toString().padStart(2, '0');
  const d = new Date(date).getDate();
  const mo = new Date(date).getMonth() + 1;
  return `${d}/${mo} ${h}:${m}`;
}

// =============================================================================
// TYPING INDICATOR (3 pulsing dots)
// =============================================================================

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2">
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}` }}
    >
      <Bot className="w-3.5 h-3.5" style={{ color: TEAL }} />
    </div>
    <div
      className="px-4 py-3 rounded-2xl rounded-bl-sm"
      style={{
        background: AI_BG,
        border: `1px solid ${AI_BORDER}`,
      }}
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block w-2 h-2 rounded-full"
            style={{
              backgroundColor: TEAL,
              opacity: 0.6,
              animation: `chatTypingPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  </div>
);

// =============================================================================
// SUGGESTION CHIPS
// =============================================================================

const SuggestionChips: React.FC<{
  questions: string[];
  onQuestionClick: (q: string) => void;
  disabled?: boolean;
  language: 'fr' | 'en';
}> = ({ questions, onQuestionClick, disabled, language }) => {
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-9">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => !disabled && onQuestionClick(q)}
          disabled={disabled}
          className="px-3 py-1.5 text-xs rounded-full transition-all duration-200 disabled:opacity-40"
          style={{
            background: TEAL_DIM,
            border: `1px solid ${TEAL_BORDER}`,
            color: TEAL,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = 'rgba(0, 188, 212, 0.25)';
              e.currentTarget.style.borderColor = TEAL;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = TEAL_DIM;
            e.currentTarget.style.borderColor = TEAL_BORDER;
          }}
        >
          {q}
        </button>
      ))}
    </div>
  );
};

// =============================================================================
// CHAT BUBBLE (unified for user + assistant)
// =============================================================================

const ChatBubble: React.FC<{
  message: ChatMessage;
  language: 'fr' | 'en';
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  onQuestionClick?: (question: string) => void;
  onTimecodeClick?: (seconds: number) => void;
  isLoading?: boolean;
  isLastAssistant?: boolean;
  suggestedQuestions?: string[];
}> = ({
  message, language, onCopy, copiedId,
  onQuestionClick, onTimecodeClick, isLoading,
  isLastAssistant, suggestedQuestions,
}) => {
  const isUser = message.role === 'user';
  const t = language === 'fr'
    ? { copy: 'Copier', copied: 'Copie !', sources: 'Sources' }
    : { copy: 'Copy', copied: 'Copied!', sources: 'Sources' };

  // Parse clickable questions from AI content
  const { beforeQuestions, questions } = useMemo(
    () => (isUser ? { beforeQuestions: message.content, questions: [] } : parseAskQuestions(message.content)),
    [message.content, isUser],
  );

  // Merge parsed [ask:] questions with suggestedQuestions prop for last AI message
  const allChips = useMemo(() => {
    if (!isLastAssistant) return questions;
    const merged = [...questions];
    if (suggestedQuestions) {
      for (const sq of suggestedQuestions) {
        if (!merged.includes(sq)) merged.push(sq);
      }
    }
    return merged.slice(0, 4);
  }, [isLastAssistant, questions, suggestedQuestions]);

  return (
    <div
      className={`flex items-end gap-2 max-w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{ animation: 'chatBubbleIn 0.3s ease-out' }}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: isUser ? 'rgba(0, 188, 212, 0.2)' : TEAL_DIM,
          border: `1px solid ${isUser ? 'rgba(0, 188, 212, 0.4)' : TEAL_BORDER}`,
        }}
      >
        {isUser
          ? <User className="w-3.5 h-3.5" style={{ color: TEAL }} />
          : <Bot className="w-3.5 h-3.5" style={{ color: TEAL }} />
        }
      </div>

      {/* Bubble + meta */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`} style={{ maxWidth: '80%' }}>
        {/* Main bubble */}
        <div
          className="relative px-3.5 py-2.5 text-sm leading-relaxed"
          style={{
            background: isUser
              ? 'linear-gradient(135deg, rgba(0, 188, 212, 0.22) 0%, rgba(0, 150, 170, 0.18) 100%)'
              : AI_BG,
            border: `1px solid ${isUser ? 'rgba(0, 188, 212, 0.35)' : AI_BORDER}`,
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            color: isUser ? '#e0f7fa' : '#e2e8f0',
            wordBreak: 'break-word',
          }}
        >
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <>
              {/* Badges row */}
              {(message.fact_checked || message.web_search_used) && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  {message.fact_checked && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {language === 'fr' ? 'Verifie' : 'Verified'}
                    </span>
                  )}
                  {message.web_search_used && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                      <Globe className="w-2.5 h-2.5" />
                      Web
                    </span>
                  )}
                </div>
              )}

              {/* Markdown content */}
              <div className="chat-bubble-markdown">
                <EnrichedMarkdown language={language} onTimecodeClick={onTimecodeClick}>
                  {beforeQuestions}
                </EnrichedMarkdown>
              </div>

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${AI_BORDER}` }}>
                  <div className="flex items-center gap-1 mb-1">
                    <BookOpen className="w-3 h-3" style={{ color: TEAL }} />
                    <span className="text-[10px] font-medium" style={{ color: TEAL }}>{t.sources}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {message.sources.slice(0, 3).map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors duration-150"
                        style={{
                          background: TEAL_DIM,
                          border: `1px solid ${TEAL_BORDER}`,
                          color: TEAL,
                        }}
                      >
                        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate max-w-[140px]">{src.title || src.domain || 'Source'}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy button */}
              <div className="flex justify-end mt-1">
                <button
                  onClick={() => onCopy(message.content, message.id)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors duration-150"
                  style={{ color: copiedId === message.id ? '#6ee7b7' : '#6b7280' }}
                  onMouseEnter={(e) => { if (copiedId !== message.id) e.currentTarget.style.color = TEAL; }}
                  onMouseLeave={(e) => { if (copiedId !== message.id) e.currentTarget.style.color = '#6b7280'; }}
                >
                  {copiedId === message.id
                    ? <><Check className="w-3 h-3" />{t.copied}</>
                    : <><Copy className="w-3 h-3" />{t.copy}</>
                  }
                </button>
              </div>
            </>
          )}
        </div>

        {/* Timestamp */}
        <span
          className="text-[10px] mt-0.5 px-1"
          style={{ color: '#64748b' }}
        >
          {formatRelativeTime(message.timestamp || new Date(), language)}
        </span>

        {/* Suggestion chips (only on last AI message) */}
        {isLastAssistant && allChips.length > 0 && onQuestionClick && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <div className="flex items-center gap-1 w-full mb-1">
              <Sparkles className="w-3 h-3" style={{ color: TEAL }} />
              <span className="text-[10px] font-medium" style={{ color: TEAL }}>
                {language === 'fr' ? 'Pour aller plus loin' : 'Go deeper'}
              </span>
            </div>
            {allChips.map((q, i) => (
              <button
                key={i}
                onClick={() => !isLoading && onQuestionClick(q)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs rounded-full transition-all duration-200 disabled:opacity-40"
                style={{
                  background: TEAL_DIM,
                  border: `1px solid ${TEAL_BORDER}`,
                  color: '#b2ebf2',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'rgba(0, 188, 212, 0.28)';
                    e.currentTarget.style.borderColor = TEAL;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = TEAL_DIM;
                  e.currentTarget.style.borderColor = TEAL_BORDER;
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// HOOKS: DRAG & DROP
// =============================================================================

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
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
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

// =============================================================================
// HOOKS: RESIZE
// =============================================================================

const useResizable = (
  initialSize: Size, minSize: Size, maxSize: Size,
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

// =============================================================================
// HOOKS: IS MOBILE
// =============================================================================

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// =============================================================================
// CSS INJECTION (animations for typing dots + bubbles + slide-in)
// =============================================================================

const CHAT_STYLES_ID = 'deepsight-chat-styles';

function injectChatStyles() {
  if (document.getElementById(CHAT_STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = CHAT_STYLES_ID;
  style.textContent = `
    @keyframes chatTypingPulse {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }
    @keyframes chatBubbleIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes chatSlideIn {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes chatSlideInMobile {
      from { opacity: 0; transform: translateY(100%); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Simplified markdown inside chat bubbles */
    .chat-bubble-markdown .enriched-markdown {
      font-size: 14px !important;
      line-height: 1.6 !important;
    }
    .chat-bubble-markdown .enriched-markdown h1,
    .chat-bubble-markdown .enriched-markdown h2,
    .chat-bubble-markdown .enriched-markdown h3,
    .chat-bubble-markdown .enriched-markdown h4 {
      font-size: 0.95em !important;
      font-weight: 600 !important;
      margin: 0.5em 0 0.3em !important;
      border: none !important;
      padding: 0 !important;
    }
    .chat-bubble-markdown .enriched-markdown p {
      margin: 0.4em 0 !important;
    }
    .chat-bubble-markdown .enriched-markdown a {
      color: ${TEAL} !important;
      border-bottom-color: rgba(0, 188, 212, 0.3) !important;
    }
    .chat-bubble-markdown .enriched-markdown ul,
    .chat-bubble-markdown .enriched-markdown ol {
      margin: 0.3em 0 !important;
      padding-left: 1.2em !important;
    }
    .chat-bubble-markdown .enriched-markdown li {
      margin: 0.15em 0 !important;
    }
    .chat-bubble-markdown .enriched-markdown blockquote {
      border-left-color: ${TEAL} !important;
      background: rgba(0, 188, 212, 0.08) !important;
    }
    .chat-bubble-markdown .enriched-markdown code {
      background: rgba(255, 255, 255, 0.08) !important;
      font-size: 0.85em !important;
    }

    /* Custom scrollbar for chat */
    .chat-messages-scroll::-webkit-scrollbar {
      width: 4px;
    }
    .chat-messages-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .chat-messages-scroll::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    .chat-messages-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  `;
  document.head.appendChild(style);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChatPopup: React.FC<ChatPopupProps> = ({
  isOpen, onToggle, videoTitle, summaryId, messages, quota,
  isLoading = false, webSearchEnabled = false, isProUser = false,
  suggestedQuestions = [], onSendMessage, onClearHistory, onToggleWebSearch,
  onTimecodeClick, language = 'fr', storageKey = 'chat-popup',
}) => {
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Inject CSS animations once
  useEffect(() => { injectChatStyles(); }, []);

  // Slide-in entry animation
  useEffect(() => {
    if (isOpen && !hasAnimated) setHasAnimated(true);
  }, [isOpen, hasAnimated]);

  // Reset animation when closed
  useEffect(() => {
    if (!isOpen) setHasAnimated(false);
  }, [isOpen]);

  // Layout persistence
  const getStoredLayout = () => {
    try {
      const stored = localStorage.getItem(`${storageKey}-layout`);
      if (stored) return JSON.parse(stored);
    } catch { /* invalid stored layout JSON */ }
    return null;
  };

  const defaultPosition = { x: window.innerWidth - 460, y: window.innerHeight - 720 };
  const defaultSize = { width: 420, height: 680 };
  const storedLayout = getStoredLayout();

  const { position, setPosition, isDragging, handleMouseDown } = useDraggable(
    storedLayout?.position || defaultPosition,
    (pos) => { localStorage.setItem(`${storageKey}-layout`, JSON.stringify({ position: pos, size })); }
  );

  const { size, setSize, isResizing, handleResizeStart } = useResizable(
    storedLayout?.size || defaultSize,
    { width: 320, height: 400 },
    { width: 800, height: 900 },
    (newSize) => { localStorage.setItem(`${storageKey}-layout`, JSON.stringify({ position, size: newSize })); }
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) setTimeout(() => inputRef.current?.focus(), 200);
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
    if (isMobile) return;
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
    title: 'DeepSight AI',
    placeholder: 'Message...',
    noVideo: 'Analysez une video pour commencer',
    askQuestion: 'Posez votre question...',
    clear: 'Effacer',
    thinking: 'Reflexion...',
    quota: 'questions',
  } : {
    title: 'DeepSight AI',
    placeholder: 'Message...',
    noVideo: 'Analyze a video to start',
    askQuestion: 'Ask your question...',
    clear: 'Clear',
    thinking: 'Thinking...',
    quota: 'questions',
  };

  if (!isOpen) return null;

  // Find last assistant message index
  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  // Mobile: fullscreen overlay
  const windowStyle: React.CSSProperties = isMobile ? {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    animation: 'chatSlideInMobile 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  } : isMaximized ? {
    position: 'fixed',
    top: '20px',
    left: '20px',
    width: 'calc(100vw - 40px)',
    height: 'calc(100vh - 40px)',
    zIndex: 9999,
    animation: hasAnimated ? undefined : 'chatSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  } : {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: isMinimized ? '280px' : `${size.width}px`,
    height: isMinimized ? '48px' : `${size.height}px`,
    zIndex: 9999,
    animation: hasAnimated ? undefined : 'chatSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div style={windowStyle}>
      <div
        className="w-full h-full overflow-hidden flex flex-col relative"
        style={{
          borderRadius: isMobile ? 0 : isMinimized ? '12px' : '16px',
          background: PANEL_BG,
          border: isMobile ? 'none' : `1px solid ${isDragging || isResizing ? TEAL : 'rgba(255, 255, 255, 0.08)'}`,
          boxShadow: isMobile ? 'none' : `0 24px 80px rgba(0, 0, 0, 0.8), 0 0 60px ${TEAL_GLOW}`,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {/* RESIZE HANDLES (desktop only, not minimized/maximized) */}
        {!isMobile && !isMinimized && !isMaximized && (
          <>
            <div onMouseDown={(e) => handleResizeStart('nw', e)} className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('ne', e)} className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('sw', e)} className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('se', e)} className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('n', e)} className="absolute top-0 left-4 right-4 h-2 cursor-n-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('s', e)} className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('w', e)} className="absolute left-0 top-4 bottom-4 w-2 cursor-w-resize z-50" />
            <div onMouseDown={(e) => handleResizeStart('e', e)} className="absolute right-0 top-4 bottom-4 w-2 cursor-e-resize z-50" />
          </>
        )}

        {/* ============ HEADER ============ */}
        <div
          onMouseDown={!isMobile ? handleMouseDown : undefined}
          onDoubleClick={handleDoubleClick}
          className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 select-none"
          style={{
            background: HEADER_BG,
            borderBottom: `1px solid rgba(255, 255, 255, 0.06)`,
            cursor: isMobile ? 'default' : isDragging ? 'grabbing' : 'grab',
          }}
        >
          <div className="flex items-center gap-2.5">
            {!isMobile && <Move className="w-3.5 h-3.5 text-gray-600" />}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}` }}
            >
              <MessageCircle className="w-4 h-4" style={{ color: TEAL }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>{t.title}</h3>
              {!isMinimized && quota && (
                <p className="text-[10px]" style={{ color: '#64748b' }}>
                  {quota.daily_used}/{quota.daily_limit} {t.quota}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && !isMinimized && onClearHistory && (
              <button
                onClick={onClearHistory}
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{ color: '#6b7280' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent'; }}
                title={t.clear}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {!isMobile && (
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{ color: '#6b7280' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent'; }}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg transition-colors duration-150"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============ BODY ============ */}
        {!isMinimized && (
          <>
            {/* Video context bar */}
            {videoTitle && (
              <div
                className="px-4 py-1.5 text-[11px] truncate"
                style={{
                  background: 'rgba(0, 188, 212, 0.06)',
                  borderBottom: `1px solid rgba(0, 188, 212, 0.1)`,
                  color: TEAL,
                }}
              >
                {videoTitle}
              </div>
            )}

            {/* MESSAGES AREA */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 chat-messages-scroll"
              style={{ background: PANEL_BG }}
            >
              {!summaryId ? (
                /* No video state */
                <div className="h-full flex items-center justify-center">
                  <div className="text-center p-6">
                    <div
                      className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                      style={{ background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}` }}
                    >
                      <MessageCircle className="w-8 h-8" style={{ color: TEAL, opacity: 0.6 }} />
                    </div>
                    <p className="text-sm" style={{ color: '#64748b' }}>{t.noVideo}</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                /* Empty state with suggested questions */
                <div className="h-full flex flex-col items-center justify-center py-6">
                  <div
                    className="w-14 h-14 mb-4 rounded-2xl flex items-center justify-center"
                    style={{ background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}` }}
                  >
                    <Bot className="w-7 h-7" style={{ color: TEAL, opacity: 0.7 }} />
                  </div>
                  <p className="text-sm mb-1" style={{ color: '#e2e8f0' }}>
                    {t.askQuestion}
                  </p>
                  <p className="text-xs mb-6" style={{ color: '#64748b' }}>
                    {language === 'fr' ? 'Je suis la pour vous aider' : "I'm here to help"}
                  </p>
                  {suggestedQuestions.length > 0 && (
                    <div className="w-full max-w-[90%] space-y-2">
                      {suggestedQuestions.slice(0, 3).map((q, i) => (
                        <button
                          key={i}
                          onClick={() => { if (!isLoading && summaryId) onSendMessage(q); }}
                          disabled={isLoading}
                          className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-200 disabled:opacity-50"
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            color: '#cbd5e1',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = TEAL_DIM;
                            e.currentTarget.style.borderColor = TEAL_BORDER;
                            e.currentTarget.style.color = '#e0f7fa';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.color = '#cbd5e1';
                          }}
                        >
                          <span style={{ color: TEAL, marginRight: '8px' }}>&#8594;</span>
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Messages list */
                <>
                  {messages.map((msg, idx) => (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      language={language}
                      onCopy={copyToClipboard}
                      copiedId={copiedId}
                      onQuestionClick={onSendMessage}
                      onTimecodeClick={onTimecodeClick}
                      isLoading={isLoading}
                      isLastAssistant={idx === lastAssistantIndex && !isLoading}
                      suggestedQuestions={suggestedQuestions}
                    />
                  ))}
                  {isLoading && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* ============ INPUT BAR ============ */}
            <div
              className="flex-shrink-0 px-3 py-3"
              style={{
                background: INPUT_BG,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                {/* Web search toggle (compact, in input bar) */}
                {isProUser && onToggleWebSearch && (
                  <button
                    type="button"
                    onClick={() => onToggleWebSearch(!webSearchEnabled)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 flex-shrink-0"
                    style={{
                      background: webSearchEnabled ? 'rgba(0, 188, 212, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${webSearchEnabled ? 'rgba(0, 188, 212, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                      color: webSearchEnabled ? TEAL : '#6b7280',
                    }}
                    title={webSearchEnabled ? 'Web search ON' : 'Web search OFF'}
                  >
                    <Globe className="w-3 h-3" />
                    <span>Web</span>
                  </button>
                )}

                {/* Input field */}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.placeholder}
                  disabled={!!(isLoading || !summaryId || (quota && !quota.can_ask))}
                  className="flex-1 px-4 py-2.5 text-sm disabled:opacity-50 transition-all duration-200 outline-none"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '24px',
                    color: '#f1f5f9',
                    caretColor: TEAL,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 188, 212, 0.4)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                />

                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading || !summaryId}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:opacity-30"
                  style={{
                    background: input.trim()
                      ? `linear-gradient(135deg, ${TEAL}, #0097A7)`
                      : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${input.trim() ? 'rgba(0, 188, 212, 0.5)' : 'rgba(255, 255, 255, 0.06)'}`,
                    color: input.trim() ? '#fff' : '#4b5563',
                    boxShadow: input.trim() ? `0 4px 16px ${TEAL_GLOW}` : 'none',
                  }}
                >
                  <Send className="w-4 h-4" style={{ transform: 'rotate(-45deg)' }} />
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
