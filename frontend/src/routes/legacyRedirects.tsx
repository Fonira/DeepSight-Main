/**
 * Legacy redirects → Hub.
 *
 * The /chat, /voice-call and /history routes are kept as React Router
 * paths only so existing bookmarks, deep-links and inbound campaign URLs
 * keep working. They redirect into the unified /hub while preserving the
 * relevant query parameters (`summary` → `conv`, etc.).
 *
 * Companions:
 *   - PR1 of the Hub centralization sprint adds these wrappers.
 *   - PR4 (cleanup) will delete the underlying page components once
 *     every internal caller has been migrated and we are confident the
 *     redirects have caught all inbound traffic.
 */
import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";

/**
 * `/chat?summary=42`  →  `/hub?conv=42&tab=chat`
 * `/chat`             →  `/hub`
 */
export const ChatLegacyRedirect: React.FC = () => {
  const [params] = useSearchParams();
  const summary = params.get("summary") ?? params.get("summaryId");
  const target = summary
    ? `/hub?conv=${encodeURIComponent(summary)}&tab=chat`
    : "/hub";
  return <Navigate to={target} replace />;
};

/**
 * `/voice-call?summary=42`  →  `/hub?conv=42&voice=1`
 * `/voice-call`             →  `/hub?voice=1`
 *
 * Pre-Hub VoiceCallPage exposed a free-form reflection mode when no
 * `summary` was supplied. We forward `voice=1` without a conv so the Hub
 * can still open the voice surface immediately for that flow (PR2 will
 * decide how to render the no-conv case once voice is inline).
 */
export const VoiceCallLegacyRedirect: React.FC = () => {
  const [params] = useSearchParams();
  const summary = params.get("summary") ?? params.get("summaryId");
  const target = summary
    ? `/hub?conv=${encodeURIComponent(summary)}&voice=1`
    : "/hub?voice=1";
  return <Navigate to={target} replace />;
};

/**
 * `/history`            →  `/hub?view=history`
 * `/history?q=foo&...`  →  `/hub?view=history&q=foo&...`
 *
 * Any pre-existing search params are forwarded as-is so an inbound link
 * that already drove History via its own params keeps the same scope
 * inside the Hub.
 */
export const HistoryLegacyRedirect: React.FC = () => {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  next.set("view", "history");
  return <Navigate to={`/hub?${next.toString()}`} replace />;
};
