/**
 * DemoChatMini — Interface de chat demo compacte pour la landing page.
 * 3 messages max, suggestions pre-remplies, CTA inscription apres epuisement.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { demoApi } from '../../services/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DemoChatMiniProps {
  demoSessionId: string;
  videoTitle: string;
  onExhausted: () => void;
}

const MAX_MESSAGES = 3;

export default function DemoChatMini({ demoSessionId, videoTitle, onExhausted }: DemoChatMiniProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(MAX_MESSAGES);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load suggestions on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const result = await demoApi.getSuggestions(demoSessionId);
        setSuggestions(result.suggestions || []);
      } catch {
        setSuggestions([
          'Quel est le point principal ?',
          'Quels arguments sont avances ?',
          'Comment appliquer ces idees ?',
        ]);
      } finally {
        setSuggestionsLoading(false);
      }
    };
    loadSuggestions();
  }, [demoSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || exhausted) return;

    const userMessage: ChatMessage = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setSuggestions([]); // Hide suggestions after first message

    try {
      const result = await demoApi.chat(demoSessionId, text.trim());
      const assistantMessage: ChatMessage = { role: 'assistant', content: result.response };
      setMessages(prev => [...prev, assistantMessage]);
      setRemaining(result.messages_remaining);

      if (result.messages_remaining <= 0) {
        setExhausted(true);
        onExhausted();
      }
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const errorMessage = err instanceof Error ? err.message : '';
      if (status === 429 || errorMessage.includes('DEMO_CHAT_LIMIT')) {
        setExhausted(true);
        onExhausted();
      } else if (status === 404) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Session expiree. Relancez une analyse pour continuer.' },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Erreur temporaire. Reessayez dans quelques secondes.' },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.5 }}
      className="w-full max-w-2xl mx-auto mt-4"
    >
      <div className="relative backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-white/70 text-xs font-medium">
              Chat IA Demo
            </span>
          </div>
          {!exhausted && (
            <span className="text-white/30 text-[10px]">
              {remaining} question{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Messages area */}
        <div className="relative h-64 overflow-y-auto px-5 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
          {/* Welcome message */}
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-white/30 text-sm mb-4">
                Posez vos questions sur cette video
              </p>

              {/* Suggestion chips */}
              {suggestionsLoading ? (
                <div className="flex gap-2">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="h-8 w-36 rounded-full bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestions.map((suggestion, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10
                                 hover:border-indigo-500/30 rounded-full text-xs text-white/60 hover:text-white/80
                                 transition-all duration-200 cursor-pointer"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat messages */}
          <AnimatePresence>
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-500/20 border border-indigo-500/30 text-white/90 rounded-br-md'
                      : 'bg-white/[0.04] border border-white/[0.06] text-white/75 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.06]">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Exhausted overlay */}
        <AnimatePresence>
          {exhausted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-sm flex items-center justify-center z-10"
            >
              <div className="text-center px-6">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-white/80 text-sm font-medium mb-1">Demo terminee</p>
                <p className="text-white/40 text-xs mb-4">
                  Creez un compte gratuit pour un chat illimite
                </p>
                <a
                  href="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500
                             hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-medium rounded-xl
                             transition-all duration-200 shadow-lg shadow-indigo-500/20"
                >
                  S'inscrire gratuitement
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="relative border-t border-white/5 px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={exhausted ? 'Demo terminee' : 'Posez votre question...'}
              disabled={loading || exhausted}
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white/90
                         placeholder-white/20 outline-none focus:border-indigo-500/30 focus:bg-white/[0.05]
                         transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || exhausted}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/20
                         flex items-center justify-center transition-all duration-200
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
