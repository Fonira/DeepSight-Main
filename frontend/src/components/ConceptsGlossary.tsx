/**
 * 📚 CONCEPTS GLOSSARY v1.1 — Affichage des concepts clés avec définitions
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Nouvelle approche: Au lieu d'essayer de parser les [[concepts]] inline,
 * on les extrait et affiche leurs définitions dans une section dédiée.
 * 
 * v1.1: Suppression des liens Wikipedia
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, memo } from 'react';
import { BookOpen, ChevronDown, ChevronUp, User, Building2, Cpu, Lightbulb, HelpCircle, RefreshCw } from 'lucide-react';
import { DeepSightSpinnerMicro, DeepSightSpinnerSmall } from './ui';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Concept {
  term: string;
  definition: string;
  category: 'person' | 'technology' | 'company' | 'concept' | 'other';
}

interface ConceptsGlossaryProps {
  summaryId: number;
  language?: 'fr' | 'en';
  className?: string;
}

interface ConceptsResponse {
  summary_id: number;
  video_title: string;
  concepts: Concept[];
  count: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 ICÔNES PAR CATÉGORIE
// ═══════════════════════════════════════════════════════════════════════════════

const CategoryIcon: React.FC<{ category: string; className?: string }> = ({ category, className = "w-4 h-4" }) => {
  switch (category) {
    case 'person':
      return <User className={className} />;
    case 'company':
      return <Building2 className={className} />;
    case 'technology':
      return <Cpu className={className} />;
    case 'concept':
      return <Lightbulb className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
};

const categoryColors: Record<string, string> = {
  person: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  company: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  technology: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  concept: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const categoryLabels: Record<string, Record<string, string>> = {
  fr: {
    person: 'Personne',
    company: 'Entreprise',
    technology: 'Technologie',
    concept: 'Concept',
    other: 'Autre',
  },
  en: {
    person: 'Person',
    company: 'Company',
    technology: 'Technology',
    concept: 'Concept',
    other: 'Other',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ConceptsGlossary: React.FC<ConceptsGlossaryProps> = memo(({
  summaryId,
  language = 'fr',
  className = '',
}) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'https://deep-sight-backend-v3-production.up.railway.app';

  // Charger les concepts quand on expand
  const loadConcepts = async () => {
    if (hasLoaded || loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/videos/concepts/${summaryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load concepts');
      }

      const data: ConceptsResponse = await response.json();
      setConcepts(data.concepts);
      setHasLoaded(true);
    } catch (err) {
      console.error('Error loading concepts:', err);
      setError(language === 'fr' ? 'Erreur de chargement' : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  // Charger quand on expand
  useEffect(() => {
    if (isExpanded && !hasLoaded) {
      loadConcepts();
    }
  }, [isExpanded]);

  // Reset quand summaryId change
  useEffect(() => {
    setConcepts([]);
    setHasLoaded(false);
    setError(null);
    setIsExpanded(false);
  }, [summaryId]);

  const labels = categoryLabels[language] || categoryLabels.fr;
  const title = language === 'fr' ? 'Concepts Clés' : 'Key Concepts';
  const noConceptsText = language === 'fr' ? 'Aucun concept identifié' : 'No concepts identified';
  const loadingText = language === 'fr' ? 'Chargement des définitions...' : 'Loading definitions...';
  const clickToLoadText = language === 'fr' ? 'Cliquez pour charger les définitions' : 'Click to load definitions';

  return (
    <div className={`concepts-glossary ${className}`}>
      {/* Header cliquable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-bg-secondary hover:bg-bg-tertiary rounded-xl border border-border-primary transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-primary/20">
            <BookOpen className="w-5 h-5 text-accent-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-text-primary">📚 {title}</h3>
            <p className="text-xs text-text-muted">
              {hasLoaded 
                ? `${concepts.length} ${language === 'fr' ? 'termes' : 'terms'}`
                : clickToLoadText
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {loading && <DeepSightSpinnerMicro />}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-muted" />
          )}
        </div>
      </button>

      {/* Contenu expandable */}
      {isExpanded && (
        <div className="mt-2 p-4 bg-bg-secondary rounded-xl border border-border-primary animate-fadeIn">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-muted gap-3">
              <DeepSightSpinnerSmall />
              <span>{loadingText}</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-muted">
              <p className="mb-3">{error}</p>
              <button
                onClick={() => { setHasLoaded(false); loadConcepts(); }}
                className="flex items-center gap-2 px-4 py-2 bg-accent-primary/20 hover:bg-accent-primary/30 rounded-lg text-accent-primary transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {language === 'fr' ? 'Réessayer' : 'Retry'}
              </button>
            </div>
          ) : concepts.length === 0 ? (
            <p className="text-center py-8 text-text-muted">{noConceptsText}</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {concepts.map((concept, index) => (
                <div
                  key={`${concept.term}-${index}`}
                  className="p-3 bg-bg-tertiary rounded-lg border border-border-primary hover:border-accent-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {/* Terme + Catégorie */}
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-text-primary">{concept.term}</h4>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${categoryColors[concept.category]}`}>
                          <CategoryIcon category={concept.category} className="w-3 h-3" />
                          {labels[concept.category]}
                        </span>
                      </div>
                      
                      {/* Définition */}
                      {concept.definition ? (
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {concept.definition}
                        </p>
                      ) : (
                        <p className="text-sm text-text-muted italic">
                          {language === 'fr' ? 'Définition non disponible' : 'Definition not available'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ConceptsGlossary.displayName = 'ConceptsGlossary';
export default ConceptsGlossary;
