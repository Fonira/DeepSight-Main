import { useState, useCallback, useContext } from "react";
import type { ChatMessage } from "../types";
import { chatApi } from "../services/api";
import LanguageContext from "../contexts/LanguageContext";
import { chatErrorMessage } from "../utils/chatErrors";

const frenchOnly = (frText: string) => frText;

/** Génère un ID unique sans collision (base36 + counter) */
let _idCounter = 0;
function uniqueId(): string {
  _idCounter += 1;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${_idCounter}`;
}

export function useChat(summaryId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Contexte lu sans exiger le provider (repli en français)
  const language = useContext(LanguageContext);
  const tr = language?.tr ?? frenchOnly;

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: uniqueId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await chatApi.sendMessage(summaryId, content);

        const assistantMessage: ChatMessage = {
          id: uniqueId(),
          role: "assistant",
          content: response.response || "",
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error: unknown) {
        const errorMessage: ChatMessage = {
          id: uniqueId(),
          role: "assistant",
          content: chatErrorMessage(error, tr),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [summaryId, tr],
  );

  const loadHistory = useCallback(async () => {
    try {
      const response = await chatApi.getHistory(summaryId);
      if (response.messages) {
        setMessages(response.messages);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("[useChat] loadHistory failed:", error);
      }
    }
  }, [summaryId]);

  return { messages, isLoading, sendMessage, loadHistory };
}
