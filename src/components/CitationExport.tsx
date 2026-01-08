/**
 * DEEP SIGHT — Citation Export Component
 * Génération de citations académiques pour vidéos YouTube
 * 
 * FORMATS SUPPORTÉS:
 * - APA 7th Edition
 * - MLA 9th Edition  
 * - Chicago 17th Edition
 * - BibTeX (pour LaTeX)
 * - Harvard
 * - IEEE
 */

import React, { useState, useMemo } from 'react';
import { 
  X, Copy, Check, GraduationCap, BookOpen, 
  FileCode, Quote, ChevronDown, Download,
  ExternalLink
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VideoInfo {
  title: string;
  channel: string;
  videoId: string;
  publishedDate?: string; // ISO date string
  duration?: number; // seconds
  url?: string;
}

interface CitationExportProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoInfo;
  language?: 'fr' | 'en';
}

type CitationFormat = 'iso690' | 'french' | 'apa' | 'mla' | 'chicago' | 'bibtex';

interface FormatConfig {
  id: CitationFormat;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION DES FORMATS
// ═══════════════════════════════════════════════════════════════════════════════

const CITATION_FORMATS: FormatConfig[] = [
  { 
    id: 'iso690', 
    name: 'ISO 690', 
    description: 'Norme internationale (Europe)',
    icon: <GraduationCap className="w-4 h-4" />,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  },
  { 
    id: 'french', 
    name: 'Français', 
    description: 'Style universitaire français',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
  },
  { 
    id: 'apa', 
    name: 'APA 7', 
    description: 'American Psychological Association',
    icon: <GraduationCap className="w-4 h-4" />,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  },
  { 
    id: 'chicago', 
    name: 'Chicago', 
    description: 'Chicago Manual of Style',
    icon: <Quote className="w-4 h-4" />,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  },
  { 
    id: 'mla', 
    name: 'MLA 9', 
    description: 'Modern Language Association',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  },
  { 
    id: 'bibtex', 
    name: 'BibTeX', 
    description: 'Pour LaTeX et bibliographies',
    icon: <FileCode className="w-4 h-4" />,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 GÉNÉRATEURS DE CITATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDate = (isoDate?: string, locale: string = 'fr'): { 
  year: string; 
  month: string; 
  monthNum: string;
  day: string; 
  full: string;
  fullFr: string;
  iso: string;
} => {
  const date = isoDate ? new Date(isoDate) : new Date();
  const localeCode = locale === 'fr' ? 'fr-FR' : 'en-US';
  
  return {
    year: date.getFullYear().toString(),
    month: date.toLocaleDateString('en-US', { month: 'long' }),
    monthNum: (date.getMonth() + 1).toString().padStart(2, '0'),
    day: date.getDate().toString(),
    full: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    fullFr: date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
    iso: date.toISOString().split('T')[0]
  };
};

const getAccessDate = (locale: string = 'fr'): string => {
  const date = new Date();
  if (locale === 'fr') {
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const sanitizeForBibtex = (str: string): string => {
  return str
    .replace(/[{}]/g, '')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#');
};

const generateBibtexKey = (channel: string, year: string, title: string): string => {
  const authorPart = channel
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const titleWord = title
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return `${authorPart}${year}${titleWord}`;
};

const generateCitation = (video: VideoInfo, format: CitationFormat, lang: string = 'fr'): string => {
  const { title, channel, videoId } = video;
  const url = video.url || `https://www.youtube.com/watch?v=${videoId}`;
  const date = formatDate(video.publishedDate, lang);
  const accessDateFr = getAccessDate('fr');
  const accessDateEn = getAccessDate('en');

  switch (format) {
    case 'iso690':
      // Norme ISO 690 (standard européen) - Format pour ressources électroniques
      // NOM, Prénom. Titre [en ligne]. Lieu : Éditeur, Date. Disponible sur : URL (consulté le DATE)
      return `${channel.toUpperCase()}. ${title} [en ligne]. YouTube, ${date.fullFr}. Disponible sur : ${url} [consulté le ${accessDateFr}]`;

    case 'french':
      // Style français universitaire simplifié
      // NOM Prénom, « Titre », Site, date de publication, URL, consulté le DATE.
      return `${channel}, « ${title} », YouTube, ${date.fullFr}, ${url}, consulté le ${accessDateFr}.`;

    case 'apa':
      // APA 7th Edition format for online videos
      return `${channel}. (${date.year}, ${date.month} ${date.day}). ${title} [Video]. YouTube. ${url}`;

    case 'mla':
      // MLA 9th Edition format
      return `${channel}. "${title}." YouTube, ${date.day} ${date.month} ${date.year}, ${url}. Accessed ${accessDateEn}.`;

    case 'chicago':
      // Chicago 17th Edition (Notes-Bibliography)
      return `${channel}, "${title}," YouTube video, ${date.month} ${date.day}, ${date.year}, ${url}.`;

    case 'bibtex':
      // BibTeX format for LaTeX
      const bibtexKey = generateBibtexKey(channel, date.year, title);
      return `@online{${bibtexKey},
  author    = {${sanitizeForBibtex(channel)}},
  title     = {${sanitizeForBibtex(title)}},
  year      = {${date.year}},
  month     = {${date.month.toLowerCase().substring(0, 3)}},
  url       = {${url}},
  urldate   = {${date.iso}},
  note      = {Vidéo YouTube}
}`;

    default:
      return '';
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const CitationExport: React.FC<CitationExportProps> = ({
  isOpen,
  onClose,
  video,
  language = 'fr'
}) => {
  const [selectedFormat, setSelectedFormat] = useState<CitationFormat>('iso690');
  const [copiedFormat, setCopiedFormat] = useState<CitationFormat | null>(null);
  const [showAllFormats, setShowAllFormats] = useState(false);

  // Générer la citation pour le format sélectionné
  const citation = useMemo(() => {
    return generateCitation(video, selectedFormat, language);
  }, [video, selectedFormat, language]);

  // Générer toutes les citations
  const allCitations = useMemo(() => {
    return CITATION_FORMATS.map(format => ({
      ...format,
      citation: generateCitation(video, format.id, language)
    }));
  }, [video, language]);

  // Copier une citation
  const handleCopy = async (format: CitationFormat, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Télécharger en fichier .bib
  const handleDownloadBibtex = () => {
    const bibtexCitation = generateCitation(video, 'bibtex', language);
    const blob = new Blob([bibtexCitation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.videoId}_citation.bib`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const texts = {
    fr: {
      title: 'Citer cette vidéo',
      subtitle: 'Générez une citation académique conforme',
      selectFormat: 'Format de citation',
      copyToClipboard: 'Copier',
      copied: 'Copié !',
      downloadBib: 'Télécharger .bib',
      showAll: 'Afficher tous les formats',
      hideAll: 'Réduire',
      tip: 'Astuce : ISO 690 et le style Français sont les normes recommandées en France et en Europe.',
      videoInfo: 'Informations de la vidéo',
      channel: 'Chaîne',
      accessDate: 'Date d\'accès',
      generatedBy: 'Citation générée par Deep Sight',
      popularInFrance: 'Recommandé en France',
    },
    en: {
      title: 'Cite this video',
      subtitle: 'Generate an academic citation',
      selectFormat: 'Citation format',
      copyToClipboard: 'Copy',
      copied: 'Copied!',
      downloadBib: 'Download .bib',
      showAll: 'Show all formats',
      hideAll: 'Collapse',
      tip: 'Tip: APA and MLA are the most common formats in academia.',
      videoInfo: 'Video information',
      channel: 'Channel',
      accessDate: 'Access date',
      generatedBy: 'Citation generated by Deep Sight',
      popularInFrance: 'Popular in France',
    }
  };

  const t = texts[language];
  const currentFormat = CITATION_FORMATS.find(f => f.id === selectedFormat)!;

  // Formats recommandés en France/Europe (à afficher en premier avec badge)
  const europeanFormats = ['iso690', 'french'];
  // L'ordre est déjà correct dans CITATION_FORMATS (ISO 690 et Français en premier)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-bg-primary border border-border-default rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold">{t.title}</h2>
                <p className="text-blue-100 text-sm">{t.subtitle}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Video info mini */}
          <div className="mt-4 p-3 bg-white/10 backdrop-blur rounded-lg">
            <p className="text-sm font-medium line-clamp-1">{video.title}</p>
            <p className="text-xs text-blue-200 mt-1">
              {t.channel}: {video.channel}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Format selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-secondary mb-3">
              {t.selectFormat}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CITATION_FORMATS.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                    selectedFormat === format.id
                      ? 'border-accent-primary bg-accent-primary-muted'
                      : 'border-border-subtle hover:border-border-default bg-bg-secondary'
                  }`}
                >
                  {/* Badge "Recommandé en France/Europe" pour ISO 690 et Français */}
                  {europeanFormats.includes(format.id) && language === 'fr' && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center" title={t.popularInFrance}>
                      <span className="text-[8px] text-white font-bold">EU</span>
                    </span>
                  )}
                  <div className={`w-8 h-8 mx-auto rounded-lg ${format.color} flex items-center justify-center mb-1`}>
                    {format.icon}
                  </div>
                  <span className="text-xs font-medium text-text-primary block">{format.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Citation preview */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${currentFormat.color}`}>
                {currentFormat.icon}
                {currentFormat.name}
                <span className="text-xs opacity-70">— {currentFormat.description}</span>
              </span>
            </div>
            
            <div className="relative">
              <div className="p-4 bg-bg-secondary border border-border-subtle rounded-xl font-mono text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-all">
                {citation}
              </div>
              
              {/* Copy button overlay */}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => handleCopy(selectedFormat, citation)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    copiedFormat === selectedFormat
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-bg-primary text-text-secondary hover:text-text-primary border border-border-subtle hover:border-accent-primary'
                  }`}
                >
                  {copiedFormat === selectedFormat ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {t.copied}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      {t.copyToClipboard}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* BibTeX download button */}
          {selectedFormat === 'bibtex' && (
            <button
              onClick={handleDownloadBibtex}
              className="w-full mb-4 btn btn-secondary justify-center"
            >
              <Download className="w-4 h-4" />
              {t.downloadBib}
            </button>
          )}

          {/* Tip */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <span className="text-base">💡</span>
              {t.tip}
            </p>
          </div>

          {/* Show all formats toggle */}
          <button
            onClick={() => setShowAllFormats(!showAllFormats)}
            className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAllFormats ? 'rotate-180' : ''}`} />
            {showAllFormats ? t.hideAll : t.showAll}
          </button>

          {/* All formats expanded */}
          {showAllFormats && (
            <div className="mt-4 space-y-3 animate-fade-in">
              {allCitations.map((format) => (
                <div 
                  key={format.id}
                  className="p-4 bg-bg-secondary border border-border-subtle rounded-xl"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium ${format.color}`}>
                      {format.icon}
                      {format.name}
                    </span>
                    <button
                      onClick={() => handleCopy(format.id, format.citation)}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-all ${
                        copiedFormat === format.id
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
                      }`}
                    >
                      {copiedFormat === format.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-text-secondary leading-relaxed whitespace-pre-wrap break-all">
                    {format.citation}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-bg-secondary border-t border-border-subtle flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {t.generatedBy} • {t.accessDate}: {getAccessDate()}
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            YouTube
          </a>
        </div>
      </div>
    </div>
  );
};

export default CitationExport;