/**
 * 🎬 VIDEO DISCOVERY MODAL v3.0
 * Modal de sélection de vidéos après recherche intelligente
 * 
 * 🆕 Nouveautés v3.0:
 * • Filtre par langue avec compteur
 * • Affichage de plus de vidéos (30-50)
 * • Scroll infini avec lazy loading
 * • Badge de langue sur chaque vidéo
 * • Stats détaillées par langue
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  X, Check, Play, Clock, Eye, ThumbsUp, Star, Sparkles,
  AlertTriangle, BookOpen, TrendingUp, Calendar, Filter,
  ChevronDown, ChevronUp, Search, ExternalLink,
  Globe, Languages
} from 'lucide-react';
import { DeepSightSpinner } from './ui';
import type { VideoCandidate, DiscoveryResponse } from '../services/api';
import { ThumbnailImage } from './ThumbnailImage';

// Re-export pour usage externe
export type { VideoCandidate, DiscoveryResponse as DiscoveryResult };

interface VideoDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  discovery: DiscoveryResponse | null;
  onSelectVideo: (video: VideoCandidate) => void;
  onSelectMultiple?: (videos: VideoCandidate[]) => void;
  loading?: boolean;
  userCredits?: number;
  allowMultiple?: boolean;
  maxSelection?: number;
  preSelectTop?: number;
  language?: 'fr' | 'en';
}

type SortOption = 'quality' | 'views' | 'date' | 'academic' | 'tournesol';

// 🆕 Mapping des codes langue vers les noms complets
const LANGUAGE_NAMES: Record<string, { fr: string; en: string; flag: string }> = {
  fr: { fr: 'Français', en: 'French', flag: '🇫🇷' },
  en: { fr: 'Anglais', en: 'English', flag: '🇬🇧' },
  de: { fr: 'Allemand', en: 'German', flag: '🇩🇪' },
  es: { fr: 'Espagnol', en: 'Spanish', flag: '🇪🇸' },
  pt: { fr: 'Portugais', en: 'Portuguese', flag: '🇵🇹' },
  it: { fr: 'Italien', en: 'Italian', flag: '🇮🇹' },
  unknown: { fr: 'Autre', en: 'Other', flag: '🌐' },
};

// Helpers
const formatDuration = (seconds: number): string => {
  if (!seconds) return '?:??';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatViews = (views: number): string => {
  if (!views) return '0';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '?';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '?';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days < 1) return 'Aujourd\'hui';
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
  return `Il y a ${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`;
};

const getQualityColor = (score: number): string => {
  if (score >= 70) return 'text-green-500 bg-green-500/10';
  if (score >= 50) return 'text-yellow-500 bg-yellow-500/10';
  if (score >= 30) return 'text-orange-500 bg-orange-500/10';
  return 'text-red-500 bg-red-500/10';
};

// 🆕 Language Badge Component
const LanguageBadge: React.FC<{ lang: string; size?: 'sm' | 'md' }> = ({ lang, size = 'sm' }) => {
  const langInfo = LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.unknown;
  
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary ${
      size === 'sm' ? 'text-[10px]' : 'text-xs'
    }`}>
      <span>{langInfo.flag}</span>
      <span className="uppercase font-medium">{lang}</span>
    </span>
  );
};

// Video Card Component
const VideoCard: React.FC<{
  video: VideoCandidate;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
  language: 'fr' | 'en';
}> = ({ video, rank, isSelected, onSelect, language }) => {
  const [expanded, setExpanded] = useState(false);
  
  const t = language === 'fr' ? {
    sources: 'sources détectées',
    academic: 'Académique',
    engagement: 'Engagement',
    freshness: 'Fraîcheur',
    clickbait: 'Clickbait',
    tournesol: 'Tournesol',
    select: 'Sélectionner',
    selected: 'Sélectionné',
    details: 'Détails',
    matchedTerms: 'Termes trouvés',
  } : {
    sources: 'detected sources',
    academic: 'Academic',
    engagement: 'Engagement',
    freshness: 'Freshness',
    clickbait: 'Clickbait',
    tournesol: 'Tournesol',
    select: 'Select',
    selected: 'Selected',
    details: 'Details',
    matchedTerms: 'Matched terms',
  };
  
  const videoLang = video.language || 'unknown';
  
  return (
    <div className={`relative bg-bg-elevated border-2 rounded-xl overflow-hidden transition-all hover:shadow-lg ${
      video.is_tournesol_pick
        ? 'border-yellow-400 ring-2 ring-yellow-400/30 shadow-yellow-400/20 shadow-lg'
        : isSelected 
          ? 'border-accent-primary ring-2 ring-accent-primary/20' 
          : 'border-border-default hover:border-border-hover'
    }`}>
      {/* Rank Badge */}
      <div className={`absolute top-2 left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
        video.is_tournesol_pick
          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg'
          : rank <= 3 
            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg' 
            : 'bg-bg-tertiary text-text-secondary'
      }`}>
        {video.is_tournesol_pick ? '🌻' : rank}
      </div>
      
      {/* Quality Score Badge */}
      <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-lg text-sm font-bold ${getQualityColor(video.quality_score || 0)}`}>
        {Math.round(video.quality_score || 0)}
      </div>
      
      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg-tertiary">
        <ThumbnailImage
          thumbnailUrl={video.thumbnail_url}
          videoId={video.video_id}
          title={video.title}
          className="w-full h-full object-cover"
        />
        
        {/* 🌻 Tournesol Pick banner */}
        {video.is_tournesol_pick && (
          <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold flex items-center justify-center gap-1">
            🌻 Recommandé par Tournesol
          </div>
        )}
        
        {/* Duration overlay */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
          {formatDuration(video.duration || 0)}
        </div>
        
        {/* 🆕 Language Badge */}
        <div className="absolute bottom-2 left-2">
          <LanguageBadge lang={videoLang} />
        </div>
        
        {/* Tournesol score badge (if not a pick but has score) */}
        {!video.is_tournesol_pick && (video.tournesol_score || 0) > 0 && (
          <div className="absolute top-2 left-10 px-2 py-0.5 rounded bg-yellow-500/90 text-black text-xs font-bold flex items-center gap-1">
            🌻 {Math.round(video.tournesol_score || 0)}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-3">
        {/* Title */}
        <h3 className="font-semibold text-sm text-text-primary line-clamp-2 mb-1.5 min-h-[2.5rem]">
          {video.title}
        </h3>
        
        {/* Channel */}
        <p className="text-xs text-text-secondary mb-2 truncate">
          {video.channel}
        </p>
        
        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-text-tertiary mb-2">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {formatViews(video.view_count || 0)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(video.published_at || video.publish_date)}
          </span>
        </div>
        
        {/* Sources detected */}
        {(video.detected_sources || 0) > 0 && (
          <div className="flex items-center gap-1 text-xs text-blue-500 mb-2">
            <BookOpen className="w-3 h-3" />
            <span>{video.detected_sources} {t.sources}</span>
          </div>
        )}
        
        {/* Matched terms */}
        {video.matched_query_terms && video.matched_query_terms.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {video.matched_query_terms.slice(0, 4).map((term, i) => (
              <span 
                key={i}
                className="px-1.5 py-0.5 rounded bg-accent-primary/10 text-accent-primary text-xs"
              >
                {term}
              </span>
            ))}
          </div>
        )}
        
        {/* Expand details */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="w-full flex items-center justify-center gap-1 text-xs text-text-tertiary hover:text-text-secondary py-1 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {t.details}
        </button>
        
        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 pt-2 border-t border-border-subtle space-y-2 animate-fadeIn">
            {/* Score bars */}
            <div className="space-y-1.5">
              <ScoreBar label={t.academic} value={(video.academic_score || 0) / 100} color="blue" />
              <ScoreBar label={t.engagement} value={(video.engagement_score || 0) / 100} color="green" />
              <ScoreBar label={t.freshness} value={(video.freshness_score || 0) / 100} color="purple" />
              {video.tournesol_score && video.tournesol_score > 0 && (
                <ScoreBar 
                  label={t.tournesol} 
                  value={Math.min((video.tournesol_score + 100) / 200, 1)} 
                  color="yellow" 
                />
              )}
              {(video.clickbait_penalty || 0) > 0 && (
                <ScoreBar 
                  label={t.clickbait} 
                  value={(video.clickbait_penalty || 0) / 100} 
                  color="red" 
                  isNegative 
                />
              )}
            </div>
            
            {/* Description preview */}
            {video.description && (
              <p className="text-xs text-text-tertiary line-clamp-3 mt-2">
                {video.description}
              </p>
            )}
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onSelect}
            className={`flex-1 btn text-sm py-2 ${
              isSelected 
                ? 'btn-primary' 
                : 'btn-secondary'
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4" />
                {t.selected}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                {t.select}
              </>
            )}
          </button>
          
          <a
            href={`https://youtube.com/watch?v=${video.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

// Score Bar Component
const ScoreBar: React.FC<{
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'red' | 'yellow';
  isNegative?: boolean;
}> = ({ label, value, color, isNegative = false }) => {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  };
  
  const percentage = Math.min(100, Math.max(0, Math.round(value * 100)));
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-tertiary w-16 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${colors[color]} ${isNegative ? 'opacity-60' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] text-text-tertiary w-8 text-right">
        {isNegative ? '-' : ''}{percentage}%
      </span>
    </div>
  );
};

// 🆕 Language Filter Pills
const LanguageFilterPills: React.FC<{
  languages: string[];
  counts: Record<string, number>;
  selected: string;
  onSelect: (lang: string) => void;
  uiLang: 'fr' | 'en';
}> = ({ languages, counts, selected, onSelect, uiLang }) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-text-tertiary flex items-center gap-1">
        <Languages className="w-3.5 h-3.5" />
        {uiLang === 'fr' ? 'Langues:' : 'Languages:'}
      </span>
      
      {/* All button */}
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          selected === 'all'
            ? 'bg-accent-primary text-white'
            : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
        }`}
      >
        {uiLang === 'fr' ? 'Toutes' : 'All'} ({total})
      </button>
      
      {/* Language buttons */}
      {languages.map(lang => {
        const count = counts[lang] || 0;
        if (count === 0) return null;
        
        const langInfo = LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.unknown;
        
        return (
          <button
            key={lang}
            onClick={() => onSelect(lang)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
              selected === lang
                ? 'bg-accent-primary text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <span>{langInfo.flag}</span>
            <span>{langInfo[uiLang]}</span>
            <span className="opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
};

// Main Modal Component
export const VideoDiscoveryModal: React.FC<VideoDiscoveryModalProps> = ({
  isOpen,
  onClose,
  discovery,
  onSelectVideo,
  onSelectMultiple,
  loading = false,
  userCredits = 0,
  allowMultiple = false,
  maxSelection = 20,
  preSelectTop = 0,
  language = 'fr',
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('quality');
  const [filterContentType, setFilterContentType] = useState<string>('all');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');  // 🆕
  const [visibleCount, setVisibleCount] = useState(12);  // 🆕 Pagination progressive
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 🆕 Pre-select top N videos when discovery results arrive
  useEffect(() => {
    if (discovery?.candidates && preSelectTop > 0 && allowMultiple) {
      const topVideos = discovery.candidates.slice(0, Math.min(preSelectTop, maxSelection));
      const topIds = new Set(topVideos.map(v => v.video_id));
      setSelectedIds(topIds);
    }
  }, [discovery, preSelectTop, maxSelection, allowMultiple]);
  
  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(12);
  }, [filterLanguage, filterContentType, sortBy]);
  
  const t = language === 'fr' ? {
    title: 'Résultats de recherche',
    subtitle: 'Sélectionnez une vidéo à analyser',
    subtitleMultiple: 'Sélectionnez jusqu\'à {max} vidéos',
    found: '{count} vidéos trouvées',
    searchedIn: 'Recherché dans',
    duration: 'en {ms}ms',
    sortBy: 'Trier par',
    sortOptions: {
      quality: 'Qualité',
      views: 'Vues',
      date: 'Date',
      academic: 'Académique',
      tournesol: 'Tournesol',
    },
    filter: 'Filtrer',
    filterAll: 'Tous',
    selected: '{count} sélectionnée(s)',
    credits: '{count} crédit(s)',
    analyze: 'Analyser',
    analyzeSelected: 'Analyser la sélection',
    insufficientCredits: 'Crédits insuffisants',
    noResults: 'Aucun résultat',
    tryDifferent: 'Essayez une recherche différente',
    loadMore: 'Charger plus',
    showingOf: 'Affichage de {shown} sur {total}',
  } : {
    title: 'Search Results',
    subtitle: 'Select a video to analyze',
    subtitleMultiple: 'Select up to {max} videos',
    found: '{count} videos found',
    searchedIn: 'Searched in',
    duration: 'in {ms}ms',
    sortBy: 'Sort by',
    sortOptions: {
      quality: 'Quality',
      views: 'Views',
      date: 'Date',
      academic: 'Academic',
      tournesol: 'Tournesol',
    },
    filter: 'Filter',
    filterAll: 'All',
    selected: '{count} selected',
    credits: '{count} credit(s)',
    analyze: 'Analyze',
    analyzeSelected: 'Analyze selection',
    insufficientCredits: 'Insufficient credits',
    noResults: 'No results',
    tryDifferent: 'Try a different search',
    loadMore: 'Load more',
    showingOf: 'Showing {shown} of {total}',
  };
  
  // Toggle selection
  const toggleSelection = useCallback((videoId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        if (!allowMultiple) {
          next.clear();
        } else if (next.size >= maxSelection) {
          return prev;
        }
        next.add(videoId);
      }
      return next;
    });
  }, [allowMultiple, maxSelection]);
  
  // 🆕 Calculate language counts
  const languageCounts = useMemo(() => {
    if (!discovery?.candidates) return {};
    
    const counts: Record<string, number> = {};
    for (const c of discovery.candidates) {
      const lang = c.language || 'unknown';
      counts[lang] = (counts[lang] || 0) + 1;
    }
    return counts;
  }, [discovery?.candidates]);
  
  // 🆕 Get unique languages
  const availableLanguages = useMemo(() => {
    return Object.keys(languageCounts).sort((a, b) => {
      // Prioritize fr and en
      if (a === 'fr') return -1;
      if (b === 'fr') return 1;
      if (a === 'en') return -1;
      if (b === 'en') return 1;
      return (languageCounts[b] || 0) - (languageCounts[a] || 0);
    });
  }, [languageCounts]);
  
  // Sort and filter candidates
  const sortedCandidates = useMemo(() => {
    if (!discovery?.candidates) return [];
    
    let filtered = [...discovery.candidates];
    
    // Filter by language
    if (filterLanguage !== 'all') {
      filtered = filtered.filter(c => (c.language || 'unknown') === filterLanguage);
    }
    
    // Filter by content type
    if (filterContentType !== 'all') {
      filtered = filtered.filter(c => c.content_type === filterContentType);
    }
    
    // Sort
    switch (sortBy) {
      case 'views':
        return filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
      case 'date':
        return filtered.sort((a, b) => {
          const dateA = a.published_at || a.publish_date;
          const dateB = b.published_at || b.publish_date;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
      case 'academic':
        return filtered.sort((a, b) => (b.academic_score || 0) - (a.academic_score || 0));
      case 'tournesol':
        return filtered.sort((a, b) => {
          // Tournesol picks first
          if (a.is_tournesol_pick && !b.is_tournesol_pick) return -1;
          if (!a.is_tournesol_pick && b.is_tournesol_pick) return 1;
          return (b.tournesol_score || 0) - (a.tournesol_score || 0);
        });
      case 'quality':
      default:
        return filtered.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
    }
  }, [discovery?.candidates, sortBy, filterContentType, filterLanguage]);
  
  // 🆕 Visible candidates with pagination
  const visibleCandidates = useMemo(() => {
    return sortedCandidates.slice(0, visibleCount);
  }, [sortedCandidates, visibleCount]);
  
  // Get content types for filter
  const contentTypes = useMemo(() => {
    if (!discovery?.candidates) return [];
    const types = new Set(discovery.candidates.map(c => c.content_type).filter(Boolean));
    return Array.from(types);
  }, [discovery?.candidates]);
  
  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (!discovery) return;
    
    if (allowMultiple && onSelectMultiple) {
      const selected = discovery.candidates.filter(c => selectedIds.has(c.video_id));
      onSelectMultiple(selected);
    } else {
      const videoId = Array.from(selectedIds)[0];
      const video = discovery.candidates.find(c => c.video_id === videoId);
      if (video) onSelectVideo(video);
    }
    
    onClose();
  }, [discovery, selectedIds, allowMultiple, onSelectMultiple, onSelectVideo, onClose]);
  
  // 🆕 Load more handler
  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 12, sortedCandidates.length));
  }, [sortedCandidates.length]);
  
  // 🆕 Infinite scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        if (visibleCount < sortedCandidates.length) {
          setVisibleCount(prev => Math.min(prev + 6, sortedCandidates.length));
        }
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [visibleCount, sortedCandidates.length]);
  
  // Credit calculation
  const creditCost = selectedIds.size || 1;
  const hasEnoughCredits = userCredits >= creditCost;
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-bg-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-500" />
              {t.title}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              {allowMultiple 
                ? t.subtitleMultiple.replace('{max}', maxSelection.toString())
                : t.subtitle
              }
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Stats bar */}
        {discovery && (
          <div className="px-6 py-3 bg-bg-tertiary/50 border-b border-border-subtle space-y-3">
            {/* First row: Stats and filters */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 text-sm text-text-secondary">
                <span>
                  <strong className="text-text-primary">{discovery.candidates.length}</strong> {t.found.replace('{count}', '')}
                </span>
                <span className="text-text-tertiary">•</span>
                <span>
                  {t.searchedIn}: {discovery.languages_searched.join(', ')}
                </span>
                <span className="text-text-tertiary">•</span>
                <span>
                  {t.duration.replace('{ms}', discovery.search_duration_ms.toString())}
                </span>
                {discovery.tournesol_available && (
                  <>
                    <span className="text-text-tertiary">•</span>
                    <span className="flex items-center gap-1">
                      🌻 Tournesol
                    </span>
                  </>
                )}
              </div>
              
              {/* Filters */}
              <div className="flex items-center gap-3">
                {/* Sort */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary">{t.sortBy}</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-bg-elevated border border-border-default rounded-lg px-2 py-1 text-sm text-text-primary cursor-pointer"
                  >
                    {Object.entries(t.sortOptions).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Content type filter */}
                {contentTypes.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-tertiary">{t.filter}</span>
                    <select
                      value={filterContentType}
                      onChange={(e) => setFilterContentType(e.target.value)}
                      className="bg-bg-elevated border border-border-default rounded-lg px-2 py-1 text-sm text-text-primary cursor-pointer"
                    >
                      <option value="all">{t.filterAll}</option>
                      {contentTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            {/* 🆕 Second row: Language filter pills */}
            {availableLanguages.length > 1 && (
              <LanguageFilterPills
                languages={availableLanguages}
                counts={languageCounts}
                selected={filterLanguage}
                onSelect={setFilterLanguage}
                uiLang={language}
              />
            )}
          </div>
        )}
        
        {/* Content */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <DeepSightSpinner size="lg" showLabel label={language === 'fr' ? 'Recherche en cours...' : 'Searching...'} />
              <p className="text-xs text-text-tertiary mt-2">
              <p className="text-xs text-text-tertiary mt-2">
                {language === 'fr' 
                  ? 'Recherche parallèle dans toutes les langues sélectionnées'
                  : 'Parallel search across all selected languages'
                }
              </p>
            </div>
          ) : sortedCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-text-muted mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">{t.noResults}</h3>
              <p className="text-text-secondary">{t.tryDifferent}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleCandidates.map((video, index) => (
                  <VideoCard
                    key={video.video_id}
                    video={video}
                    rank={index + 1}
                    isSelected={selectedIds.has(video.video_id)}
                    onSelect={() => toggleSelection(video.video_id)}
                    language={language}
                  />
                ))}
              </div>
              
              {/* 🆕 Load more / Progress indicator */}
              {visibleCount < sortedCandidates.length && (
                <div className="flex flex-col items-center mt-6 gap-3">
                  <p className="text-sm text-text-tertiary">
                    {t.showingOf
                      .replace('{shown}', visibleCount.toString())
                      .replace('{total}', sortedCandidates.length.toString())
                    }
                  </p>
                  <button
                    onClick={handleLoadMore}
                    className="btn btn-secondary"
                  >
                    <ChevronDown className="w-4 h-4" />
                    {t.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-default bg-bg-tertiary/50">
          <div className="flex items-center gap-4 text-sm">
            {selectedIds.size > 0 && (
              <span className="text-text-primary font-medium">
                {t.selected.replace('{count}', selectedIds.size.toString())}
              </span>
            )}
            <span className={`${hasEnoughCredits ? 'text-text-secondary' : 'text-red-500'}`}>
              {t.credits.replace('{count}', creditCost.toString())}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="btn btn-ghost"
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0 || !hasEnoughCredits}
              className="btn btn-primary"
            >
              {!hasEnoughCredits ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  {t.insufficientCredits}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {allowMultiple && selectedIds.size > 1 
                    ? t.analyzeSelected 
                    : t.analyze
                  }
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDiscoveryModal;
