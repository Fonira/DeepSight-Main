// extension/src/sidepanel/views/ConversationView.tsx
//
// Vue conversation unifiee : remplace ChatView (Quick Chat) ET VoiceView
// (Quick Voice Call). Une seule UI two-pane (chat haut + voice controls
// bas) qui supporte les deux modes via le hook `useConversation`.
//
// Layout :
//   - Header : back button + titre vidéo + clear history
//   - ContextProgressBar (visible quand voice live + streaming)
//   - ConversationFeed (fil unifié text + voice agent)
//   - VoiceControls (visible quand voiceMode != 'off')
//   - EndedToast (visible 3s après hangup)
//   - ConversationInput (toujours visible — mic + web-search + send)

import React from "react";
import { useConversation } from "../hooks/useConversation";
import { ConversationFeed } from "../components/ConversationFeed";
import { ConversationInput } from "../components/ConversationInput";
import { VoiceControls } from "../components/VoiceControls";
import { EndedToast } from "../components/EndedToast";
import { ContextProgressBar } from "../components/ContextProgressBar";
import { BackIcon } from "../shared/Icons";
import { useTranslation } from "../../i18n/useTranslation";

const TrashIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

// Pricing v2 + legacy ids retained for grandfathered subscriptions.
const PAID_PLANS = [
  "plus",
  "pro",
  "starter",
  "student",
  "etudiant",
  "expert",
  "team",
  "equipe",
];
function canUseWebSearch(plan?: string): boolean {
  if (!plan) return false;
  return PAID_PLANS.includes(plan.toLowerCase());
}

export interface ConversationViewProps {
  /**
   * Identifiant Summary backend. Optionnel pour le mode 'call' déclenché
   * depuis Quick Voice Call (vidéo fraîche) — useConversation utilisera
   * voice.summaryId une fois ack par le backend.
   */
  summaryId?: number | null;
  videoTitle: string;
  videoId?: string | null;
  platform?: "youtube" | "tiktok" | null;
  initialMode: "chat" | "call";
  userPlan?: string;
  onClose: () => void;
  onSessionExpired?: () => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  summaryId,
  videoTitle,
  videoId,
  platform,
  initialMode,
  userPlan,
  onClose,
  onSessionExpired,
}) => {
  const { t } = useTranslation();
  const conv = useConversation({
    summaryId,
    videoTitle,
    videoId: videoId ?? null,
    platform: platform ?? null,
    initialMode,
    userPlan,
    onSessionExpired,
  });

  const {
    messages,
    voiceMode,
    endedToastVisible,
    lastCallDurationSec,
    elapsedSec,
    isMuted,
    loadingHistory,
    loading,
    sessionExpired,
    webSearchEnabled,
    setWebSearchEnabled,
    contextProgress,
    contextComplete,
    voiceConversationActive,
    sendMessage,
    requestStartCall,
    endCall,
    toggleMute,
    clearHistory,
  } = conv;

  const truncatedTitle =
    videoTitle.length > 30 ? videoTitle.substring(0, 30) + "..." : videoTitle;

  const handleMicTap = (): void => {
    if (voiceMode === "live") {
      toggleMute();
    } else if (voiceMode === "off") {
      requestStartCall();
    }
    // 'ended' / 'quota_exceeded' : no-op (le bouton est disabled pour quota)
  };

  return (
    <div
      className="chat-view conversation-view"
      data-testid="conversation-view"
    >
      {/* Header */}
      <div className="chat-header">
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          title={t.common.back}
          aria-label={t.common.back}
        >
          <BackIcon size={18} />
        </button>
        <span className="chat-header-title">
          {t.synthesis.chat}&nbsp;: &laquo;&nbsp;{truncatedTitle}&nbsp;&raquo;
        </span>
        <button
          type="button"
          className="icon-btn chat-clear-btn"
          onClick={() => {
            void clearHistory();
          }}
          disabled={loadingHistory || messages.length === 0}
          title={t.chat.clear.buttonAriaLabel}
          aria-label={t.chat.clear.buttonAriaLabel}
        >
          <TrashIcon size={16} />
        </button>
      </div>

      {/* Context progress (voice streaming context) */}
      {voiceMode === "live" && (
        <ContextProgressBar
          progress={contextProgress}
          complete={contextComplete}
        />
      )}

      {/* Feed (unified messages) */}
      <ConversationFeed
        messages={messages}
        loading={loading}
        loadingHistory={loadingHistory}
        voiceContextLoading={voiceMode === "live" && !contextComplete}
        onSuggestionClick={(s) => {
          void sendMessage(s);
        }}
        onAskQuestionClick={(q) => {
          void sendMessage(q);
        }}
      />

      {/* Voice controls (live / quota_exceeded) */}
      <VoiceControls
        voiceMode={voiceMode}
        elapsedSec={elapsedSec}
        isMuted={isMuted}
        conversationActive={voiceConversationActive}
        onToggleMute={toggleMute}
        onHangup={endCall}
      />

      {/* Ended toast */}
      <EndedToast
        durationSec={lastCallDurationSec}
        visible={endedToastVisible}
      />

      {/* Session expired */}
      {sessionExpired && (
        <div className="chat-session-expired">
          <span>
            {"\u{1F512}"} {t.chat.sessionExpired}
          </span>
          <button
            type="button"
            className="chat-reconnect-btn"
            onClick={() => {
              if (onSessionExpired) {
                onSessionExpired();
              } else {
                onClose();
              }
            }}
          >
            {t.chat.reconnect}
          </button>
        </div>
      )}

      {/* Input */}
      <ConversationInput
        webSearchAvailable={canUseWebSearch(userPlan)}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={setWebSearchEnabled}
        voiceMode={voiceMode}
        isMuted={isMuted}
        onMicTap={handleMicTap}
        disabled={loading}
        sessionExpired={sessionExpired}
        onSubmit={(text) => sendMessage(text)}
      />
    </div>
  );
};
