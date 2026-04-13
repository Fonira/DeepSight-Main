/**
 * 🗨️ FLOATING CHAT WINDOW v5.0 — Web Search Enriched + Plan Gating
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🔧 REFONTE v5.0:
 *   - ✅ Design unifié avec CorpusChat (PlaylistDetailPage)
 *   - ✅ Suggestions empty state → envoi direct (onSendMessage)
 *   - ✅ Bouton "Approfondir avec recherche web" après chaque msg assistant
 *   - ✅ Plan-based gating (🔒 free, compteur payants)
 *   - ✅ Badge "Enrichi par le web 🌐" sur messages web_search_used
 *   - ✅ Quota restant affiché au hover du toggle Globe
 *   - ✅ Conserve: drag, resize, copy, EnrichedMarkdown, [ask:] cliquables
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  MessageSquare,
  X,
  Send,
  Globe,
  Bot,
  User,
  Minimize2,
  Maximize2,
  Move,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Search,
  Lock,
} from "lucide-react";
import { DeepSightSpinnerMicro } from "./ui/DeepSightSpinner";
import { parseAskQuestions } from "./ClickableQuestions";
import { EnrichedMarkdown, cleanConceptMarkers } from "./EnrichedMarkdown";

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatSource {
  title: string;
  url: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  web_search_used?: boolean;
}

interface Position {
  x: number;
  y: number;
}
interface Size {
  width: number;
  height: number;
}

interface WebSearchQuota {
  used: number;
  limit: number;
  remaining: number;
}

interface FloatingChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  type: "video" | "playlist";
  messages: ChatMessage[];
  isLoading: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: (enabled: boolean) => void;
  onSendMessage: (
    message: string,
    options?: { useWebSearch?: boolean },
  ) => void;
  onClearHistory?: () => void;
  markdownComponents?: Record<string, React.ComponentType<any>>;
  language?: "fr" | "en";
  storageKey?: string;
  // v5.0 — Web Search Gating
  userPlan?: string;
  webSearchQuota?: WebSearchQuota;
  onUpgrade?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CSS KEYFRAMES (injected once)
// ═══════════════════════════════════════════════════════════════════════════════

const STYLE_ID = "fcw-v5-styles";

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes fcw-slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fcw-fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fcw-panel-enter {
      animation: fcw-slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .fcw-msg-enter {
      animation: fcw-fadeIn 0.2s ease-out both;
    }
  `;
  document.head.appendChild(style);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 PLAN HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const canUseWebSearch = (plan?: string): boolean => {
  if (!plan) return false;
  return plan.toLowerCase() === "pro";
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

const useDraggable = (initialPos: Position, storageKey: string) => {
  const [position, setPosition] = useState<Position>(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}-pos`);
      return stored ? JSON.parse(stored) : initialPos;
    } catch {
      return initialPos;
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, input, textarea")) return;
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      e.preventDefault();
    },
    [position],
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const x = Math.max(
        0,
        Math.min(window.innerWidth - 100, e.clientX - dragOffset.current.x),
      );
      const y = Math.max(
        0,
        Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y),
      );
      setPosition({ x, y });
    };
    const handleUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem(`${storageKey}-pos`, JSON.stringify(position));
      } catch {
        /* */
      }
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging, position, storageKey]);

  return { position, setPosition, isDragging, handleMouseDown };
};

