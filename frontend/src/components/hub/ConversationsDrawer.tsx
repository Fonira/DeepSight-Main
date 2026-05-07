import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Send,
  Sparkles,
  CheckSquare,
  Square,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { HubConversation } from "./types";
import { useAuthContext } from "../../contexts/AuthContext";
import { useToast } from "../Toast";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";

interface Props {
  open: boolean;
  onClose: () => void;
  conversations: HubConversation[];
  activeConvId: number | null;
  onSelect: (id: number) => void;
  /**
   * Lance une analyse depuis la barre input du header. Le caller (HubPage)
   * navigue vers `/hub?analyzing=<taskId>` et le drawer se ferme. Si non
   * fourni, la barre input n'est pas rendue.
   */
  onAnalyze?: (url: string) => void | Promise<void>;
}

const PLATFORM_ICON: Record<
  "youtube" | "tiktok",
  { src: string; alt: string }
> = {
  youtube: { src: "/platforms/youtube-icon-red.svg", alt: "YouTube" },
  tiktok: { src: "/platforms/tiktok-note-color.svg", alt: "TikTok" },
};

/** Cap dur côté UI : backend accepte 2..20. */
const MAX_SELECTION = 20;
const MIN_SELECTION = 2;

const groupBy = (convs: HubConversation[]) => {
  const today: HubConversation[] = [];
  const yesterday: HubConversation[] = [];
  const week: HubConversation[] = [];
  const older: HubConversation[] = [];
  const now = Date.now();
  for (const c of convs) {
    const t = new Date(c.updated_at).getTime();
    const d = (now - t) / 86_400_000;
    if (d < 1) today.push(c);
    else if (d < 2) yesterday.push(c);
    else if (d < 7) week.push(c);
    else older.push(c);
  }
  return { today, yesterday, week, older };
};

/** Format date courte FR pour différencier les doublons dans le drawer (F13). */
const fmtShortDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: sameYear ? undefined : "2-digit",
    });
  } catch {
    return "";
  }
};

