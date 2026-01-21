/**
 * DEEP SIGHT — Concept Map Component
 * Affichage d'arbres pédagogiques (mindmaps) avec Mermaid
 * 
 * FONCTIONNALITÉS:
 * - 🌳 Rendu Mermaid mindmap
 * - 🔍 Zoom & Pan
 * - 📋 Liste des concepts
 * - 🛤️ Parcours d'apprentissage
 * - 📥 Export PNG/SVG
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, Download, Copy, Check,
  GitBranch, Layers, ArrowRight, RefreshCw, AlertCircle,
  BookOpen, Route
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Concept {
  name: string;
  type: 'central' | 'primary' | 'secondary' | 'detail';
  description: string;
  related_to?: string[];
}

interface ConceptMapData {
  mermaid_code: string;
  concepts: Concept[];
  hierarchy_depth: number;
  total_concepts: number;
  learning_path: string[];
  generated_at?: string;
  source_video?: string;
  requested_depth?: number;
  with_details?: boolean;
}

interface ConceptMapProps {
  data: ConceptMapData;
  language?: 'fr' | 'en';
  onExport?: (format: 'svg' | 'png') => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getConceptTypeConfig = (type: string) => {
  const configs: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    central: { 
      label: 'Central', 
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300',
      icon: <GitBranch className="w-3 h-3" />
    },
    primary: { 
      label: 'Principal', 
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300',
      icon: <Layers className="w-3 h-3" />
    },
    secondary: { 
      label: 'Secondaire', 
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300',
      icon: <BookOpen className="w-3 h-3" />
    },
    detail: { 
      label: 'Détail', 
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-300',
      icon: <ArrowRight className="w-3 h-3" />
    },
  };
  return configs[type] || configs.secondary;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ConceptMap: React.FC<ConceptMapProps> = ({
  data,
  language = 'fr',
  onExport
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'concepts' | 'path'>('map');

  // Charger et rendre Mermaid
  useEffect(() => {
    const renderMermaid = async () => {
      if (!containerRef.current || !data.mermaid_code) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Charger Mermaid dynamiquement
        const mermaid = await import('mermaid');
        
        mermaid.default.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          mindmap: {
            padding: 20,
            useMaxWidth: true,
          },
          securityLevel: 'loose',
        });
        
        // Nettoyer le code Mermaid
        let cleanCode = data.mermaid_code.trim();
        
        // S'assurer qu'il commence par mindmap
        if (!cleanCode.startsWith('mindmap')) {
          cleanCode = 'mindmap\n' + cleanCode;
        }
        
        // Générer un ID unique
        const id = `mermaid-${Date.now()}`;
        
        // Rendre le diagramme
        const { svg } = await mermaid.default.render(id, cleanCode);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          
          // Ajuster le style du SVG
          const svgElement = containerRef.current.querySelector('svg');
          if (svgElement) {
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
            svgElement.style.transform = `scale(${zoom})`;
            svgElement.style.transformOrigin = 'center center';
            svgElement.style.transition = 'transform 0.3s ease';
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        setError(err.message || 'Erreur de rendu du mindmap');
        setLoading(false);
      }
    };
    
    renderMermaid();
  }, [data.mermaid_code, zoom]);

  // Copier le code Mermaid
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(data.mermaid_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Exporter en SVG
  const handleExportSvg = () => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `concept-map-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const texts = {
    fr: {
      mindmap: 'Carte conceptuelle',
      concepts: 'Concepts',
      learningPath: 'Parcours',
      zoomIn: 'Zoom +',
      zoomOut: 'Zoom -',
      reset: 'Réinitialiser',
      copyCode: 'Copier Mermaid',
      copied: 'Copié !',
      exportSvg: 'Exporter SVG',
      depth: 'Profondeur',
      totalConcepts: 'concepts',
      relatedTo: 'Lié à',
      startHere: 'Commencez ici',
      renderError: 'Erreur de rendu du mindmap',
      loading: 'Génération du mindmap...',
    },
    en: {
      mindmap: 'Concept Map',
      concepts: 'Concepts',
      learningPath: 'Path',
      zoomIn: 'Zoom +',
      zoomOut: 'Zoom -',
      reset: 'Reset',
      copyCode: 'Copy Mermaid',
      copied: 'Copied!',
      exportSvg: 'Export SVG',
      depth: 'Depth',
      totalConcepts: 'concepts',
      relatedTo: 'Related to',
      startHere: 'Start here',
      renderError: 'Mindmap render error',
      loading: 'Generating mindmap...',
    }
  };

  const t = texts[language];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'map'
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <GitBranch className="w-4 h-4 inline mr-2" />
          {t.mindmap}
        </button>
        <button
          onClick={() => setActiveTab('concepts')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'concepts'
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <Layers className="w-4 h-4 inline mr-2" />
          {t.concepts}
          <span className="ml-1 text-xs text-text-muted">({data.total_concepts})</span>
        </button>
        <button
          onClick={() => setActiveTab('path')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'path'
              ? 'bg-bg-primary text-text-primary shadow-sm'
              : 'text-text-tertiary hover:text-text-primary'
          }`}
        >
          <Route className="w-4 h-4 inline mr-2" />
          {t.learningPath}
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-text-muted">
            {t.depth}: <strong className="text-text-primary">{data.hierarchy_depth}</strong>
          </span>
          <span className="text-text-muted">
            <strong className="text-text-primary">{data.total_concepts}</strong> {t.totalConcepts}
          </span>
        </div>
        
        {activeTab === 'map' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
              title={t.zoomOut}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-text-muted w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
              title={t.zoomIn}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
              title={t.reset}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-border-subtle mx-1" />
            <button
              onClick={handleCopyCode}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
              title={t.copyCode}
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleExportSvg}
              className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
              title={t.exportSvg}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'map' && (
        <div className="relative bg-bg-secondary rounded-xl border border-border-subtle overflow-hidden min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 z-10">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-accent-primary" />
                <span className="text-text-secondary">{t.loading}</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 z-10">
              <div className="text-center p-4">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-text-primary font-medium">{t.renderError}</p>
                <p className="text-sm text-text-secondary mt-1">{error}</p>
                <pre className="mt-4 p-3 bg-bg-tertiary rounded text-xs text-left overflow-auto max-h-40 max-w-md">
                  {data.mermaid_code}
                </pre>
              </div>
            </div>
          )}
          
          <div 
            ref={containerRef}
            className="p-4 flex items-center justify-center overflow-auto"
            style={{ minHeight: '400px' }}
          />
        </div>
      )}

      {activeTab === 'concepts' && (
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4 max-h-[500px] overflow-y-auto">
          <div className="space-y-3">
            {data.concepts.map((concept, index) => {
              const config = getConceptTypeConfig(concept.type);
              return (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${config.color}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <span className="font-medium">{concept.name}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20">
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm mt-2 opacity-80">{concept.description}</p>
                  {concept.related_to && concept.related_to.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs opacity-60">{t.relatedTo}:</span>
                      {concept.related_to.map((rel, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-white/30 dark:bg-black/20">
                          {rel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'path' && (
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-4">
          <p className="text-sm text-text-secondary mb-4">
            {language === 'fr' 
              ? 'Suivez ce parcours pour une compréhension progressive du sujet :'
              : 'Follow this path for progressive understanding of the topic:'}
          </p>
          
          <div className="relative">
            {/* Line connecting steps */}
            <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gradient-to-b from-accent-primary via-purple-500 to-green-500" />
            
            <div className="space-y-4">
              {data.learning_path.map((step, index) => (
                <div key={index} className="flex items-start gap-4 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    index === 0 
                      ? 'bg-accent-primary text-white' 
                      : index === data.learning_path.length - 1
                        ? 'bg-green-500 text-white'
                        : 'bg-purple-500 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 pt-2">
                    <p className={`font-medium ${index === 0 ? 'text-accent-primary' : 'text-text-primary'}`}>
                      {step}
                    </p>
                    {index === 0 && (
                      <span className="text-xs text-accent-primary mt-1 inline-block">
                        ⬅️ {t.startHere}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptMap;
