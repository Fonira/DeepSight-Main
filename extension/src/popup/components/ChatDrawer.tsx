import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types';
import { escapeHtml, markdownToSafeHtml } from '../../utils/sanitize';
import { BackIcon, SendIcon } from './Icons';

interface ChatDrawerProps {
  summaryId: number;
  videoTitle: string;
  onClose: () => void;
  onSessionExpired?: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ summaryId, videoTitle, onClose, onSessionExpired }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

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

  async function sendMessage(): Promise<void> {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'ASK_QUESTION',
        data: { summaryId, question },
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
            { role: 'assistant', content: `Erreur\u00a0: ${errorMsg || 'R\u00e9ponse indisponible'}` },
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
          { role: 'assistant', content: `Erreur\u00a0: ${errorMsg}` },
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

  const truncatedTitle = videoTitle.length > 30 ? videoTitle.substring(0, 30) + '...' : videoTitle;

  return (
    <div className="chat-view">
      {/* Header */}
      <div className="chat-header">
        <button className="icon-btn" onClick={onClose} title="Retour">
          <BackIcon size={18} />
        </button>
        <span className="chat-header-title">Chat&nbsp;: &laquo;&nbsp;{truncatedTitle}&nbsp;&raquo;</span>
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
            <p>Pose une question sur cette vid\u00e9o.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
              {msg.role === 'assistant' ? (
                <>
                  <span
                    dangerouslySetInnerHTML={{
                      __html: markdownToSafeHtml(escapeHtml(msg.content)),
                    }}
                  />
                  {msg.web_search_used && (
                    <div className="chat-web-badge">{'\u{1F310}'} Recherche web utilis\u00e9e</div>
                  )}
                </>
              ) : (
                msg.content
              )}
            </div>
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
          <span>{'\u{1F512}'} Session expirée</span>
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
            Se reconnecter
          </button>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sessionExpired ? 'Session expirée...' : 'Pose une question...'}
          disabled={loading || sessionExpired}
          autoFocus
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || loading || sessionExpired}
          title="Envoyer"
        >
          <SendIcon size={16} />
        </button>
      </div>
    </div>
  );
};
