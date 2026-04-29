import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ChatMessage, ChatOptions, MessageResponse } from "../../types";
import Browser from "../../utils/browser-polyfill";
import { escapeHtml, markdownToFullHtml } from "../../utils/sanitize";
import { BackIcon, SendIcon } from "../shared/Icons";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";
import { useTranslation } from "../../i18n/useTranslation";

// ── Inline trash icon ──────────────────────────────────────────────
// Local inline SVG (the shared Icons module does not export a trash icon
// and we don't want to bloat it just for this single use case).
const TrashIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

// ── [ask:] parser ──────────────────────────────────────────────────
interface ParsedContent {
  text: string;
  questions: string[];
}

function parseAskQuestions(content: string): ParsedContent {
  const regex = /\[ask:\s*([^\]]+)\]/g;
  const questions: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const q = match[1].trim();
    if (q) questions.push(q);
  }
  const text = content.replace(regex, "").trim();
  return { text, questions };
}

function cleanQuestion(q: string): string {
  return q.replace(/\[\[([^\]]+)\]\]/g, "$1").trim();
}

// ── Plan helpers ──────────────────────────────────────────────────
const PAID_PLANS = [
  "plus",
  "pro",
  "starter",
  "student",
  "etudiant",
  "expert",
  "team",
  "equipe",
];
function canUseWebSearch(plan?: string): boolean {
  if (!plan) return false;
  return PAID_PLANS.includes(plan.toLowerCase());
}

// ── Props ─────────────────────────────────────────────────────────
interface ChatViewProps {
  summaryId: number;
  videoTitle: string;
  onClose: () => void;
  onSessionExpired?: () => void;
  userPlan?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  summaryId,
  videoTitle,
  onClose,
  onSessionExpired,
  userPlan,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const canWs = canUseWebSearch(userPlan);
  const suggestions = t.chat.suggestions;

