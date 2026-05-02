// extension/src/sidepanel/components/ConversationFeed.tsx
//
// Liste scrollable du fil unifié. Auto-scroll vers le bas à chaque
// nouveau message ou quand l'indicateur de typing apparaît.
//
// Mirror du `FlatList inverted` mobile : on ne renverse pas la liste
// (les messages arrivent déjà triés par timestamp ascendant), on
// scrolle simplement vers le bas via un useEffect + scrollTop.
//
// Empty state : suggestions chips identiques au ChatView v1, avec
// localisation via useTranslation.

import React, { useEffect, useRef } from "react";
import type { UnifiedMessage } from "../hooks/useConversation";
import { ConversationFeedBubble } from "./ConversationFeedBubble";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";
import { useTranslation } from "../../i18n/useTranslation";

interface ConversationFeedProps {
  messages: UnifiedMessage[];
  loading: boolean;
  loadingHistory: boolean;
  onSuggestionClick: (suggestion: string) => void;
  onAskQuestionClick: (question: string) => void;
}

export const ConversationFeed: React.FC<ConversationFeedProps> = ({
  messages,
  loading,
  loadingHistory,
  onSuggestionClick,
  onAskQuestionClick,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas — déclenché à chaque ajout/typing.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, loading]);

  if (loadingHistory) {
    return (
      <div className="chat-messages" ref={scrollRef}>
        <div className="chat-welcome">
          <DeepSightSpinner size="xs" speed="fast" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    const suggestions = t.chat.suggestions;
    return (
      <div className="chat-messages" ref={scrollRef}>
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
                type="button"
                className="chat-suggestion-btn"
                onClick={() => onSuggestionClick(q)}
              >
                <span className="chat-suggestion-arrow">{"→"}</span>
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-messages" ref={scrollRef} data-testid="conversation-feed">
      {messages.map((m) => (
        <ConversationFeedBubble
          key={m.id}
          message={m}
          onAskQuestionClick={onAskQuestionClick}
          webEnrichedLabel={t.chat.webEnriched}
        />
      ))}
      {loading && (
        <div className="chat-typing" data-testid="conversation-typing">
          <div className="chat-typing-dot" />
          <div className="chat-typing-dot" />
          <div className="chat-typing-dot" />
        </div>
      )}
    </div>
  );
};
