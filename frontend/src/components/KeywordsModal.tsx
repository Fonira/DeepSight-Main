/**
 * 🏷️ KEYWORDS MODAL v2.1 — Glossaire avec définitions complètes
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * TOUTES les définitions sont visibles sans avoir à cliquer
 * Design en liste scrollable pour une lecture facile
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { 
  X, Copy, Check, Hash, Sparkles, 
  Search, ExternalLink,
  BookOpen, Zap, Globe, Star
} from 'lucide-react';
import { DeepSightSpinner } from './ui';
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

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  person: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', dot: 'bg-violet-400' },
  company: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  technology: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  concept: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  event: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400' },
  place: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', dot: 'bg-cyan-400' },
  other: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20', dot: 'bg-gray-400' },
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  fr: {
    person: 'Personnes', company: 'Entreprises', technology: 'Technologies',
    concept: 'Concepts', event: 'Événements', place: 'Lieux', other: 'Autres', all: 'Tous'
  },
  en: {
    person: 'People', company: 'Companies', technology: 'Technologies',
    concept: 'Concepts', event: 'Events', place: 'Places', other: 'Others', all: 'All'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT DÉFINITION ITEM (Liste)
// ═══════════════════════════════════════════════════════════════════════════════

interface DefinitionItemProps {
  concept: EnrichedConcept;
  language: 'fr' | 'en';
  index: number;
}

const DefinitionItem: React.FC<DefinitionItemProps> = memo(({ concept, language, index }) => {
  const [copied, setCopied] = useState(false);
  const style = CATEGORY_STYLES[concept.category] || CATEGORY_STYLES.other;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(concept.term);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasSources = concept.sources && concept.sources.length > 0;

  return (
    <div
      className={`p-4 rounded-xl border ${style.border} ${style.bg} transition-all hover:shadow-md`}
      style={{
        animationDelay: `${index * 30}ms`,
        animation: 'fadeIn 0.3s ease-out forwards',
      }}
    >
      {/* Header: Terme + Catégorie */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{concept.category_icon || '📌'}</span>
          <div>
            <h3 className={`font-semibold ${style.text}`}>{concept.term}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
              <span className="text-xs text-text-muted">
                {concept.category_label || CATEGORY_LABELS[language]?.[concept.category] || 'Autre'}
              </span>
              {concept.provider === 'perplexity' && (
                <span className="px-1.5 py-0.5 text-[9px] font-medium bg-accent-primary/20 text-accent-primary rounded flex items-center gap-0.5">
                  <Globe className="w-2 h-2" /> Web
                </span>
              )}
              {concept.confidence > 0.8 && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-all flex-shrink-0"
          title={language === 'fr' ? 'Copier' : 'Copy'}
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Définition complète - TOUJOURS VISIBLE */}
      {concept.definition && (
        <p className="text-sm text-text-secondary leading-relaxed pl-7">
          {concept.definition}
        </p>
      )}
      
      {/* Pertinence contextuelle */}
      {concept.context_relevance && (
        <p className="text-xs text-text-muted italic mt-2 pl-7 border-l-2 border-text-muted/20 ml-5">
          {concept.context_relevance}
        </p>
      )}
      
      {/* Sources */}
      {hasSources && (
        <div className="flex flex-wrap gap-1.5 mt-2 pl-7">
          {concept.sources.slice(0, 2).map((source, idx) => {
            let hostname = source;
            try { hostname = new URL(source).hostname; } catch { /* invalid URL */ }
            return (
              <a
                key={idx}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-bg-tertiary hover:bg-bg-hover text-text-muted hover:text-text-primary rounded transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {hostname}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
});

DefinitionItem.displayName = 'DefinitionItem';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const KeywordsModal: React.FC<KeywordsModalProps> = memo(({
  isOpen,
  onClose,
  videoTitle,
  concepts = [],
  loading = false,
  language = 'fr',
  provider = 'none',
  categories = {}
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedAll, setCopiedAll] = useState(false);

  const labels = CATEGORY_LABELS[language] || CATEGORY_LABELS.fr;

  // Filtrage
  const filteredConcepts = useMemo(() => {
    let filtered = concepts;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }
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

  // Copier tous
  const handleCopyAll = useCallback(async () => {
    const text = filteredConcepts.map(c => `${c.term}: ${c.definition || ''}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [filteredConcepts]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="w-full max-w-4xl bg-bg-primary rounded-2xl shadow-2xl border border-border-subtle overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle bg-bg-secondary flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent-primary/20">
                <BookOpen className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  {language === 'fr' ? 'Glossaire' : 'Glossary'}
                  <span className="px-2 py-0.5 text-xs font-medium bg-accent-primary/20 text-accent-primary rounded-full">
                    {concepts.length}
                  </span>
                </h2>
                <p className="text-xs text-text-muted truncate max-w-md">{videoTitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {provider && provider !== 'none' && (
                <span className="px-2 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-400 rounded-lg flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {provider.includes('perplexity') ? 'IA Enrichie' : 'Mistral'}
                </span>
              )}
              <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-border-subtle bg-bg-secondary/50 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'fr' ? 'Rechercher...' : 'Search...'}
                className="w-full pl-9 pr-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-all"
              />
            </div>
            
            {/* Filtres catégories */}
            <div className="flex items-center gap-1 flex-wrap">
              {availableCategories.map(cat => {
                const catInfo = categories[cat];
                const count = cat === 'all' ? concepts.length : (catInfo?.count || concepts.filter(c => c.category === cat).length);
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                      selectedCategory === cat
                        ? 'bg-accent-primary text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    {catInfo?.icon && <span className="text-sm">{catInfo.icon}</span>}
                    {catInfo?.label || labels[cat] || cat}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
            
            {/* Copier tout */}
            <button
              onClick={handleCopyAll}
              disabled={filteredConcepts.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedAll ? (language === 'fr' ? 'Copié!' : 'Copied!') : (language === 'fr' ? 'Tout copier' : 'Copy all')}
            </button>
          </div>
        </div>

        {/* Contenu scrollable - LISTE DE DÉFINITIONS */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <DeepSightSpinner size="lg" />
              <p className="text-text-secondary font-medium">
                {language === 'fr' ? 'Génération des définitions...' : 'Generating definitions...'}
              </p>
              <p className="text-sm text-text-muted mt-1">
                {language === 'fr' ? 'Analyse IA en cours' : 'AI analysis in progress'}
              </p>
            </div>
          ) : filteredConcepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Hash className="w-12 h-12 text-text-muted mb-4" />
              <p className="text-text-secondary font-medium">
                {searchQuery ? (language === 'fr' ? 'Aucun résultat' : 'No results') : (language === 'fr' ? 'Aucun concept' : 'No concepts')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConcepts.map((concept, index) => (
                <DefinitionItem
                  key={`${concept.term}-${index}`}
                  concept={concept}
                  language={language}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {concepts.length > 0 && (
          <div className="px-6 py-3 border-t border-border-subtle bg-bg-secondary/30 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {filteredConcepts.length} {language === 'fr' ? 'définition(s)' : 'definition(s)'}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Généré par IA' : 'AI Generated'}
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
});

KeywordsModal.displayName = 'KeywordsModal';
export default KeywordsModal;
