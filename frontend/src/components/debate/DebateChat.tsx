/**
 * DebateChat — Chat contextuel pour interroger un débat terminé
 * Utilise debateApi.sendChat / getChatHistory
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { debateApi } from '../../services/api';
import type { DebateChatMessage } from '../../services/api';
import { DeepSightSpinnerMicro } from '../ui/DeepSightSpinner';

interface DebateChatProps {
  debateId: number;
  debateTopic?: string;
}

export const DebateChat: React.FC<DebateChatProps> = ({ debateId, debateTopic }) => {
  const [messages, setMessages] = useState<DebateChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Load chat history on mount ───
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await debateApi.getChatHistory(debateId);
        if (!cancelled) setMessages(res.messages);
      } catch {
        // No history yet — that's fine
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [debateId]);

  // ─── Auto-scroll to bottom ───
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Send message ───
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setInput('');
    setError(null);
    setSending(true);

    // Optimistic user message
    const optimisticMsg: DebateChatMessage = {
      id: Date.now(),
      debate_id: debateId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const response = await debateApi.sendChat({ debate_id: debateId, message: trimmed });
      setMessages((prev) => [...prev, response]);
    } catch {
      setError('Erreur lors de l\'envoi. Cliquez pour réessayer.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleRetry = () => {
    // Remove the last user message and re-send it
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      setMessages((prev) => prev.filter((m) => m.id !== lastUserMsg.id));
      setInput(lastUserMsg.content);
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Chat du débat</h3>
          {debateTopic && (
            <p className="text-xs text-white/40 truncate">{debateTopic}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <DeepSightSpinnerMicro />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-8 h-8 text-white/10 mb-2" />
            <p className="text-sm text-white/30">Posez une question sur ce débat...</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed border ${
                    msg.role === 'user'
                      ? 'bg-indigo-500/20 border-indigo-500/30 text-white/90'
                      : 'bg-white/5 border-white/10 text-white/80'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Sending indicator */}
        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="rounded-lg px-3.5 py-2.5 bg-white/5 border border-white/10">
              <DeepSightSpinnerMicro />
            </div>
          </motion.div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <button
            onClick={handleRetry}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            {error}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question sur ce débat..."
            disabled={sending}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
