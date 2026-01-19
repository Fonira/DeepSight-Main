/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📜 VirtualHistoryList — Liste Virtualisée pour l'Historique                       ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FONCTIONNALITÉS:                                                                  ║
 * ║  • 🚀 Virtualisation pour des milliers d'éléments sans lag                        ║
 * ║  • 📊 Estimation dynamique de la hauteur des éléments                             ║
 * ║  • 🔄 Support infinite scroll avec chargement progressif                          ║
 * ║  • 🎨 Skeleton loading pendant le scroll rapide                                   ║
 * ║  • ♿ Accessible (focus management, ARIA)                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { 
  useRef, 
  useCallback, 
  useMemo, 
  memo,
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
} from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';
import { 
  Play, 
  Clock, 
  Calendar, 
  Star, 
  MoreVertical,
  Trash2,
  ExternalLink,
  MessageCircle,
  FileText,
  Loader2,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SummaryItem {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration?: number;
  thumbnail_url?: string;
  category?: string;
  word_count?: number;
  created_at: string;
  is_favorite?: boolean;
  mode?: string;
  lang?: string;
}

interface VirtualHistoryListProps {
  /** Liste des résumés à afficher */
  items: SummaryItem[];
  /** Callback quand un élément est sélectionné */
  onSelect?: (item: SummaryItem) => void;
  /** Callback pour ouvrir le menu d'actions */
  onAction?: (item: SummaryItem, action: string) => void;
  /** Callback pour charger plus d'éléments (infinite scroll) */
  onLoadMore?: () => void;
  /** Indique si plus d'éléments sont en cours de chargement */
  isLoading?: boolean;
  /** Indique s'il y a plus d'éléments à charger */
  hasMore?: boolean;
  /** Hauteur du conteneur */
  height?: number | string;
  /** Hauteur estimée d'un élément */
  estimatedItemHeight?: number;
  /** Nombre d'éléments à rendre en dehors du viewport */
  overscan?: number;
  /** Langue pour les labels */
  language?: 'fr' | 'en';
  /** ID de l'élément actuellement sélectionné */
  selectedId?: number;
  /** Classe CSS additionnelle */
  className?: string;
}

export interface VirtualHistoryListRef {
  scrollToItem: (index: number) => void;
  scrollToTop: () => void;
  getVirtualItems: () => VirtualItem[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 ITEM COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface SummaryCardProps {
  item: SummaryItem;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: string) => void;
  language: 'fr' | 'en';
}

const SummaryCard = memo<SummaryCardProps>(({ 
  item, 
  isSelected, 
  onSelect, 
  onAction,
  language 
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return language === 'fr' ? "Aujourd'hui" : 'Today';
    if (diffDays === 1) return language === 'fr' ? 'Hier' : 'Yesterday';
    if (diffDays < 7) return language === 'fr' ? `Il y a ${diffDays} jours` : `${diffDays} days ago`;
    
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };
  
  const getCategoryEmoji = (category?: string) => {
    const emojis: Record<string, string> = {
      interview: '🎙️',
      documentary: '📽️',
      tutorial: '🎓',
      science: '🔬',
      news: '📰',
      conference: '🎤',
      tech: '💻',
      finance: '💰',
      gaming: '🎮',
      culture: '🎨',
      health: '🏥',
    };
    return emojis[category || ''] || '📄';
  };

  return (
    <article
      className={`
        group relative bg-bg-elevated rounded-xl border transition-all duration-200
        ${isSelected 
          ? 'border-accent-primary shadow-lg ring-2 ring-accent-primary/20' 
          : 'border-border-default hover:border-border-hover hover:shadow-md'
        }
      `}
      role="listitem"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <button
          onClick={onSelect}
          className="relative flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-bg-tertiary group/thumb"
          aria-label={language === 'fr' ? 'Voir l\'analyse' : 'View analysis'}
        >
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt=""
              className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-text-muted" />
            </div>
          )}
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/40 transition-colors flex items-center justify-center">
            <Play className="w-8 h-8 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
          </div>
          
          {/* Duration badge */}
          {item.video_duration && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
              {formatDuration(item.video_duration)}
            </span>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <button
            onClick={onSelect}
            className="text-left w-full"
          >
            {/* Title */}
            <h3 className="font-medium text-text-primary line-clamp-2 group-hover:text-accent-primary transition-colors">
              {item.video_title || 'Sans titre'}
            </h3>
            
            {/* Channel */}
            <p className="text-sm text-text-secondary mt-1 truncate">
              {item.video_channel || 'Chaîne inconnue'}
            </p>
          </button>
          
          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(item.created_at)}
            </span>
            
            {item.word_count && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {item.word_count} {language === 'fr' ? 'mots' : 'words'}
              </span>
            )}
            
            <span title={item.category}>
              {getCategoryEmoji(item.category)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-2">
          {/* Favorite */}
          <button
            onClick={() => onAction('favorite')}
            className={`p-1.5 rounded-full transition-colors ${
              item.is_favorite 
                ? 'text-yellow-500 bg-yellow-500/10' 
                : 'text-text-muted hover:text-yellow-500 hover:bg-yellow-500/10'
            }`}
            aria-label={item.is_favorite 
              ? (language === 'fr' ? 'Retirer des favoris' : 'Remove from favorites')
              : (language === 'fr' ? 'Ajouter aux favoris' : 'Add to favorites')
            }
          >
            <Star className="w-4 h-4" fill={item.is_favorite ? 'currentColor' : 'none'} />
          </button>
          
          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label={language === 'fr' ? 'Plus d\'options' : 'More options'}
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {menuOpen && (
              <>
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setMenuOpen(false)}
                />
                
                {/* Menu */}
                <div className="absolute right-0 top-full mt-1 w-40 bg-bg-elevated border border-border-default rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => { onAction('chat'); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat
                  </button>
                  <button
                    onClick={() => { onAction('youtube'); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    YouTube
                  </button>
                  <hr className="my-1 border-border-default" />
                  <button
                    onClick={() => { onAction('delete'); setMenuOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {language === 'fr' ? 'Supprimer' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

SummaryCard.displayName = 'SummaryCard';

// ═══════════════════════════════════════════════════════════════════════════════

const SkeletonCard = memo(() => (
  <div className="bg-bg-elevated rounded-xl border border-border-default p-4 animate-pulse">
    <div className="flex gap-4">
      <div className="w-32 h-20 bg-bg-tertiary rounded-lg" />
      <div className="flex-1 space-y-3">
        <div className="h-5 bg-bg-tertiary rounded w-3/4" />
        <div className="h-4 bg-bg-tertiary rounded w-1/2" />
        <div className="h-3 bg-bg-tertiary rounded w-1/4" />
      </div>
    </div>
  </div>
));

SkeletonCard.displayName = 'SkeletonCard';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const VirtualHistoryList = forwardRef<VirtualHistoryListRef, VirtualHistoryListProps>(({
  items,
  onSelect,
  onAction,
  onLoadMore,
  isLoading = false,
  hasMore = false,
  height = 600,
  estimatedItemHeight = 120,
  overscan = 5,
  language = 'fr',
  selectedId,
  className = '',
}, ref) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Virtual list configuration
  const virtualizer = useVirtualizer({
    count: items.length + (hasMore ? 1 : 0), // +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan,
    // Enable smooth scrolling
    scrollMargin: 20,
  });

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToItem: (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'start', behavior: 'smooth' });
    },
    scrollToTop: () => {
      if (parentRef.current) {
        parentRef.current.scrollTop = 0;
      }
    },
    getVirtualItems: () => virtualizer.getVirtualItems(),
  }), [virtualizer]);

  // Infinite scroll: detect when reaching the end
  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];
  
  useEffect(() => {
    if (!lastItem) return;
    
    // If the last virtual item is the loading indicator
    if (lastItem.index >= items.length - 1 && hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [lastItem, items.length, hasMore, isLoading, onLoadMore]);

  const handleSelect = useCallback((item: SummaryItem) => {
    onSelect?.(item);
  }, [onSelect]);

  const handleAction = useCallback((item: SummaryItem, action: string) => {
    onAction?.(item, action);
  }, [onAction]);

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <FileText className="w-12 h-12 text-text-muted mb-4" />
        <p className="text-text-secondary">
          {language === 'fr' ? 'Aucune analyse trouvée' : 'No analyses found'}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      role="list"
      aria-label={language === 'fr' ? 'Historique des analyses' : 'Analysis history'}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const isLoaderRow = virtualItem.index >= items.length;
          
          if (isLoaderRow) {
            // Loading indicator at the bottom
            return (
              <div
                key="loader"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="flex items-center justify-center py-4"
              >
                <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
                <span className="ml-2 text-text-secondary">
                  {language === 'fr' ? 'Chargement...' : 'Loading...'}
                </span>
              </div>
            );
          }
          
          const item = items[virtualItem.index];
          
          return (
            <div
              key={item.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="pb-3"
            >
              <SummaryCard
                item={item}
                isSelected={item.id === selectedId}
                onSelect={() => handleSelect(item)}
                onAction={(action) => handleAction(item, action)}
                language={language}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

VirtualHistoryList.displayName = 'VirtualHistoryList';

export default VirtualHistoryList;
