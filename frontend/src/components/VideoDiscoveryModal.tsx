/**
 * 🎬 VIDEO DISCOVERY MODAL v2.0
 * Modal de sélection de vidéos après recherche intelligente
 * 
 * Affiche les candidats avec leurs scores de qualité
 * Permet la sélection simple ou multiple (pour playlists)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X, Check, Play, Eye, ThumbsUp, Sparkles,
  AlertTriangle, BookOpen, Calendar,
  ChevronDown, ChevronUp, Search, ExternalLink
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
  preSelectTop?: number;  // 🆕 Pre-select top N videos automatically
  language?: 'fr' | 'en';
}

type SortOption = 'quality' | 'views' | 'date' | 'academic';

// Helpers
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatViews = (views: number): string => {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '?';
  const date = new Date(dateStr);
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
    select: 'Select',
    selected: 'Selected',
    details: 'Details',
    matchedTerms: 'Matched terms',
  };
  
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
      <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-lg text-sm font-bold ${getQualityColor(video.quality_score)}`}>
        {Math.round(video.quality_score)}
      </div>
      
      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg-tertiary">
        <ThumbnailImage
          thumbnailUrl={video.thumbnail_url}
          videoId={video.video_id}
          title={video.title}
          className="w-full h-full object-cover"
        />
        
        {/* 🌻 Tournesol Pick badge - Prominent banner */}
        {video.is_tournesol_pick && (
          <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold flex items-center justify-center gap-1">
            🌻 Recommandé par Tournesol
          </div>
        )}
        
        {/* Duration overlay */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
          {formatDuration(video.duration || 0)}
        </div>

        {/* Tournesol score badge (if not a pick but has score) */}
        {!video.is_tournesol_pick && (video.tournesol_score ?? 0) > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-yellow-500/90 text-black text-xs font-bold flex items-center gap-1">
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
            <ThumbsUp className="w-3 h-3" />
            {formatViews(video.view_count || 0)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(video.published_at ?? null)}
          </span>
        </div>
        
        {/* Sources detected */}
        {(video.detected_sources ?? 0) > 0 && (
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
              <ScoreBar label={t.academic} value={video.academic_score || 0} color="blue" />
              <ScoreBar label={t.engagement} value={video.engagement_score || 0} color="green" />
              <ScoreBar label={t.freshness} value={video.freshness_score || 0} color="purple" />
              {(video.clickbait_penalty || 0) > 0 && (
                <ScoreBar
                  label={t.clickbait}
                  value={video.clickbait_penalty || 0}
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
  
  const percentage = Math.min(100, Math.round(value * 100));
  
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
  
  // 🆕 Pre-select top N videos when discovery results arrive
  useEffect(() => {
    if (discovery?.candidates && preSelectTop > 0 && allowMultiple) {
      const topVideos = discovery.candidates.slice(0, Math.min(preSelectTop, maxSelection));
      const topIds = new Set(topVideos.map(v => v.video_id));
      setSelectedIds(topIds);
    }
  }, [discovery, preSelectTop, maxSelection, allowMultiple]);
  
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
          return prev; // Don't add if at max
        }
        next.add(videoId);
      }
      return next;
    });
  }, [allowMultiple, maxSelection]);
  
  // Sort candidates
  const sortedCandidates = useMemo(() => {
    if (!discovery?.candidates) return [];
    
    let filtered = [...discovery.candidates];
    
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
          if (!a.published_at) return 1;
          if (!b.published_at) return -1;
          return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        });
      case 'academic':
        return filtered.sort((a, b) => (b.academic_score || 0) - (a.academic_score || 0));
      case 'quality':
      default:
        return filtered.sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
    }
  }, [discovery?.candidates, sortBy, filterContentType]);
  
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
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-bg-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleIn">
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
          <div className="flex items-center justify-between px-6 py-3 bg-bg-tertiary/50 border-b border-border-subtle">
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
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <DeepSightSpinner size="lg" />
              <p className="text-text-secondary">Recherche en cours...</p>
            </div>
          ) : sortedCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-text-muted mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">{t.noResults}</h3>
              <p className="text-text-secondary">{t.tryDifferent}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedCandidates.map((video, index) => (
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
              Annuler
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
