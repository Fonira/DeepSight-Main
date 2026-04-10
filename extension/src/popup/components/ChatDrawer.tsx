import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ChatMessage, ChatOptions } from '../../types';
import { escapeHtml, markdownToFullHtml } from '../../utils/sanitize';
import { BackIcon, SendIcon } from './Icons';
import { useTranslation } from '../../i18n/useTranslation';

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
  const text = content.replace(regex, '').trim();
  return { text, questions };
}

function cleanQuestion(q: string): string {
  return q.replace(/\[\[([^\]]+)\]\]/g, '$1').trim();
}

// ── Plan helpers ──────────────────────────────────────────────────
const PAID_PLANS = ['plus', 'pro', 'starter', 'student', 'etudiant', 'expert', 'team', 'equipe'];
function canUseWebSearch(plan?: string): boolean {
  if (!plan) return false;
  return PAID_PLANS.includes(plan.toLowerCase());
}

// ── Props ─────────────────────────────────────────────────────────
interface ChatDrawerProps {
  summaryId: number;
  videoTitle: string;
  onClose: () => void;
  onSessionExpired?: () => void;
  /** User plan id for web search gating */
  userPlan?: string;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  summaryId,
  videoTitle,
  onClose,
  onSessionExpired,
  userPlan,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const canWs = canUseWebSearch(userPlan);
  const suggestions = t.chat.suggestions;

  // Load chat history on mount
  useEffect(() => {
    loadHistory();
  }, [summaryId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function loadHistory(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'GET_CHAT_HISTORY',
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

  async function sendMessage(customQuestion?: string, forceWebSearch?: boolean): Promise<void> {
    const question = customQuestion || input.trim();
    if (!question || loading) return;

    if (!customQuestion) setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    const options: ChatOptions = {};
    if (forceWebSearch || (canWs && webSearchEnabled)) {
      options.use_web_search = true;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'ASK_QUESTION',
        data: { summaryId, question, options },
      });

      if (response.success) {
        const result = response.result as { response: string; web_search_used: boolean };
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.response,
            web_search_used: result.web_search_used,
          },
        ]);
      } else {
        const errorMsg = response.error || '';
        if (errorMsg.includes('SESSION_EXPIRED')) {
          setSessionExpired(true);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `${t.common.error}\u00a0: ${errorMsg || t.chat.unavailable}` },
          ]);
        }
      }
    } catch (e) {
      const errorMsg = (e as Error).message || '';
      if (errorMsg.includes('SESSION_EXPIRED')) {
        setSessionExpired(true);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `${t.common.error}\u00a0: ${errorMsg}` },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
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

  const truncatedTitle = videoTitle.length > 30 ? videoTitle.substring(0, 30) + '...' : videoTitle;

  return (
    <div className="chat-view">
      {/* Header */}
      <div className="chat-header">
        <button className="icon-btn" onClick={onClose} title={t.common.back}>
          <BackIcon size={18} />
        </button>
        <span className="chat-header-title">{t.synthesis.chat}&nbsp;: &laquo;&nbsp;{truncatedTitle}&nbsp;&raquo;</span>
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={messagesRef}>
        {loadingHistory ? (
          <div className="chat-welcome">
            <div className="loading-spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-welcome">
            <span className="chat-welcome-icon">{'\u{1F4AC}'}</span>
            <p>{t.chat.welcome}</p>
            {/* Clickable suggestions */}
            <div className="chat-suggestions">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  className="chat-suggestion-btn"
                  onClick={() => handleSuggestionClick(q)}
                  disabled={loading || sessionExpired}
                >
                  <span className="chat-suggestion-arrow">{'\u2192'}</span>
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

      {/* Session expired banner */}
      {sessionExpired && (
        <div className="chat-session-expired">
          <span>{'\u{1F512}'} {t.chat.sessionExpired}</span>
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

      {/* Input area with web search toggle */}
      <div className="chat-input-area">
        <button
          className={`chat-ws-toggle ${webSearchEnabled && canWs ? 'chat-ws-active' : ''}`}
          onClick={() => {
            if (canWs) setWebSearchEnabled(!webSearchEnabled);
          }}
          title={canWs
            ? (webSearchEnabled ? t.chat.webSearchDisable : t.chat.webSearchEnable)
            : t.chat.webSearchLocked
          }
          style={{ opacity: canWs ? 1 : 0.4 }}
        >
          {canWs ? '\uD83C\uDF10' : '\uD83D\uDD12'}
        </button>
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sessionExpired ? t.chat.expiredPlaceholder : t.chat.inputPlaceholder}
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

// ── Message Bubble with [ask:] parsing ───────────────────────────
interface MessageBubbleProps {
  msg: ChatMessage;
  onQuestionClick: (question: string) => void;
  webEnrichedLabel: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, onQuestionClick, webEnrichedLabel }) => {
  const parsed = useMemo(() => {
    if (msg.role === 'user') return { text: msg.content, questions: [] };
    return parseAskQuestions(msg.content);
  }, [msg.content, msg.role]);

  return (
    <div className={`chat-msg chat-msg-${msg.role}`}>
      {msg.role === 'assistant' ? (
        <>
          {msg.web_search_used && (
            <div className="chat-web-badge">{'\u{1F310}'} {webEnrichedLabel}</div>
          )}
          <div
            className="chat-md-content"
            dangerouslySetInnerHTML={{
              __html: markdownToFullHtml(escapeHtml(parsed.text)),
            }}
          />
          {/* [ask:] question pills */}
          {parsed.questions.length > 0 && (
            <div className="chat-ask-pills">
              {parsed.questions.map((q, i) => (
                <button
                  key={i}
                  className="chat-ask-pill"
                  onClick={() => onQuestionClick(q)}
                >
                  <span className="chat-ask-arrow">{'\u2192'}</span>
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