export const ConversationsDrawer: React.FC<Props> = ({
  open,
  onClose,
  conversations,
  activeConvId,
  onSelect,
  onAnalyze,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showToast, ToastComponent } = useToast();

  const [query, setQuery] = useState("");
  const [newUrl, setNewUrl] = useState("");

  // ─── Multi-select state (Hub Workspace) ──────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /** Plan Expert requis pour Hub Workspace (gating). */
  const canUseHubWorkspace = user?.plan === "expert";

  // Reset le mode select quand le drawer se ferme.
  useEffect(() => {
    if (!open) {
      setIsSelectMode(false);
      setSelectedSummaryIds(new Set());
    }
  }, [open]);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedSummaryIds(new Set());
  }, []);

  const toggleSelection = useCallback(
    (summaryId: number | null) => {
      // Conv free-form (pas de vidéo attachée) → ignoré (pas d'analyse à inclure).
      if (summaryId === null) return;
      setSelectedSummaryIds((prev) => {
        const next = new Set(prev);
        if (next.has(summaryId)) {
          next.delete(summaryId);
        } else {
          if (next.size >= MAX_SELECTION) {
            showToast(
              `Maximum ${MAX_SELECTION} analyses par workspace.`,
              "warning",
            );
            return prev;
          }
          next.add(summaryId);
        }
        return next;
      });
    },
    [showToast],
  );

  const handleAnalyzeSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newUrl.trim();
      if (!trimmed || !onAnalyze) return;
      void onAnalyze(trimmed);
      setNewUrl("");
      onClose();
    },
    [newUrl, onAnalyze, onClose],
  );

  const filtered = useMemo(
    () =>
      conversations.filter((c) =>
        (c.title + " " + (c.last_snippet ?? ""))
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [conversations, query],
  );

  const grouped = useMemo(() => groupBy(filtered), [filtered]);

  const selectedCount = selectedSummaryIds.size;
  const canCreate = selectedCount >= MIN_SELECTION;

  if (!open) return null;

  const renderGroup = (label: string, items: HubConversation[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label} className="mb-3">
        <p className="font-mono text-[10px] tracking-[.12em] text-white/35 uppercase px-3 mb-1.5">
          {label}
        </p>
        {items.map((c) => {
          const isChecked =
            c.summary_id !== null && selectedSummaryIds.has(c.summary_id);
          const isActive = c.id === activeConvId && !isSelectMode;
          // Conversations free-form (sans summary_id) sont visibles mais non
          // sélectionnables en mode select — visuellement dimmed.
          const isSelectable = isSelectMode && c.summary_id !== null;
          const isDimmedInSelectMode = isSelectMode && c.summary_id === null;

          return (
            <button
              key={c.id}
              type="button"
              data-conv-id={c.id}
              aria-pressed={isSelectMode ? isChecked : undefined}
              onClick={() => {
                if (isSelectMode) {
                  toggleSelection(c.summary_id);
                  return;
                }
                onSelect(c.id);
                onClose();
              }}
              disabled={isDimmedInSelectMode}
              className={
                "w-full px-3 py-2 rounded-lg mb-0.5 flex gap-2.5 items-start text-left transition-colors " +
                (isActive
                  ? "bg-indigo-500/15 border border-indigo-500/40 ring-2 ring-indigo-500/30"
                  : isChecked
                    ? "bg-indigo-500/10 border border-indigo-500/30"
                    : "border border-transparent hover:bg-white/[0.04]") +
                (isDimmedInSelectMode ? " opacity-40 cursor-not-allowed" : "")
              }
            >
              {isSelectMode && (
                <div
                  className="w-4 h-4 flex-shrink-0 mt-0.5 grid place-items-center"
                  aria-hidden="true"
                >
                  {isSelectable ? (
                    isChecked ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4 text-white/40" />
                    )
                  ) : (
                    <Square className="w-4 h-4 text-white/15" />
                  )}
                </div>
              )}
              {c.video_thumbnail_url ? (
                <div className="w-10 h-6 rounded overflow-hidden bg-white/[0.04] flex-shrink-0 mt-0.5">
                  <img
                    src={c.video_thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : c.video_source && PLATFORM_ICON[c.video_source] ? (
                <div className="w-4 h-4 flex-shrink-0 mt-0.5 grid place-items-center">
                  <img
                    src={PLATFORM_ICON[c.video_source].src}
                    alt={PLATFORM_ICON[c.video_source].alt}
                    width={16}
                    height={16}
                    className="opacity-90"
                  />
                </div>
              ) : (
                <div className="w-4 h-4 flex-shrink-0 mt-0.5 rounded bg-white/[0.04]" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white/85 truncate">{c.title}</p>
                <p className="text-[11px] text-white/45 truncate mt-0.5 flex items-center gap-1.5">
                  {c.last_snippet ? (
                    <span className="truncate">{c.last_snippet}</span>
                  ) : null}
                  {c.last_snippet && fmtShortDate(c.updated_at) && (
                    <span className="text-white/30">·</span>
                  )}
                  {fmtShortDate(c.updated_at) && (
                    <span className="font-mono text-white/35 flex-shrink-0">
                      {fmtShortDate(c.updated_at)}
                    </span>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        key="drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.aside
        key="drawer-panel"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] bg-[#0c0c14] border-r border-white/10 flex flex-col"
      >
        {/* ─── Header ─────────────────────────────────────────────── */}
        {isSelectMode ? (
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-3 border-b border-white/10 bg-indigo-500/[0.06]">
            <span className="flex-1 text-[13px] font-medium text-white">
              {selectedCount} / {MAX_SELECTION} sélectionnée
              {selectedCount > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={exitSelectMode}
              className="px-2.5 py-1 rounded-md text-[12px] text-white/65 hover:bg-white/[0.06] transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => setCreateModalOpen(true)}
              className="px-3 py-1 rounded-md bg-indigo-500 text-white text-[12px] font-medium hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Créer Workspace
            </button>
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <button
              type="button"
              aria-label="fermer"
              onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/[0.06] text-white/65"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="flex-1 text-sm font-medium text-white">
              Conversations
            </span>
            {canUseHubWorkspace ? (
              <button
                type="button"
                aria-label="Sélectionner pour créer un workspace"
                title="Sélectionner pour créer un workspace"
                onClick={() => setIsSelectMode(true)}
                className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/[0.06] text-white/65 hover:text-indigo-300 transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Hub Workspace est réservé au plan Expert"
                title="Hub Workspace est réservé au plan Expert — cliquez pour passer à Expert"
                onClick={() => navigate("/upgrade")}
                className="w-8 h-8 grid place-items-center rounded-lg hover:bg-amber-500/10 text-white/40 hover:text-amber-300 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {!isSelectMode && onAnalyze && (
          <div className="flex-shrink-0 px-3 pt-3 pb-1">
            <form onSubmit={handleAnalyzeSubmit} className="relative">
              <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 pointer-events-none" />
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Coller un lien YouTube/TikTok…"
                aria-label="Nouvelle analyse — coller une URL"
                className="w-full pl-8 pr-9 py-2 rounded-lg bg-indigo-500/[0.08] border border-indigo-500/30 text-[13px] text-white placeholder-white/35 outline-none focus:border-indigo-400/60 focus:bg-indigo-500/[0.12]"
              />
              <button
                type="submit"
                aria-label="Analyser"
                disabled={!newUrl.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-md bg-indigo-500 text-white hover:bg-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            <p className="px-1 mt-1 text-[10px] text-white/40">
              Lance une nouvelle analyse — vous serez redirigé vers le Hub.
            </p>
          </div>
        )}

        {isSelectMode && (
          <div className="flex-shrink-0 px-3 pt-2 pb-1">
            <p className="text-[11px] text-white/55 leading-relaxed">
              Sélectionnez {MIN_SELECTION} à {MAX_SELECTION} analyses pour créer
              un workspace Miro.
            </p>
          </div>
        )}

        <div className="flex-shrink-0 px-3 pt-2 pb-2 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-white outline-none focus:border-white/20"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
          {renderGroup("Aujourd'hui", grouped.today)}
          {renderGroup("Hier", grouped.yesterday)}
          {renderGroup("Cette semaine", grouped.week)}
          {renderGroup("Plus ancien", grouped.older)}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-[12px] text-white/35 text-center">
              Aucune conversation
            </p>
          )}
        </div>
      </motion.aside>

      <CreateWorkspaceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialSummaryIds={Array.from(selectedSummaryIds)}
        onCreated={() => {
          // Le store push déjà le workspace dans la liste — on quitte le
          // mode select et on ferme le drawer pour laisser place au feedback
          // visuel (toast + retour au Hub).
          exitSelectMode();
          onClose();
        }}
      />
      {ToastComponent}
    </AnimatePresence>
  );
};
