// extension/src/sidepanel/components/ConversationInput.tsx
//
// Zone d'input texte unifiée :
//  - <input> texte multiline + bouton Send (icône paperplane)
//  - bouton Mic à gauche (toggle web-search OFF, mic icon ON quand call)
//
// Le bouton mic exposera deux comportements via le caller :
//   - voiceMode='off'  : tap → onMicTap() = ouvre confirm puis startSession
//   - voiceMode='live' : tap → onMicTap() = toggleMute (gris/violet)
//
// On garde le toggle web-search à part car il n'a de sens qu'en chat texte.

import React, { useState } from "react";
import { SendIcon } from "../shared/Icons";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";
import { useTranslation } from "../../i18n/useTranslation";
import { PasteLinkButton } from "./PasteLinkButton";

interface ConversationInputProps {
  /** Plan paid (autorise le toggle web-search). */
  webSearchAvailable: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: (enabled: boolean) => void;

  /** Voice mode courant — change l'apparence du bouton mic. */
  voiceMode: "off" | "live" | "ended" | "quota_exceeded";
  /** Mute state (rendu visuel du bouton mic en mode live). */
  isMuted: boolean;
  /** Tap mic — caller décide selon voiceMode (confirm vs toggleMute). */
  onMicTap: () => void;

  /** Désactive l'input quand session expirée ou loading. */
  disabled: boolean;
  sessionExpired: boolean;

  /** Soumission texte (Enter ou Send). */
  onSubmit: (text: string) => Promise<void> | void;
}

const MicIcon: React.FC<{ size?: number; muted?: boolean }> = ({
  size = 16,
  muted = false,
}) => (
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
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
    {muted && <line x1="2" y1="2" x2="22" y2="22" />}
  </svg>
);

export const ConversationInput: React.FC<ConversationInputProps> = ({
  webSearchAvailable,
  webSearchEnabled,
  onToggleWebSearch,
  voiceMode,
  isMuted,
  onMicTap,
  disabled,
  sessionExpired,
  onSubmit,
}) => {
  const { t, language } = useTranslation();
  const [value, setValue] = useState("");

  const handleSend = (): void => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    void onSubmit(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Bouton mic : différents tooltips selon voiceMode.
  const micTitle =
    voiceMode === "live"
      ? isMuted
        ? "Activer le micro"
        : "Couper le micro"
      : voiceMode === "quota_exceeded"
        ? "Quota voice epuise"
        : "Demarrer un appel vocal";

  return (
    <div className="chat-input-area" data-testid="conversation-input">
      {/* Paste link (extreme left) */}
      <PasteLinkButton
        onPaste={(text) => setValue(text)}
        language={language}
        disabled={disabled || sessionExpired}
      />

      {/* Mic toggle (gauche) */}
      <button
        type="button"
        className={`chat-mic-btn ${voiceMode === "live" && !isMuted ? "chat-mic-active" : ""}`}
        onClick={onMicTap}
        disabled={voiceMode === "quota_exceeded"}
        title={micTitle}
        aria-label={micTitle}
        aria-pressed={voiceMode === "live" && !isMuted}
        data-testid="conversation-mic-btn"
      >
        <MicIcon size={14} muted={voiceMode === "live" && isMuted} />
      </button>

      {/* Web search toggle */}
      <button
        type="button"
        className={`chat-ws-toggle ${webSearchEnabled && webSearchAvailable ? "chat-ws-active" : ""}`}
        onClick={() => {
          if (webSearchAvailable) onToggleWebSearch(!webSearchEnabled);
        }}
        title={
          webSearchAvailable
            ? webSearchEnabled
              ? t.chat.webSearchDisable
              : t.chat.webSearchEnable
            : t.chat.webSearchLocked
        }
        style={{ opacity: webSearchAvailable ? 1 : 0.4 }}
      >
        <DoodleIcon
          name="globe"
          size={14}
          color={
            webSearchEnabled && webSearchAvailable
              ? "var(--accent-primary)"
              : "var(--text-muted)"
          }
        />
      </button>

      {/* Input texte */}
      <input
        type="text"
        className="chat-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          sessionExpired ? t.chat.expiredPlaceholder : t.chat.inputPlaceholder
        }
        disabled={disabled || sessionExpired}
        autoFocus
        data-testid="conversation-input-field"
      />

      {/* Send */}
      <button
        type="button"
        className="chat-send-btn"
        onClick={handleSend}
        disabled={!value.trim() || disabled || sessionExpired}
        title={t.common.send}
        data-testid="conversation-send-btn"
      >
        <SendIcon size={16} />
      </button>
    </div>
  );
};
