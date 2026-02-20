import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '../types';
import { chatApi } from '../services/api';

/** Génère un ID unique sans collision (base36 + counter) */
let _idCounter = 0;
function uniqueId(): string {
  _idCounter += 1;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${_idCounter}`;
}

export function useChat(summaryId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: uniqueId(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await chatApi.sendMessage(summaryId, content);

        const assistantMessage: ChatMessage = {
          id: uniqueId(),
          role: 'assistant',
          content: response.response || '',
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          id: uniqueId(),
          role: 'assistant',
          content: 'Désolé, une erreur est survenue. Réessayez.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [summaryId]
  );

  const loadHistory = useCallback(async () => {
    try {
      const response = await chatApi.getHistory(summaryId);
      if (response.messages) {
        setMessages(response.messages);
      }
    } catch {
      // Silent fail for history loading
    }
  }, [summaryId]);

  return { messages, isLoading, sendMessage, loadHistory };
}