  useEffect(() => {
    loadHistory();
  }, [summaryId]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function loadHistory(): Promise<void> {
    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "GET_CHAT_HISTORY",
        data: { summaryId },
      });
      if (response.success && Array.isArray(response.result)) {
        setMessages(response.result as ChatMessage[]);
      }
    } catch {
      // History load failed — start fresh
    } finally {
      setLoadingHistory(false);
    }
  }

  async function sendMessage(
    customQuestion?: string,
    forceWebSearch?: boolean,
  ): Promise<void> {
    const question = customQuestion || input.trim();
    if (!question || loading) return;

    if (!customQuestion) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    const options: ChatOptions = {};
    if (forceWebSearch || (canWs && webSearchEnabled)) {
      options.use_web_search = true;
    }

    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "ASK_QUESTION",
        data: { summaryId, question, options },
      });

      if (response.success) {
        const result = response.result as {
          response: string;
          web_search_used: boolean;
        };
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.response,
            web_search_used: result.web_search_used,
          },
        ]);
      } else {
        const errorMsg = response.error || "";
        if (errorMsg.includes("SESSION_EXPIRED")) {
          setSessionExpired(true);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `${t.common.error}\u00a0: ${errorMsg || t.chat.unavailable}`,
            },
          ]);
        }
      }
    } catch (e) {
      const errorMsg = (e as Error).message || "";
      if (errorMsg.includes("SESSION_EXPIRED")) {
        setSessionExpired(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${t.common.error}\u00a0: ${errorMsg}`,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClearClick(): Promise<void> {
    if (clearing) return;
    // window.confirm is available in the side panel context (it's a browser
    // window). Mirrors web (Task 8) behaviour: warn that the unified clear
    // also drops voice transcripts, since the backend default is
    // include_voice=true.
    const confirmed = window.confirm(
      `${t.chat.clear.confirmTitle}\n\n${t.chat.clear.confirmBody}`,
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "CLEAR_CHAT_HISTORY",
        data: { summaryId, includeVoice: true },
      });
      if (response.success) {
        setMessages([]);
      } else {
        const errorMsg = response.error || "";
        if (errorMsg.includes("SESSION_EXPIRED")) {
          setSessionExpired(true);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `${t.chat.clear.errorPrefix} : ${errorMsg || t.chat.unavailable}`,
            },
          ]);
        }
      }
    } catch (e) {
      const errorMsg = (e as Error).message || "";
      if (errorMsg.includes("SESSION_EXPIRED")) {
        setSessionExpired(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${t.chat.clear.errorPrefix} : ${errorMsg}`,
          },
        ]);
      }
    } finally {
      setClearing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleQuestionClick(question: string): void {
    sendMessage(cleanQuestion(question));
  }

  function handleSuggestionClick(question: string): void {
    sendMessage(question);
  }

  const truncatedTitle =
    videoTitle.length > 30 ? videoTitle.substring(0, 30) + "..." : videoTitle;

  return (
    <div className="chat-view">
      {/* Header */}
      <div className="chat-header">
        <button className="icon-btn" onClick={onClose} title={t.common.back}>
          <BackIcon size={18} />
        </button>
        <span className="chat-header-title">
          {t.synthesis.chat}&nbsp;: &laquo;&nbsp;{truncatedTitle}&nbsp;&raquo;
        </span>
        <button
          className="icon-btn chat-clear-btn"
          onClick={() => {
            void handleClearClick();
          }}
          disabled={clearing || loadingHistory || messages.length === 0}
          title={t.chat.clear.buttonAriaLabel}
          aria-label={t.chat.clear.buttonAriaLabel}
        >
          <TrashIcon size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={messagesRef}>
        {loadingHistory ? (
          <div className="chat-welcome">
            <DeepSightSpinner size="xs" speed="fast" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-welcome">
            <DoodleIcon
              name="robot"
              size={32}
              color="var(--accent-primary)"
              style={{ opacity: 0.6 }}
            />
            <p>{t.chat.welcome}</p>
            <div className="chat-suggestions">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  className="chat-suggestion-btn"
                  onClick={() => handleSuggestionClick(q)}
                  disabled={loading || sessionExpired}
                >
                  <span className="chat-suggestion-arrow">{"\u2192"}</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              onQuestionClick={handleQuestionClick}
              webEnrichedLabel={t.chat.webEnriched}
            />
          ))
        )}

        {/* Typing indicator */}
        {loading && (
          <div className="chat-typing">
            <div className="chat-typing-dot" />
            <div className="chat-typing-dot" />
            <div className="chat-typing-dot" />
          </div>
        )}
      </div>

      {/* Session expired */}
      {sessionExpired && (
        <div className="chat-session-expired">
          <span>
            {"\u{1F512}"} {t.chat.sessionExpired}
          </span>
          <button
            className="chat-reconnect-btn"
            onClick={() => {
              if (onSessionExpired) {
                onSessionExpired();
              } else {
                onClose();
              }
            }}
          >
            {t.chat.reconnect}
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        <button
          className={`chat-ws-toggle ${webSearchEnabled && canWs ? "chat-ws-active" : ""}`}
          onClick={() => {
            if (canWs) setWebSearchEnabled(!webSearchEnabled);
          }}
          title={
            canWs
              ? webSearchEnabled
                ? t.chat.webSearchDisable
                : t.chat.webSearchEnable
              : t.chat.webSearchLocked
          }
          style={{ opacity: canWs ? 1 : 0.4 }}
        >
          <DoodleIcon
            name="globe"
            size={14}
            color={
              webSearchEnabled && canWs
                ? "var(--accent-primary)"
                : "var(--text-muted)"
            }
          />
        </button>
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            sessionExpired ? t.chat.expiredPlaceholder : t.chat.inputPlaceholder
          }
          disabled={loading || sessionExpired}
          autoFocus
        />
        <button
          className="chat-send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading || sessionExpired}
          title={t.common.send}
        >
          <SendIcon size={16} />
        </button>
      </div>
    </div>
  );
};

// ── Message Bubble ───────────────────────────
interface MessageBubbleProps {
  msg: ChatMessage;
  onQuestionClick: (question: string) => void;
  webEnrichedLabel: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  onQuestionClick,
  webEnrichedLabel,
}) => {
  const parsed = useMemo(() => {
    if (msg.role === "user") return { text: msg.content, questions: [] };
    return parseAskQuestions(msg.content);
  }, [msg.content, msg.role]);

  return (
    <div className={`chat-msg chat-msg-${msg.role}`}>
      {msg.role === "assistant" ? (
        <>
          {msg.web_search_used && (
            <div className="chat-web-badge">
              <DoodleIcon
                name="globe"
                size={12}
                color="var(--accent-primary)"
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                  marginRight: 4,
                }}
              />
              {webEnrichedLabel}
            </div>
          )}
          <div
            className="chat-md-content"
            dangerouslySetInnerHTML={{
              __html: markdownToFullHtml(escapeHtml(parsed.text)),
            }}
          />
          {parsed.questions.length > 0 && (
            <div className="chat-ask-pills">
              {parsed.questions.map((q, i) => (
                <button
                  key={i}
                  className="chat-ask-pill"
                  onClick={() => onQuestionClick(q)}
                >
                  <span className="chat-ask-arrow">{"\u2192"}</span>
                  {cleanQuestion(q)}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        msg.content
      )}
    </div>
  );
};
