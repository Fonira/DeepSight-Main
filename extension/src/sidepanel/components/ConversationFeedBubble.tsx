// extension/src/sidepanel/components/ConversationFeedBubble.tsx
//
// Une bulle dans le fil ConversationFeed. Trois variantes possibles :
//   - role='user' / source='text'   : bulle alignée à droite, texte brut
//   - role='assistant' / source='text'  : bulle alignée à gauche, markdown
//   - role='assistant' / source='voice' : bulle alignée à gauche, markdown,
//                                          + badge mic 🎙️ (testid voice-badge-mic)
//
// Les transcripts user voice sont déjà filtrés en amont par useConversation
// (règle UX "audio user invisible" — spec 2026-05-02 §3 décision #3).
import React, { useMemo } from "react";
import type { UnifiedMessage } from "../hooks/useConversation";
import { escapeHtml, markdownToFullHtml } from "../../utils/sanitize";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";

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

interface MicBadgeProps {
  label?: string;
}
const MicBadge: React.FC<MicBadgeProps> = ({ label = "voix" }) => (
  <span
    className="ds-voice-badge"
    data-testid="voice-badge-mic"
    title={label}
    aria-label={label}
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
    <span className="ds-voice-badge-label">{label}</span>
  </span>
);

interface ConversationFeedBubbleProps {
  message: UnifiedMessage;
  /** Click sur une question [ask:...] embedded dans le markdown agent. */
  onAskQuestionClick?: (question: string) => void;
  /** Texte i18n pour le badge enrichi web. */
  webEnrichedLabel?: string;
}

export const ConversationFeedBubble: React.FC<ConversationFeedBubbleProps> = ({
  message,
  onAskQuestionClick,
  webEnrichedLabel = "Web enriched",
}) => {
  const isUser = message.role === "user";
  const isVoice = message.source === "voice";

  const parsed = useMemo<ParsedContent>(() => {
    if (isUser) return { text: message.content, questions: [] };
    return parseAskQuestions(message.content);
  }, [isUser, message.content]);

  return (
    <div
      className={`chat-msg chat-msg-${message.role}${isVoice ? " chat-msg-voice" : ""}`}
      data-source={message.source}
    >
      {!isUser ? (
        <>
          {message.webSearchUsed && (
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
          {isVoice && <MicBadge />}
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
                  type="button"
                  className="chat-ask-pill"
                  onClick={() => onAskQuestionClick?.(q)}
                >
                  <span className="chat-ask-arrow">{"→"}</span>
                  {cleanQuestion(q)}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        message.content
      )}
    </div>
  );
};
