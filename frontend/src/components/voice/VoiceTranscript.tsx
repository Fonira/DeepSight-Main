/**
 * VoiceTranscript — Scrollable conversation transcript for voice chat.
 * Auto-scrolls to bottom on new messages, with live cursor animation.
 */

import React, { useRef, useEffect } from 'react';

interface VoiceTranscriptProps {
  messages: Array<{ text: string; source: 'user' | 'ai'; timestamp?: number }>;
  isLive?: boolean;
}

export const VoiceTranscript: React.FC<VoiceTranscriptProps> = React.memo(
  ({ messages, isLive = false }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-full min-h-[120px] p-4">
          <p className="text-sm text-white/30 select-none">
            La conversation apparaitra ici...
          </p>
        </div>
      );
    }

    const lastMessage = messages[messages.length - 1];
    const showCursor = isLive && lastMessage?.source === 'ai';

    return (
      <div className="flex flex-col gap-3 p-4 max-h-[360px] overflow-y-auto">
        {messages.map((msg, index) => {
          const isUser = msg.source === 'user';
          const isLastAi =
            showCursor && index === messages.length - 1;

          return (
            <div
              key={index}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] px-4 py-2.5 text-sm
                  ${
                    isUser
                      ? 'bg-indigo-500/20 text-indigo-200 rounded-2xl rounded-br-sm'
                      : 'bg-white/5 text-white/80 rounded-2xl rounded-bl-sm'
                  }
                `}
              >
                <span>{msg.text}</span>
                {isLastAi && (
                  <span className="inline-block w-[2px] h-[14px] ml-0.5 align-middle bg-white/60 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    );
  }
);

VoiceTranscript.displayName = 'VoiceTranscript';

export default VoiceTranscript;
