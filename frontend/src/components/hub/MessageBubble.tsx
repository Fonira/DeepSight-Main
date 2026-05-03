// frontend/src/components/hub/MessageBubble.tsx
import React from "react";
import { Mic } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { HubMessage } from "./types";
import { VoiceBubble } from "./VoiceBubble";
import {
  parseAskQuestions,
  ClickableQuestionsBlock,
} from "../ClickableQuestions";

interface Props {
  msg: HubMessage;
  /** Optional sampled bars override; otherwise use a deterministic default. */
  bars?: number[];
  /** Click handler for inline `[ask:...]` followups (assistant messages only). */
  onQuestionClick?: (question: string) => void;
}

const DEFAULT_BARS = [
  6, 14, 9, 20, 11, 16, 8, 18, 12, 22, 9, 15, 7, 19, 11, 14, 8, 17, 10, 13, 6,
  21, 9, 12, 15, 8, 17, 10,
];

/**
 * Rend le markdown des messages chat (F5).
 * Avant ce fix, le bold, les titres et les liens markdown étaient affichés
 * bruts dans la timeline. Liens en target=_blank avec rel sécurisé.
 * Listes, code, titres, blockquote, tables tous stylés.
 */
const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ href, children, ...props }) => (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-300 underline hover:text-indigo-200"
        >
          {children}
        </a>
      ),
      code: ({ className, children, ...props }) => {
        const isInline = !className?.includes("language-");
        if (isInline) {
          return (
            <code
              className="px-1 py-0.5 bg-white/10 rounded text-[12px] font-mono"
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <code className="text-[12px] font-mono text-white/85" {...props}>
            {children}
          </code>
        );
      },
      pre: ({ children }) => (
        <pre className="my-2 p-3 bg-black/30 rounded-md overflow-x-auto">
          {children}
        </pre>
      ),
      ul: ({ children }) => (
        <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
      ),
      li: ({ children }) => <li className="my-0.5">{children}</li>,
      h1: ({ children }) => (
        <h1 className="text-base font-semibold mt-2 mb-1">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-sm font-semibold mt-1.5 mb-1">{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 className="text-sm font-semibold mt-1.5 mb-1">{children}</h4>
      ),
      hr: () => <hr className="my-2 border-white/10" />,
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-white/20 pl-3 my-1.5 text-white/80 italic">
          {children}
        </blockquote>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="text-xs border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border border-white/10 px-2 py-1 text-left font-semibold">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border border-white/10 px-2 py-1">{children}</td>
      ),
      p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
    }}
  >
    {text}
  </ReactMarkdown>
);

export const MessageBubble: React.FC<Props> = ({
  msg,
  bars,
  onQuestionClick,
}) => {
  const isUser = msg.role === "user";
  const isVoiceBubble =
    (msg.source === "voice_user" || msg.source === "voice_agent") &&
    typeof msg.audio_duration_secs === "number" &&
    msg.audio_duration_secs > 0;

  // Parse `[ask:...]` followups out of assistant text messages.
  const isAssistantText =
    !isUser &&
    !isVoiceBubble &&
    msg.source !== "voice_agent" &&
    typeof msg.content === "string";
  const { beforeQuestions, questions } = isAssistantText
    ? parseAskQuestions(msg.content)
    : { beforeQuestions: msg.content, questions: [] as string[] };

  if (isVoiceBubble) {
    return (
      <div
        className={"flex w-full " + (isUser ? "justify-end" : "justify-start")}
      >
        <VoiceBubble
          durationSecs={msg.audio_duration_secs as number}
          bars={bars ?? DEFAULT_BARS}
          transcript={msg.content}
          side={isUser ? "user" : "ai"}
        />
      </div>
    );
  }

  // Plain text bubble
  const isVoiceText =
    msg.source === "voice_user" || msg.source === "voice_agent";

  return (
    <div
      className={"flex w-full " + (isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={
          "max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl border text-sm leading-relaxed " +
          (isUser
            ? "bg-indigo-500/10 border-indigo-500/20 text-white rounded-br-md"
            : "bg-white/5 border-white/10 text-white/95 rounded-bl-md")
        }
        data-testid={`hub-msg-${msg.source}`}
      >
        {isVoiceText && (
          <div className="inline-flex items-center gap-1 mb-1.5 text-[10px] font-medium text-violet-300/95 uppercase tracking-wider">
            <Mic className="w-2.5 h-2.5" />
            <span>Vocal</span>
            {typeof msg.time_in_call_secs === "number" && (
              <span className="text-violet-300/70 normal-case">
                · {Math.floor(msg.time_in_call_secs / 60)}:
                {Math.floor(msg.time_in_call_secs % 60)
                  .toString()
                  .padStart(2, "0")}
              </span>
            )}
          </div>
        )}
        <MarkdownRenderer text={beforeQuestions} />
        {isAssistantText && questions.length > 0 && onQuestionClick && (
          <ClickableQuestionsBlock
            questions={questions}
            onQuestionClick={onQuestionClick}
            variant="video"
          />
        )}
      </div>
    </div>
  );
};
