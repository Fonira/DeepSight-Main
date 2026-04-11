/**
 * RecentActivity — Timeline of recent analyses in the right sidebar.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';

interface RecentAnalysis {
  id: number;
  video_id: string;
  video_title: string;
  platform: string;
  thumbnail_url?: string;
  created_at: string;
}

interface RecentActivityProps {
  items: RecentAnalysis[];
  isLoading: boolean;
}

function timeAgo(dateStr: string, lang: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return lang === 'fr' ? 'À l\'instant' : 'Just now';
  if (minutes < 60) return lang === 'fr' ? `il y a ${minutes}min` : `${minutes}m ago`;
  if (hours < 24) return lang === 'fr' ? `il y a ${hours}h` : `${hours}h ago`;
  if (days < 7) return lang === 'fr' ? `il y a ${days}j` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
}

const PlatformIcon: React.FC<{ platform: string }> = ({ platform }) => {
  if (platform === 'tiktok') {
    return <img src="/platforms/tiktok-primary-white.svg" alt="TikTok" className="w-3 h-3 opacity-60" />;
  }
  return <img src="/platforms/youtube-icon-red.svg" alt="YouTube" className="w-3 h-3 opacity-70" />;
};

export const RecentActivity: React.FC<RecentActivityProps> = ({ items, isLoading }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <div className="space-y-2">
      {/* Section title */}
      <h3 className="font-display text-xs font-semibold text-accent-primary uppercase tracking-wider flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        {language === 'fr' ? 'Activité récente' : 'Recent activity'}
      </h3>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical golden line */}
        {items.length > 1 && (
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gradient-to-b from-accent-primary/30 via-accent-primary/10 to-transparent" />
        )}

        <div className="space-y-0.5">
          {isLoading && items.length === 0 && (
            <div className="space-y-2 pl-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-white/5 rounded w-full mb-1" />
                  <div className="h-2 bg-white/5 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {items.length === 0 && !isLoading && (
            <p className="text-xs text-text-tertiary italic py-2 pl-5">
              {language === 'fr' ? 'Aucune analyse récente' : 'No recent analyses'}
            </p>
          )}

          {items.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04, duration: 0.2 }}
              onClick={() => navigate(`/dashboard?id=${item.id}`)}
              className="w-full flex items-start gap-2.5 py-1.5 pl-0 pr-1 rounded-md hover:bg-white/[0.03] transition-all text-left group"
            >
              {/* Timeline dot */}
              <div className="w-[11px] h-[11px] rounded-full border-2 border-accent-primary/40 bg-bg-secondary flex-shrink-0 mt-0.5 group-hover:border-accent-primary group-hover:bg-accent-primary/20 transition-all" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <PlatformIcon platform={item.platform} />
                  <span className="text-[10px] text-text-tertiary">
                    {timeAgo(item.created_at, language)}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-tight line-clamp-2 group-hover:text-text-primary transition-colors">
                  {item.video_title}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};
