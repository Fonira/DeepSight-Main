import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus } from "lucide-react";
import type { HubConversation } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  conversations: HubConversation[];
  activeConvId: number | null;
  onSelect: (id: number) => void;
  onNewConv: () => void;
}

const PLATFORM_ICON: Record<
  "youtube" | "tiktok",
  { src: string; alt: string }
> = {
  youtube: { src: "/platforms/youtube-icon-red.svg", alt: "YouTube" },
  tiktok: { src: "/platforms/tiktok-note-color.svg", alt: "TikTok" },
};

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

export const ConversationsDrawer: React.FC<Props> = ({
  open,
  onClose,
  conversations,
  activeConvId,
  onSelect,
  onNewConv,
}) => {
  const [query, setQuery] = useState("");

  if (!open) return null;

  const filtered = conversations.filter((c) =>
    (c.title + " " + (c.last_snippet ?? ""))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const grouped = groupBy(filtered);

  const renderGroup = (label: string, items: HubConversation[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label} className="mb-3">
        <p className="font-mono text-[10px] tracking-[.12em] text-white/35 uppercase px-3 mb-1.5">
          {label}
        </p>
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              onSelect(c.id);
              onClose();
            }}
            className={
              "w-full px-3 py-2 rounded-lg mb-0.5 flex gap-2.5 items-start text-left transition-colors " +
              (c.id === activeConvId
                ? "bg-indigo-500/10 border border-indigo-500/20"
                : "border border-transparent hover:bg-white/[0.04]")
            }
          >
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
              <p className="text-[11px] text-white/45 truncate mt-0.5">
                {c.last_snippet ?? ""}
              </p>
            </div>
          </button>
        ))}
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
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
          <button
            type="button"
            onClick={onNewConv}
            aria-label="nouvelle conversation"
            className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Nouvelle</span>
          </button>
        </div>
        <div className="px-3 py-2 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-white outline-none focus:border-white/20"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
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
    </AnimatePresence>
  );
};
