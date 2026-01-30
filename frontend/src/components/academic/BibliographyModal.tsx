/**
 * BibliographyModal Component
 * Modal for exporting selected papers in various bibliography formats.
 */

import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { DeepSightSpinner } from '../ui';
import { academicApi, BibliographyFormat } from '../../services/api';
import { hasFeature, normalizePlanId } from '../../config/planPrivileges';

interface BibliographyModalProps {
  isOpen: boolean;
  onClose: () => void;
  paperIds: string[];
  summaryId?: string;
  userPlan?: string;
  onUpgrade?: () => void;
}

const FORMATS: Array<{
  id: BibliographyFormat;
  name: string;
  extension: string;
  description: string;
}> = [
  { id: 'bibtex', name: 'BibTeX', extension: '.bib', description: 'LaTeX & academic writing' },
  { id: 'ris', name: 'RIS', extension: '.ris', description: 'EndNote, Zotero, Mendeley' },
  { id: 'apa', name: 'APA 7th', extension: '.txt', description: 'American Psychological Association' },
  { id: 'mla', name: 'MLA 9th', extension: '.txt', description: 'Modern Language Association' },
  { id: 'chicago', name: 'Chicago', extension: '.txt', description: 'Chicago Manual of Style' },
  { id: 'harvard', name: 'Harvard', extension: '.txt', description: 'Harvard referencing' },
];

export const BibliographyModal: React.FC<BibliographyModalProps> = ({
  isOpen,
  onClose,
  paperIds,
  summaryId,
  userPlan = 'free',
  onUpgrade,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<BibliographyFormat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedContent, setExportedContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const plan = normalizePlanId(userPlan);
  const canExport = hasFeature(plan, 'bibliographyExport');

  if (!isOpen) return null;

  const handleExport = async (format: BibliographyFormat) => {
    if (!canExport) {
      return;
    }

    setSelectedFormat(format);
    setLoading(true);
    setError(null);
    setExportedContent(null);

    try {
      const response = await academicApi.exportBibliography({
        paper_ids: paperIds,
        format,
        summary_id: summaryId,
      });

      setExportedContent(response.content);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (exportedContent) {
      await navigator.clipboard.writeText(exportedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!exportedContent || !selectedFormat) return;

    const formatInfo = FORMATS.find(f => f.id === selectedFormat);
    const extension = formatInfo?.extension || '.txt';
    const filename = `bibliography${extension}`;

    const blob = new Blob([exportedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    setSelectedFormat(null);
    setExportedContent(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-elevated border border-border-default rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            {selectedFormat && !loading && (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-bg-hover rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-text-primary">
              Export Bibliography
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!canExport ? (
            /* Upgrade prompt for free users */
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-warning" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Premium Feature
              </h3>
              <p className="text-text-secondary text-sm mb-6 max-w-xs mx-auto">
                Bibliography export requires a Student subscription or higher.
              </p>
              <button
                onClick={onUpgrade}
                className="btn btn-primary"
              >
                Upgrade Now
              </button>
            </div>
          ) : !selectedFormat ? (
            /* Format selection */
            <div className="space-y-4">
              <p className="text-text-secondary text-sm">
                Select a format to export {paperIds.length} paper{paperIds.length > 1 ? 's' : ''}:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {FORMATS.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleExport(format.id)}
                    className="p-4 rounded-lg border border-border-default hover:border-accent-primary hover:bg-accent-primary/5 text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-accent-primary" />
                      <span className="font-medium text-text-primary">{format.name}</span>
                    </div>
                    <p className="text-xs text-text-tertiary">{format.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : loading ? (
            /* Loading */
            <div className="flex flex-col items-center justify-center py-12">
              <DeepSightSpinner size="md" label="Generating bibliography..." showLabel />
            </div>
          ) : error ? (
            /* Error */
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-error" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Export Failed
              </h3>
              <p className="text-text-secondary text-sm mb-6">
                {error}
              </p>
              <button
                onClick={() => handleExport(selectedFormat)}
                className="btn btn-secondary"
              >
                Try Again
              </button>
            </div>
          ) : exportedContent ? (
            /* Export result */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-text-secondary text-sm">
                  {FORMATS.find(f => f.id === selectedFormat)?.name} format ready
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="btn btn-ghost text-xs"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-accent-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="btn btn-primary text-xs"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
              <pre className="bg-bg-tertiary rounded-lg p-4 text-xs text-text-secondary font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                {exportedContent}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BibliographyModal;
