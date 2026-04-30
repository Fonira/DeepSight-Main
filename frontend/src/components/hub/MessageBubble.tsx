// frontend/src/components/hub/MessageBubble.tsx
import React from "react";
import { Mic } from "lucide-react";
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
        <p className="whitespace-pre-wrap">{beforeQuestions}</p>
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
