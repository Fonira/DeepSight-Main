/**
 * Hub Chat IA + Voice unifié — page racine /hub.
 *
 * Fusionne ChatPage et VoiceCallPage en une expérience single column :
 *   ☰ HubHeader · SummaryCollapsible · Timeline · InputBar
 *   + ConversationsDrawer overlay · VideoPiPPlayer · CallModeFullBleed
 *
 * Backend : timeline unifiée déjà en place (PR #203). Schema HubMessage
 * mappé depuis ChatMessage côté API (source/voice_session_id/time_in_call_secs).
 */
import React, { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { videoApi, chatApi } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { useTTSContext } from "../contexts/TTSContext";
import { useVoiceEnabled } from "../components/voice/hooks/useVoiceEnabled";
import {
  type VoiceOverlayController,
  type VoiceOverlayMessage,
} from "../components/voice/VoiceOverlay";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { sanitizeTitle } from "../utils/sanitize";
import { useHubStore } from "../store/hubStore";
import { HubHeader } from "../components/hub/HubHeader";
import { SummaryCollapsible } from "../components/hub/SummaryCollapsible";
import { Timeline } from "../components/hub/Timeline";
import { InputBar } from "../components/hub/InputBar";
import { ConversationsDrawer } from "../components/hub/ConversationsDrawer";
import { VideoPiPPlayer } from "../components/hub/VideoPiPPlayer";
import { CallModeFullBleed } from "../components/hub/CallModeFullBleed";
import { SourcesShelf } from "../components/hub/SourcesShelf";
import type { HubConversation, HubMessage } from "../components/hub/types";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Formate la durée vidéo en MM:SS ou HH:MM:SS si > 1h. */
const formatVideoDuration = (totalSecs: number): string => {
  if (!Number.isFinite(totalSecs) || totalSecs <= 0) return "";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/** "analysée il y a X min" / "il y a X h" / "hier" / "la semaine dernière" / etc. */
const formatAnalyzedAgo = (iso: string | undefined): string => {
  if (!iso) return "analysée récemment";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "analysée récemment";
  const diffSecs = Math.max(0, (Date.now() - t) / 1000);
  if (diffSecs < 60) return "analysée à l'instant";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `analysée il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `analysée il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "analysée hier";
  if (diffDays < 7) return `analysée il y a ${diffDays} j`;
  if (diffDays < 14) return "analysée la semaine dernière";
  if (diffDays < 30) return `analysée il y a ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365)
    return `analysée il y a ${Math.floor(diffDays / 30)} mois`;
  return `analysée il y a ${Math.floor(diffDays / 365)} an${Math.floor(diffDays / 365) > 1 ? "s" : ""}`;
};

/** Construit le subtitle 3 parties: "YouTube · 18:32 · analysée il y a 12 min". */
const buildHubSubtitle = (
  source: "youtube" | "tiktok" | undefined,
  durationSecs: number | undefined,
  updatedAt: string | undefined,
): string => {
  if (!source) return "";
  const platform = source === "tiktok" ? "TikTok" : "YouTube";
  const duration = formatVideoDuration(durationSecs ?? 0);
  const ago = formatAnalyzedAgo(updatedAt);
  const parts = [platform];
  if (duration) parts.push(duration);
  if (ago) parts.push(ago);
  return parts.join(" · ");
};

const HubPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlConvId = searchParams.get("conv");
  const urlSummaryId = searchParams.get("summary");
  // Hub-first : `?open_summary=1` ouvre le bloc résumé déroulé d'emblée et
  // scrolle le wrapper au centre. Utilisé après une analyse fraîche (Quick
  // Chat) pour que l'utilisateur arrive directement sur le résumé.
  const openSummaryFromUrl = searchParams.get("open_summary") === "1";

  const { language } = useTranslation();
  const { user: _user } = useAuth();
  const { autoPlayEnabled, playText, stopPlaying } = useTTSContext();
  const { voiceEnabled } = useVoiceEnabled();

  const {
    conversations,
    activeConvId,
    messages,
    summaryContext,
    drawerOpen,
    voiceCallOpen,
    pipExpanded,
    setConversations,
    setActiveConv,
    setMessages,
    appendMessage,
    setSummaryContext,
    toggleDrawer,
    setPipExpanded,
    setVoiceCallOpen,
  } = useHubStore();

  const [isThinking, setIsThinking] = React.useState(false);
  const voiceControllerRef = useRef<VoiceOverlayController | null>(null);

  // ── Fetch conversations (mapped from videoApi.getHistory) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await videoApi.getHistory({ limit: 50, page: 1 });
        if (cancelled) return;
        const convs: HubConversation[] = (resp.items || []).map(
          (item: any) => ({
            id: item.id,
            summary_id: item.id,
            title: sanitizeTitle(item.video_title) || "Sans titre",
            video_source: (item.platform === "tiktok"
              ? "tiktok"
              : "youtube") as "youtube" | "tiktok",
            video_thumbnail_url: item.thumbnail_url ?? null,
            last_snippet: undefined,
            updated_at: item.created_at,
          }),
        );
        setConversations(convs);
        // Auto-select if URL has ?conv=<id> or ?summary=<id>
        const target =
          urlConvId !== null
            ? Number(urlConvId)
            : urlSummaryId !== null
              ? Number(urlSummaryId)
              : null;
        if (target && convs.find((c) => c.id === target)) {
          setActiveConv(target);
        }
      } catch (err) {
        console.error("[HubPage] fetch conversations failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setConversations, setActiveConv, urlConvId, urlSummaryId]);

  // ── Fetch messages + summary context when activeConv changes ──
  // Note: conversations is intentionally read via getState() to avoid re-running
  // this effect every time the conversations list changes (e.g. on polling). The
  // cascade was causing React #300 ("setState during another component's render").
  useEffect(() => {
    if (activeConvId === null) {
      setSummaryContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const history = await chatApi.getHistory(activeConvId);
        if (cancelled) return;
        const mapped: HubMessage[] = (history || []).map(
          (m: any, i: number) => {
            const source: HubMessage["source"] =
              m.source === "voice"
                ? m.voice_speaker === "user"
                  ? "voice_user"
                  : "voice_agent"
                : "text";
            return {
              id: m.id ? `history-${m.id}` : `history-${i}`,
              role: m.role,
              content: m.content,
              sources: m.sources,
              web_search_used: m.web_search_used,
              source,
              voice_session_id: m.voice_session_id ?? null,
              time_in_call_secs: m.time_in_call_secs,
              timestamp: new Date(m.created_at ?? Date.now()).getTime(),
            };
          },
        );
        setMessages(mapped);

        const convs = useHubStore.getState().conversations;
        const conv = convs.find((c) => c.id === activeConvId);
        if (conv && conv.summary_id !== null) {
          // Set minimal context immediately for fast UI
          setSummaryContext({
            summary_id: conv.summary_id,
            video_title: conv.title,
            video_channel: "",
            video_duration_secs: 0,
            video_source: conv.video_source ?? "youtube",
            video_thumbnail_url: conv.video_thumbnail_url ?? null,
            short_summary: conv.last_snippet ?? "",
            citations: [],
          });
          // Hydrate with real summary content (async, fire-and-forget)
          videoApi
            .getSummary(conv.summary_id)
            .then((s) => {
              if (cancelled) return;
              setSummaryContext({
                summary_id: s.id,
                video_title: s.video_title,
                video_channel: s.video_channel ?? "",
                video_duration_secs: s.video_duration ?? 0,
                video_source: s.platform === "tiktok" ? "tiktok" : "youtube",
                video_thumbnail_url: s.thumbnail_url ?? null,
                short_summary: s.summary_content ?? "",
                citations: [],
              });
            })
            .catch((err) => {
              console.warn("[HubPage] fetch full summary failed:", err);
            });
        }
      } catch (err) {
        console.error("[HubPage] fetch messages failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConvId, setMessages, setSummaryContext]);

  // ── Auto-play TTS on assistant text messages ──
  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevCountRef.current && autoPlayEnabled) {
      const last = messages[messages.length - 1];
      if (
        last?.role === "assistant" &&
        last.source !== "voice_agent" &&
        typeof last.content === "string"
      ) {
        playText(last.content.slice(0, 5000));
      }
    }
    prevCountRef.current = messages.length;
  }, [messages, autoPlayEnabled, playText]);

  // ── Handle text send (route A: voice active = inject; B: REST) ──
  const handleSend = useCallback(
    async (text: string) => {
      if (!activeConvId) return;
      const ctrl = voiceControllerRef.current;
      const voiceActive = !!ctrl?.isActive;

      stopPlaying();

      const userMsg: HubMessage = {
        id: newId(),
        role: "user",
        content: text,
        source: voiceActive ? "voice_user" : "text",
        voice_session_id: voiceActive
          ? (ctrl?.voiceSessionId ?? null)
          : undefined,
        timestamp: Date.now(),
      };
      appendMessage(userMsg);

      if (voiceActive && ctrl) {
        try {
          ctrl.sendUserMessage(text);
        } catch (err) {
          console.warn("[HubPage] sendUserMessage failed:", err);
        }
        return;
      }

      setIsThinking(true);
      try {
        const resp = await chatApi.send(activeConvId, text, false);
        appendMessage({
          id: newId(),
          role: "assistant",
          content: resp.response || "",
          sources: resp.sources,
          web_search_used: resp.web_search_used,
          source: "text",
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error("[HubPage] chat send failed:", err);
        appendMessage({
          id: newId(),
          role: "assistant",
          content: "❌ Une erreur est survenue. Veuillez réessayer.",
          source: "text",
          timestamp: Date.now(),
        });
      } finally {
        setIsThinking(false);
      }
    },
    [activeConvId, appendMessage, stopPlaying],
  );

  // ── Handle voice transcript turn ──
  const handleVoiceMessage = useCallback(
    (msg: VoiceOverlayMessage) => {
      appendMessage({
        id: newId(),
        role: msg.source === "user" ? "user" : "assistant",
        content: msg.text,
        source: msg.source === "user" ? "voice_user" : "voice_agent",
        voice_session_id: msg.voiceSessionId,
        time_in_call_secs: msg.timeInCallSecs,
        timestamp: Date.now(),
      });
    },
    [appendMessage],
  );

  // ── Handle PTT (hold mic) → in v1, switch to call mode briefly is overkill,
  //    just open the call so user can speak. Real audio capture for PTT note
  //    bubbles is V2 (requires server-side transcription endpoint). ──
  const handlePttHoldComplete = useCallback(
    (_durationSecs: number) => {
      if (!voiceEnabled) return;
      setVoiceCallOpen(true);
    },
    [voiceEnabled, setVoiceCallOpen],
  );

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  return (
    <div className="relative h-screen flex flex-col overflow-hidden bg-[#0a0a0f]">
      <DoodleBackground variant="default" className="!opacity-[0.18]" />
      <SEO title="Hub" path="/hub" />

      <HubHeader
        onMenuClick={toggleDrawer}
        title={activeConv?.title ?? "Hub"}
        subtitle={
          activeConv
            ? buildHubSubtitle(
                activeConv.video_source,
                summaryContext?.video_duration_secs,
                activeConv.updated_at,
              ) || undefined
            : undefined
        }
        videoSource={activeConv?.video_source ?? null}
        pipSlot={
          activeConv?.summary_id ? (
            <VideoPiPPlayer
              thumbnailUrl={activeConv.video_thumbnail_url ?? null}
              title={activeConv.title}
              durationSecs={summaryContext?.video_duration_secs ?? 0}
              expanded={pipExpanded}
              onExpand={() => setPipExpanded(true)}
              onShrink={() => setPipExpanded(false)}
            />
          ) : null
        }
      />

      <div className="relative flex-1 flex flex-col overflow-hidden">
        {summaryContext && (
          <SummaryCollapsible
            context={summaryContext}
            defaultOpen={openSummaryFromUrl}
          />
        )}
        <Timeline messages={messages} isThinking={isThinking} />
        <InputBar
          onSend={handleSend}
          onCallToggle={() => setVoiceCallOpen(!voiceCallOpen)}
          onPttHoldComplete={handlePttHoldComplete}
          disabled={!activeConvId}
        />
        <div className="flex justify-center px-3 pb-3 pt-1">
          <SourcesShelf />
        </div>

        <ConversationsDrawer
          open={drawerOpen}
          onClose={toggleDrawer}
          conversations={conversations}
          activeConvId={activeConvId}
          onSelect={(id) => {
            setActiveConv(id);
            setSearchParams({ conv: String(id) });
          }}
          onNewConv={() => {
            setActiveConv(null);
            setSearchParams({});
          }}
        />

        {voiceEnabled && (
          <CallModeFullBleed
            open={voiceCallOpen}
            onClose={() => setVoiceCallOpen(false)}
            summaryId={activeConv?.summary_id ?? null}
            title={activeConv?.title ?? null}
            subtitle={null}
            onVoiceMessage={handleVoiceMessage}
            controllerRef={voiceControllerRef}
            language={language as "fr" | "en"}
          />
        )}
      </div>
    </div>
  );
};

export default HubPage;
