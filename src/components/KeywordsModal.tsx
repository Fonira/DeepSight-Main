/**
 * 🏷️ KEYWORDS MODAL v2.0 — Affichage des mots-clés avec définitions enrichies
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Fonctionnalités:
 * - Définitions IA enrichies (Mistral + Perplexity)
 * - Catégorisation intelligente avec icônes
 * - Sources web pour Pro/Expert
 * - Vue détaillée expandable
 * - Copie rapide des termes
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { 
  X, Tags, Copy, Check, Hash, Sparkles, 
  Filter, Search, ChevronDown, ChevronUp, 
  Loader2, ExternalLink, BookOpen, Zap, Globe, Info, Star
} from 'lucide-react';
import { EnrichedConcept } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface KeywordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  tags?: string[];
  concepts?: EnrichedConcept[];
  loading?: boolean;
  language?: 'fr' | 'en';
  provider?: string;
  categories?: Record<string, { label: string; icon: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION DES CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  person: { 
    bg: 'bg-violet-500/15', 
    text: 'text-violet-400', 
    border: 'border-violet-500/30',
    gradient: 'from-violet-500/20 to-purple-500/20'
  },
  company: { 
    bg: 'bg-blue-500/15', 
    text: 'text-blue-400', 
    border: 'border-blue-500/30',
    gradient: 'from-blue-500/20 to-cyan-500/20'
  },
  technology: { 
    bg: 'bg-emerald-500/15', 
    text: 'text-emerald-400', 
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-500/20 to-teal-500/20'
  },
  concept: { 
    bg: 'bg-amber-500/15', 
    text: 'text-amber-400', 
    border: 'border-amber-500/30',
    gradient: 'from-amber-500/20 to-yellow-500/20'
  },
  event: { 
    bg: 'bg-rose-500/15', 
    text: 'text-rose-400', 
    border: 'border-rose-500/30',
    gradient: 'from-rose-500/20 to-pink-500/20'
  },
  place: { 
    bg: 'bg-cyan-500/15', 
    text: 'text-cyan-400', 
    border: 'border-cyan-500/30',
    gradient: 'from-cyan-500/20 to-sky-500/20'
  },
  other: { 
    bg: 'bg-gray-500/15', 
    text: 'text-gray-400', 
    border: 'border-gray-500/30',
    gradient: 'from-gray-500/20 to-slate-500/20'
  },
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  fr: {
    person: 'Personnes',
    company: 'Entreprises',
    technology: 'Technologies',
    concept: 'Concepts',
    event: 'Événements',
    place: 'Lieux',
    other: 'Autres',
    all: 'Tous'
  },
  en: {
    person: 'People',
    company: 'Companies',
    technology: 'Technologies',
    concept: 'Concepts',
    event: 'Events',
    place: 'Places',
    other: 'Others',
    all: 'All'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT CONCEPT CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface ConceptCardProps {
  concept: EnrichedConcept;
  language: 'fr' | 'en';
  onCopy: (text: string) => void;
  index: number;
}

const ConceptCard: React.FC<ConceptCardProps> = memo(({ concept, language, onCopy, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const style = CATEGORY_STYLES[concept.category] || CATEGORY_STYLES.other;
  const hasDefinition = concept.definition && concept.definition.trim().length > 0;
  const hasSources = concept.sources && concept.sources.length > 0;
  const hasRelevance = concept.context_relevance && concept.context_relevance.trim().length > 0;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(concept.term);
    setCopied(true);
    onCopy(concept.term);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${style.border} ${style.bg} hover:shadow-lg hover:shadow-black/20`}
      style={{
        animationDelay: `${index * 40}ms`,
        animation: 'fadeInUp 0.4s ease-out forwards',
      }}
    >
      {/* En-tête */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl flex-shrink-0">{concept.category_icon || '📌'}</span>
            <div className="min-w-0">
              <h3 className={`font-semibold text-base ${style.text} truncate`}>
                {concept.term}
              </h3>
              <span className="text-xs text-text-muted">
                {concept.category_label || CATEGORY_LABELS[language]?.[concept.category] || 'Autre'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Badge provider */}
            {concept.provider === 'perplexity' && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent-primary/20 text-accent-primary rounded-md flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" />
                Web
              </span>
            )}
            
            {/* Confidence indicator */}
            {concept.confidence > 0.8 && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            )}
            
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-all"
              title={language === 'fr' ? 'Copier' : 'Copy'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        
        {/* Définition */}
        {hasDefinition && (
          <p className={`mt-3 text-sm text-text-secondary leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {concept.definition}
          </p>
        )}
        
        {/* Bouton expand si contenu additionnel */}
        {(hasRelevance || hasSources || (hasDefinition && concept.definition.length > 150)) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Voir moins' : 'Show less'}
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Voir plus' : 'Show more'}
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Contenu expandé */}
      {expanded && (
        <div className={`px-4 pb-4 pt-0 space-y-3 border-t ${style.border} bg-gradient-to-b ${style.gradient}`}>
          {/* Pertinence contextuelle */}
          {hasRelevance && (
            <div className="pt-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted mb-1.5">
                <Info className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Pertinence dans ce contexte' : 'Context relevance'}
              </div>
              <p className="text-sm text-text-secondary italic">
                "{concept.context_relevance}"
              </p>
            </div>
          )}
          
          {/* Sources web */}
          {hasSources && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted mb-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Sources' : 'Sources'}
              </div>
              <div className="flex flex-wrap gap-2">
                {concept.sources.slice(0, 3).map((source, idx) => {
                  let hostname = source;
                  try {
                    hostname = new URL(source).hostname;
                  } catch {}
                  return (
                    <a
                      key={idx}
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded-md transition-colors truncate max-w-[200px]"
                    >
                      <Globe className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{hostname}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ConceptCard.displayName = 'ConceptCard';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const KeywordsModal: React.FC<KeywordsModalProps> = memo(({
  isOpen,
  onClose,
  videoTitle,
  tags = [],
  concepts = [],
  loading = false,
  language = 'fr',
  provider = 'none',
  categories = {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedCount, setCopiedCount] = useState(0);

  const labels = CATEGORY_LABELS[language] || CATEGORY_LABELS.fr;

  // Filtrage
  const filteredConcepts = useMemo(() => {
    let filtered = concepts;
    
    // Filtre par catégorie
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }
    
    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.term.toLowerCase().includes(query) ||
        c.definition?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [concepts, selectedCategory, searchQuery]);

  // Catégories disponibles
  const availableCategories = useMemo(() => {
    const cats = new Set<string>(['all']);
    concepts.forEach(c => cats.add(c.category || 'other'));
    return Array.from(cats);
  }, [concepts]);

  // Copier tous les mots-clés
  const handleCopyAll = useCallback(async () => {
    const text = filteredConcepts.map(c => c.term).join(', ');
    await navigator.clipboard.writeText(text);
    setCopiedCount(prev => prev + 1);
  }, [filteredConcepts]);

  const handleCopyOne = useCallback(() => {
    setCopiedCount(prev => prev + 1);
  }, []);

  // Fermeture avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full max-w-3xl bg-bg-secondary rounded-2xl shadow-2xl border border-border-subtle overflow-hidden animate-scale-in"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-bg-elevated to-bg-secondary relative overflow-hidden">
          {/* Pattern décoratif */}
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <pattern id="grid-pattern" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="1" fill="currentColor" opacity="0.5" />
              </pattern>
              <rect width="100" height="100" fill="url(#grid-pattern)" />
            </svg>
          </div>
          
          <div className="flex items-start justify-between relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-primary/20 ring-2 ring-accent-primary/30">
                <BookOpen className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  {language === 'fr' ? 'Glossaire Intelligent' : 'Smart Glossary'}
                  <span className="px-2 py-0.5 text-xs font-medium bg-accent-primary/20 text-accent-primary rounded-full">
                    {concepts.length}
                  </span>
                </h2>
                <p className="text-sm text-text-muted mt-0.5 max-w-md truncate" title={videoTitle}>
                  {videoTitle}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Badge provider */}
              {provider && provider !== 'none' && (
                <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-400 rounded-lg flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  {provider.includes('perplexity') ? 'Perplexity + Mistral' : 'Mistral AI'}
                </span>
              )}
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Barre d'outils */}
        <div className="px-6 py-4 border-b border-border-subtle bg-bg-secondary/50">
          <div className="flex flex-wrap items-center gap-3">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'fr' ? 'Rechercher un concept...' : 'Search concepts...'}
                className="w-full pl-10 pr-4 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/20 transition-all"
              />
            </div>
            
            {/* Filtres par catégorie */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {availableCategories.map(cat => {
                const catInfo = categories[cat];
                const count = cat === 'all' 
                  ? concepts.length 
                  : (catInfo?.count || concepts.filter(c => c.category === cat).length);
                
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                      selectedCategory === cat
                        ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/25'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }`}
                  >
                    {catInfo?.icon && <span>{catInfo.icon}</span>}
                    {catInfo?.label || labels[cat] || cat}
                    <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
            
            {/* Bouton copier tout */}
            <button
              onClick={handleCopyAll}
              disabled={filteredConcepts.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy className="w-4 h-4" />
              {language === 'fr' ? 'Tout copier' : 'Copy all'}
            </button>
          </div>
        </div>

        {/* Contenu - Grille des concepts */}
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
              </div>
              <p className="text-text-secondary font-medium">
                {language === 'fr' ? 'Analyse des concepts...' : 'Analyzing concepts...'}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {language === 'fr' 
                  ? 'Génération des définitions avec l\'IA' 
                  : 'Generating AI-powered definitions'}
              </p>
            </div>
          ) : filteredConcepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
                <Hash className="w-8 h-8 text-text-muted" />
              </div>
              <p className="text-text-secondary font-medium">
                {searchQuery 
                  ? (language === 'fr' ? 'Aucun résultat' : 'No results')
                  : (language === 'fr' ? 'Aucun concept disponible' : 'No concepts available')
                }
              </p>
              <p className="text-sm text-text-muted mt-1">
                {searchQuery 
                  ? (language === 'fr' ? 'Essayez une autre recherche' : 'Try a different search')
                  : (language === 'fr' ? 'Les concepts seront extraits lors de l\'analyse' : 'Concepts will be extracted during analysis')
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredConcepts.map((concept, index) => (
                <ConceptCard
                  key={`${concept.term}-${index}`}
                  concept={concept}
                  language={language}
                  onCopy={handleCopyOne}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {concepts.length > 0 && (
          <div className="px-6 py-4 border-t border-border-subtle bg-bg-secondary/30">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {filteredConcepts.length} {language === 'fr' ? 'affiché(s)' : 'shown'}
                </span>
                {copiedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-green-400">
                    <Check className="w-3.5 h-3.5" />
                    {copiedCount} {language === 'fr' ? 'copié(s)' : 'copied'}
                  </span>
                )}
              </div>
              <span className="text-text-tertiary flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {language === 'fr' 
                  ? 'Définitions générées par IA' 
                  : 'AI-generated definitions'
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Styles pour les animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
});

KeywordsModal.displayName = 'KeywordsModal';
export default KeywordsModal;
