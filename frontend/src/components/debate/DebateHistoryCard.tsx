/**
 * DebateHistoryCard — Carte compacte VS pour l'historique des débats IA
 * Miniature A vs B côte à côte, titre du débat, date, statut
 */

import React from 'react';
import { Swords, Trash2, Eye, Clock, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { DebateAnalysis } from '../../types/debate';

interface DebateHistoryCardProps {
  debate: DebateAnalysis;
  language: string;
  onView: () => void;
  onDelete: () => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: { fr: string; en: string }; color: string }> = {
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: { fr: 'Terminé', en: 'Completed' },
    color: 'text-green-500',
  },
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: { fr: 'En attente', en: 'Pending' },
    color: 'text-amber-500',
  },
  searching: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: { fr: 'Recherche...', en: 'Searching...' },
    color: 'text-blue-500',
  },
  analyzing_b: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: { fr: 'Analyse...', en: 'Analyzing...' },
    color: 'text-blue-500',
  },
  comparing: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: { fr: 'Comparaison...', en: 'Comparing...' },
    color: 'text-purple-500',
  },
  fact_checking: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: { fr: 'Vérification...', en: 'Fact-checking...' },
    color: 'text-cyan-500',
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: { fr: 'Échoué', en: 'Failed' },
    color: 'text-red-500',
  },
};

function getThumbnailUrl(videoId: string | null, providedThumbnail: string | null, platform?: string): string | null {
  if (providedThumbnail) return providedThumbnail;
  if (!videoId) return null;
  if (platform === 'tiktok') return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function formatDate(dateStr: string, language: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return language === 'fr' ? "Aujourd'hui" : 'Today';
  if (diffDays === 1) return language === 'fr' ? 'Hier' : 'Yesterday';
  if (diffDays < 7) return language === 'fr' ? `Il y a ${diffDays}j` : `${diffDays}d ago`;

  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function DebateHistoryCard({ debate, language, onView, onDelete }: DebateHistoryCardProps) {
  const status = statusConfig[debate.status] || statusConfig.pending;
  const thumbA = getThumbnailUrl(debate.video_a_id, debate.video_a_thumbnail, debate.platform_a);
  const thumbB = getThumbnailUrl(debate.video_b_id, debate.video_b_thumbnail, debate.platform_b ?? undefined);

  return (
    <div
      className="card group hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden"
      onClick={onView}
    >
      {/* Thumbnails VS */}
      <div className="relative h-32 flex">
        {/* Video A */}
        <div className="w-1/2 relative overflow-hidden">
          {thumbA ? (
            <img
              src={thumbA}
              alt={debate.video_a_title || 'Vidéo A'}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.includes('mqdefault')) {
                  target.src = `https://img.youtube.com/vi/${debate.video_a_id}/hqdefault.jpg`;
                } else {
                  target.style.display = 'none';
                }
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-white/30">A</span>
            </div>
          )}
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white">
            A
          </div>
        </div>

        {/* VS Badge central */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-indigo-600 border-2 border-bg-primary flex items-center justify-center shadow-lg">
          <Swords className="w-3.5 h-3.5 text-white" />
        </div>

        {/* Video B */}
        <div className="w-1/2 relative overflow-hidden">
          {thumbB ? (
            <img
              src={thumbB}
              alt={debate.video_b_title || 'Vidéo B'}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.includes('mqdefault')) {
                  target.src = `https://img.youtube.com/vi/${debate.video_b_id}/hqdefault.jpg`;
                } else {
                  target.style.display = 'none';
                }
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-white/30">B</span>
            </div>
          )}
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/70 text-white">
            B
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Topic */}
        <h3 className="text-sm font-semibold text-text-primary line-clamp-1 mb-1">
          {debate.detected_topic || (language === 'fr' ? 'Débat IA' : 'AI Debate')}
        </h3>

        {/* Video titles */}
        <div className="space-y-0.5 mb-2">
          <p className="text-xs text-text-secondary line-clamp-1">
            <span className="text-red-400 font-medium">A:</span> {debate.video_a_title || '—'}
          </p>
          <p className="text-xs text-text-secondary line-clamp-1">
            <span className="text-blue-400 font-medium">B:</span> {debate.video_b_title || '—'}
          </p>
        </div>

        {/* Footer: status + date + delete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-xs ${status.color}`}>
              {status.icon}
              {language === 'fr' ? status.label.fr : status.label.en}
            </span>
            <span className="text-xs text-text-muted">
              {formatDate(debate.created_at, language)}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500"
            title={language === 'fr' ? 'Supprimer' : 'Delete'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
