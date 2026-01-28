/**
 * PaperCard Component
 * Displays an academic paper card with source badge, citation count,
 * expandable abstract, and action buttons.
 */

import React, { useState } from 'react';
import { FileText, ExternalLink, Copy, Check, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import type { AcademicPaper } from '../../services/api';

interface PaperCardProps {
  paper: AcademicPaper;
  onSelect?: (paper: AcademicPaper) => void;
  isSelected?: boolean;
  compact?: boolean;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  semantic_scholar: { bg: 'bg-blue-600', text: 'text-white' },
  openalex: { bg: 'bg-red-600', text: 'text-white' },
  arxiv: { bg: 'bg-rose-700', text: 'text-white' },
};

const SOURCE_NAMES: Record<string, string> = {
  semantic_scholar: 'Semantic Scholar',
  openalex: 'OpenAlex',
  arxiv: 'arXiv',
};

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  onSelect,
  isSelected = false,
  compact = false,
}) => {
  const [showAbstract, setShowAbstract] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatAuthors = (authors: Array<{ name: string }>) => {
    if (!authors?.length) return 'Unknown author';
    if (authors.length === 1) return authors[0].name;
    if (authors.length === 2) return `${authors[0].name} & ${authors[1].name}`;
    return `${authors[0].name} et al.`;
  };

  const formatCitations = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  const handleCopyCitation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const authors = formatAuthors(paper.authors);
    const year = paper.year || 'n.d.';
    const citation = `${authors} (${year}). ${paper.title}. ${paper.venue || ''}`.trim();

    await navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (paper.url) {
      window.open(paper.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (paper.pdf_url) {
      window.open(paper.pdf_url, '_blank', 'noopener,noreferrer');
    }
  };

  const sourceStyle = SOURCE_COLORS[paper.source] || { bg: 'bg-gray-600', text: 'text-white' };
  const sourceName = SOURCE_NAMES[paper.source] || paper.source;

  return (
    <div
      className={`card p-4 transition-all cursor-pointer hover:shadow-md ${
        isSelected ? 'ring-2 ring-accent-primary' : ''
      }`}
      onClick={() => onSelect?.(paper)}
    >
      {/* Header: Source badge and citations */}
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${sourceStyle.bg} ${sourceStyle.text}`}>
          {sourceName}
        </span>
        <div className="flex items-center gap-1 text-text-secondary text-xs">
          <FileText className="w-3 h-3" />
          <span>{formatCitations(paper.citation_count)} citations</span>
        </div>
      </div>

      {/* Title */}
      <h4
        className={`font-semibold text-text-primary leading-tight mb-1 ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}
      >
        {paper.title}
      </h4>

      {/* Authors and year */}
      <p className="text-text-secondary text-sm truncate mb-1">
        {formatAuthors(paper.authors)} {paper.year ? `(${paper.year})` : ''}
      </p>

      {/* Venue */}
      {paper.venue && !compact && (
        <p className="text-text-tertiary text-xs italic truncate mb-2">
          {paper.venue}
        </p>
      )}

      {/* Abstract (expandable) */}
      {paper.abstract && !compact && (
        <div className="mt-2">
          <p className={`text-text-secondary text-sm leading-relaxed ${showAbstract ? '' : 'line-clamp-2'}`}>
            {paper.abstract}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAbstract(!showAbstract);
            }}
            className="text-accent-primary text-xs font-medium mt-1 flex items-center gap-1 hover:underline"
          >
            {showAbstract ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show more <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          {paper.is_open_access && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
              Open Access
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {paper.pdf_url && (
            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-1 px-2 py-1 text-xs text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
              title="View PDF"
            >
              <BookOpen className="w-3.5 h-3.5" />
              PDF
            </button>
          )}

          <button
            onClick={handleCopyCitation}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Copy citation"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-accent-success" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Cite
          </button>

          {paper.url && (
            <button
              onClick={handleOpenUrl}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Open source"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {onSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(paper);
              }}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected
                  ? 'bg-accent-primary border-accent-primary text-white'
                  : 'border-border-default hover:border-accent-primary'
              }`}
            >
              {isSelected && <Check className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaperCard;