const useResizable = (
  initialSize: Size,
  minSize: Size,
  maxSize: Size,
  storageKey: string,
) => {
  const [size, setSize] = useState<Size>(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}-size`);
      return stored ? JSON.parse(stored) : initialSize;
    } catch {
      return initialSize;
    }
  });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const startRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleResizeStart = useCallback(
    (dir: string, e: React.MouseEvent) => {
      setIsResizing(dir);
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: size.width,
        h: size.height,
      };
      e.preventDefault();
      e.stopPropagation();
    },
    [size],
  );

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      let w = startRef.current.w,
        h = startRef.current.h;
      if (isResizing.includes("e")) w += dx;
      if (isResizing.includes("w")) w -= dx;
      if (isResizing.includes("s")) h += dy;
      if (isResizing.includes("n")) h -= dy;
      w = Math.max(minSize.width, Math.min(maxSize.width, w));
      h = Math.max(minSize.height, Math.min(maxSize.height, h));
      setSize({ width: w, height: h });
    };
    const handleUp = () => {
      setIsResizing(null);
      try {
        localStorage.setItem(`${storageKey}-size`, JSON.stringify(size));
      } catch {
        /* */
      }
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing, minSize, maxSize, size, storageKey]);

  return { size, setSize, isResizing, handleResizeStart };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL — v5.0 Web Search Enriched + Plan Gating
// ═══════════════════════════════════════════════════════════════════════════════

export const FloatingChatWindow: React.FC<FloatingChatWindowProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  type,
  messages,
  isLoading,
  webSearchEnabled,
  onToggleWebSearch,
  onSendMessage,
  onClearHistory,
  language = "fr",
  storageKey = "floating-chat",
  userPlan,
  webSearchQuota,
  onUpgrade,
}) => {
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQuotaTooltip, setShowQuotaTooltip] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const defaultPos = useMemo(
    () =>
      isMobile
        ? { x: 0, y: 0 }
        : {
            x: Math.max(
              0,
              (typeof window !== "undefined" ? window.innerWidth : 1280) - 620,
            ),
            y: 100,
          },
    [isMobile],
  );
  const defaultSize = useMemo(
    () =>
      isMobile
        ? {
            width: typeof window !== "undefined" ? window.innerWidth : 375,
            height: typeof window !== "undefined" ? window.innerHeight : 812,
          }
        : { width: 580, height: 650 },
    [isMobile],
  );

  const { position, setPosition, isDragging, handleMouseDown } = useDraggable(
    defaultPos,
    storageKey,
  );
  const { size, setSize, isResizing, handleResizeStart } = useResizable(
    defaultSize,
    { width: 350, height: 400 },
    { width: 900, height: 850 },
    storageKey,
  );

  const hasWebSearch = canUseWebSearch(userPlan);
  const isFree = !userPlan || userPlan === "free";
  const quotaRemaining = webSearchQuota?.remaining ?? 0;
  const quotaLimit = webSearchQuota?.limit ?? 0;
  const quotaUsed = webSearchQuota?.used ?? 0;

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized)
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen, isMinimized]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = async (content: string, msgId: string) => {
    try {
      const cleanContent = cleanConceptMarkers(content);
      await navigator.clipboard.writeText(cleanContent);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleDoubleClick = () => {
    if (isMaximized) {
      setSize(defaultSize);
      setPosition(defaultPos);
    } else {
      setSize({
        width: window.innerWidth - 80,
        height: window.innerHeight - 120,
      });
      setPosition({ x: 40, y: 60 });
    }
    setIsMaximized(!isMaximized);
  };

  // 🔍 "Approfondir" — renvoie la dernière question user avec web search forcé
  const handleDeepen = (msgIndex: number) => {
    if (!hasWebSearch || isLoading) return;
    // Trouver la dernière question user AVANT ce message assistant
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        onSendMessage(messages[i].content, { useWebSearch: true });
        return;
      }
    }
  };

  if (!isOpen) return null;

  const isPlaylist = type === "playlist";

  const t =
    language === "fr"
      ? {
          web: "Web",
          placeholder: isPlaylist
            ? "Posez une question sur le corpus..."
            : "Posez une question sur cette vidéo...",
          analyzing: isPlaylist
            ? "Analyse du corpus..."
            : "Analyse en cours...",
          copy: "Copier",
          copied: "Copié !",
          headerTitle: isPlaylist ? "Chat IA Corpus" : "Chat IA Vidéo",
          emptyTitle: isPlaylist
            ? "Posez une question sur le corpus"
            : "Posez une question sur la vidéo",
          emptySubtitle: isPlaylist
            ? "L'IA a accès à toutes les synthèses et transcriptions du corpus pour vous répondre."
            : "L'IA a accès à la synthèse et la transcription de la vidéo pour vous répondre.",
          clearHistory: "Effacer l'historique",
          deepen: "Approfondir avec recherche web",
          deepenLocked: "Disponible dès le plan Pro",
          webLocked: "Plan Pro requis",
          webEnriched: "Enrichi par le web",
          quotaLabel: "recherches ce mois",
          upgradeHint: "Obtenez des réponses enrichies par le web",
        }
      : {
          web: "Web",
          placeholder: isPlaylist
            ? "Ask a question about the corpus..."
            : "Ask a question about this video...",
          analyzing: isPlaylist ? "Analyzing corpus..." : "Analyzing...",
          copy: "Copy",
          copied: "Copied!",
          headerTitle: isPlaylist ? "Corpus AI Chat" : "Video AI Chat",
          emptyTitle: isPlaylist
            ? "Ask a question about the corpus"
            : "Ask a question about the video",
          emptySubtitle: isPlaylist
            ? "The AI has access to all corpus summaries and transcriptions to answer you."
            : "The AI has access to the video summary and transcription to answer you.",
          clearHistory: "Clear history",
          deepen: "Deepen with web search",
          deepenLocked: "Available from Pro plan",
          webLocked: "Pro plan required",
          webEnriched: "Web enriched",
          quotaLabel: "searches this month",
          upgradeHint: "Get web-enriched answers",
        };

  const suggestedQuestions =
    language === "fr"
      ? isPlaylist
        ? [
            "Quels sont les thèmes principaux abordés ?",
            "Quels points de vue divergent entre les vidéos ?",
            "Résume les conclusions les plus importantes.",
            "Quelles vidéos se contredisent ?",
          ]
        : [
            "Quels sont les points clés de cette vidéo ?",
            "Quels arguments sont les plus solides ?",
            "Y a-t-il des biais dans le raisonnement ?",
            "Résume en 3 bullet points.",
          ]
      : isPlaylist
        ? [
            "What are the main themes covered?",
            "Which videos have divergent viewpoints?",
            "Summarize the most important conclusions.",
            "Which videos contradict each other?",
          ]
        : [
            "What are the key takeaways?",
            "Which arguments are strongest?",
            "Are there any reasoning biases?",
            "Summarize in 3 bullet points.",
          ];

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99999 }}
    >
      <div
        className="pointer-events-auto flex flex-col fcw-panel-enter"
        style={
          isMobile
            ? {
                position: "fixed",
                inset: 0,
                overflow: "hidden",
                background: "var(--bg-secondary, #12121a)",
              }
            : {
                position: "absolute",
                top: position.y,
                left: position.x,
                width: isMinimized ? 300 : size.width,
                height: isMinimized ? "auto" : size.height,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow:
                  "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
                background: "var(--bg-secondary, #12121a)",
                transition:
                  isDragging || isResizing ? "none" : "width 0.2s, height 0.2s",
              }
        }
      >
        {/* Resize Handles (desktop only) */}
        {!isMobile && !isMinimized && (
          <>
            <div
              onMouseDown={(e) => handleResizeStart("se", e)}
              className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize z-50"
            />
            <div
              onMouseDown={(e) => handleResizeStart("s", e)}
              className="absolute left-4 right-4 bottom-0 h-2 cursor-s-resize z-50"
            />
            <div
              onMouseDown={(e) => handleResizeStart("e", e)}
              className="absolute right-0 top-4 bottom-4 w-2 cursor-e-resize z-50"
            />
          </>
        )}

        {/* ─── Header (style CorpusChat) ─── */}
        <div
          onMouseDown={!isMobile ? handleMouseDown : undefined}
          onDoubleClick={!isMobile ? handleDoubleClick : undefined}
          className="p-4 border-b border-border-subtle flex items-center justify-between flex-shrink-0 select-none"
          style={{
            cursor: isMobile ? "default" : isDragging ? "grabbing" : "grab",
          }}
        >
          <div className="flex items-center gap-2">
            {!isMobile && (
              <Move className="w-3.5 h-3.5 text-text-muted opacity-40" />
            )}
            <Bot className="w-5 h-5 text-accent-primary" />
            <span className="font-semibold text-text-primary">
              {t.headerTitle}
            </span>
            {subtitle && !isMinimized && (
              <span className="text-xs text-text-muted truncate max-w-[120px] sm:max-w-[200px]">
                — {subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && onClearHistory && (
              <button
                onClick={onClearHistory}
                className="p-2 rounded hover:bg-bg-tertiary transition-colors text-text-muted hover:text-red-400"
                title={t.clearHistory}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 rounded hover:bg-bg-tertiary transition-colors text-text-muted hover:text-text-primary"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-bg-tertiary transition-colors text-text-muted hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Content ─── */}
        {!isMinimized && (
          <>
            {/* ─── Messages Area ─── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                /* ─── Empty State ─── */
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-text-muted opacity-50" />
                  <h3 className="font-semibold text-text-primary mb-2">
                    {t.emptyTitle}
                  </h3>
                  <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
                    {t.emptySubtitle}
                  </p>
                  {/* ✅ v5.0: Suggestions → envoi direct via onSendMessage */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => !isLoading && onSendMessage(q)}
                        disabled={isLoading}
                        className="px-3 py-2 bg-bg-tertiary hover:bg-bg-secondary text-text-secondary text-sm rounded-lg transition-colors text-left disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ─── Message List ─── */
                messages.map((msg, msgIndex) => {
                  const contentStr =
                    typeof msg.content === "string"
                      ? msg.content
                      : msg.content && typeof msg.content === "object"
                        ? JSON.stringify(msg.content)
                        : String(msg.content || "");

                  const { beforeQuestions, questions } =
                    msg.role === "assistant"
                      ? parseAskQuestions(contentStr)
                      : { beforeQuestions: contentStr, questions: [] };

                  const isUser = msg.role === "user";
                  const isWebEnriched = msg.web_search_used === true;

                  return (
                    <div
                      key={msg.id}
                      className={`fcw-msg-enter flex gap-3 ${isUser ? "justify-end" : ""}`}
                    >
                      {/* Assistant avatar */}
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-accent-primary" />
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[80%] rounded-xl p-4 relative group ${
                          isUser
                            ? "bg-accent-primary text-white"
                            : "bg-bg-secondary text-text-secondary"
                        }`}
                      >
                        {/* ✅ v5.0: Badge "Enrichi par le web 🌐" */}
                        {!isUser && isWebEnriched && (
                          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/10">
                            <Globe className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                              {t.webEnriched}
                            </span>
                          </div>
                        )}

                        {msg.role === "assistant" ? (
                          <>
                            <div className="prose prose-invert prose-sm max-w-none">
                              <EnrichedMarkdown
                                language={language}
                                className="text-sm leading-relaxed"
                              >
                                {beforeQuestions}
                              </EnrichedMarkdown>
                            </div>

                            {/* [ask:] Suggestion questions → envoi direct */}
                            {questions.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                                {questions.map((q, qi) => (
                                  <button
                                    key={qi}
                                    onClick={() =>
                                      !isLoading &&
                                      onSendMessage(
                                        q.replace(
                                          /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
                                          (_, term, display) => display || term,
                                        ),
                                      )
                                    }
                                    disabled={isLoading}
                                    className="px-3 py-1.5 bg-bg-tertiary hover:bg-bg-secondary text-text-secondary text-xs rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {q.replace(
                                      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
                                      (_, _term, display) => display || _term,
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="whitespace-pre-wrap">{contentStr}</p>
                        )}

                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {language === "fr" ? "Sources :" : "Sources:"}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {msg.sources.map((src, i) => (
                                <a
                                  key={i}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-0.5 bg-white/10 rounded-full hover:bg-white/15 transition-colors flex items-center gap-1"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {src.title || "Source"}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Copy button + Approfondir (assistant only) */}
                        {msg.role === "assistant" && (
                          <div className="mt-2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Copy */}
                            <button
                              onClick={() =>
                                copyToClipboard(contentStr, msg.id)
                              }
                              className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  {t.copied}
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  {t.copy}
                                </>
                              )}
                            </button>

                            {/* ✅ v5.0: Bouton "Approfondir avec recherche web" */}
                            {!isWebEnriched && (
                              <button
                                onClick={() => {
                                  if (isFree && onUpgrade) {
                                    onUpgrade();
                                  } else {
                                    handleDeepen(msgIndex);
                                  }
                                }}
                                disabled={
                                  isLoading ||
                                  (hasWebSearch && quotaRemaining <= 0)
                                }
                                className={`text-xs flex items-center gap-1 transition-colors ${
                                  isFree
                                    ? "text-text-muted/60 cursor-pointer"
                                    : hasWebSearch && quotaRemaining > 0
                                      ? "text-accent-primary/70 hover:text-accent-primary cursor-pointer"
                                      : "text-text-muted/40 cursor-not-allowed"
                                } disabled:opacity-40`}
                                title={
                                  isFree
                                    ? t.deepenLocked
                                    : `${t.deepen} (${quotaRemaining}/${quotaLimit})`
                                }
                              >
                                {isFree ? (
                                  <Lock className="w-3 h-3" />
                                ) : (
                                  <Search className="w-3 h-3" />
                                )}
                                <span>{t.deepen}</span>
                                {isFree && (
                                  <Lock className="w-2.5 h-2.5 ml-0.5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* User avatar */}
                      {isUser && (
                        <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-text-muted" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 fcw-msg-enter">
                  <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-accent-primary" />
                  </div>
                  <div className="bg-bg-secondary rounded-xl p-4">
                    <div className="flex items-center gap-2 text-text-muted">
                      <DeepSightSpinnerMicro />
                      <span className="text-sm">{t.analyzing}</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ─── Upgrade Banner (Free users, after first interaction) ─── */}
            {isFree && messages.length > 0 && messages.length <= 4 && (
              <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-accent-primary/5 border border-accent-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-accent-primary" />
                  <span className="text-xs text-text-secondary">
                    {t.upgradeHint}
                  </span>
                </div>
                {onUpgrade && (
                  <button
                    onClick={onUpgrade}
                    className="text-xs font-medium text-accent-primary hover:underline"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )}

            {/* ─── Input Area ─── */}
            <div className="p-4 border-t border-border-subtle">
              <div className="flex items-end gap-2">
                {/* Web Search Toggle — with gating */}
                <div
                  className="relative"
                  onMouseEnter={() => setShowQuotaTooltip(true)}
                  onMouseLeave={() => setShowQuotaTooltip(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isFree) {
                        onUpgrade?.();
                      } else if (hasWebSearch && quotaRemaining > 0) {
                        onToggleWebSearch(!webSearchEnabled);
                      }
                    }}
                    disabled={!isFree && (!hasWebSearch || quotaRemaining <= 0)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                      isFree
                        ? "bg-bg-tertiary border-border-subtle text-text-muted/60 cursor-pointer"
                        : webSearchEnabled && hasWebSearch
                          ? "bg-accent-primary/15 border-accent-primary/30 text-accent-primary"
                          : "bg-bg-tertiary border-border-subtle text-text-muted hover:text-text-secondary"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={
                      isFree
                        ? t.webLocked
                        : hasWebSearch
                          ? `${quotaRemaining}/${quotaLimit} ${t.quotaLabel}`
                          : t.webLocked
                    }
                  >
                    {isFree ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <Globe className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    {t.web}
                    {/* Quota mini-badge for paid users */}
                    {hasWebSearch && !isFree && webSearchQuota && (
                      <span className="ml-1 text-[10px] opacity-70">
                        {quotaRemaining}/{quotaLimit}
                      </span>
                    )}
                  </button>

                  {/* Quota Tooltip on hover */}
                  {showQuotaTooltip && (
                    <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg shadow-xl text-xs whitespace-nowrap z-50">
                      {isFree ? (
                        <span className="text-text-muted">{t.webLocked}</span>
                      ) : hasWebSearch && webSearchQuota ? (
                        <div className="space-y-1">
                          <div className="text-text-primary font-medium">
                            {quotaUsed}/{quotaLimit} {t.quotaLabel}
                          </div>
                          <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-accent-primary transition-all"
                              style={{
                                width: `${Math.min(100, (quotaUsed / Math.max(1, quotaLimit)) * 100)}%`,
                              }}
                            />
                          </div>
                          <div className="text-text-muted">
                            {quotaRemaining}{" "}
                            {language === "fr" ? "restantes" : "remaining"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-text-muted">{t.webLocked}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Textarea */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.placeholder}
                  className="flex-1 resize-none bg-bg-secondary text-text-primary placeholder:text-text-muted rounded-xl px-4 py-3 border border-border-subtle focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/30 outline-none transition-colors text-sm"
                  rows={1}
                  style={{ maxHeight: "120px" }}
                />

                {/* Send Button */}
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isLoading}
                  className="btn btn-primary p-3 rounded-xl disabled:opacity-30 transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FloatingChatWindow;
