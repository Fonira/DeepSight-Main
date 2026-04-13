/**
 * ShareButton — Button that opens a share modal with link, social buttons, and toggle.
 */

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Copy, Check, X, Mail, Eye } from "lucide-react";
import { DeepSightSpinner } from "../ui/DeepSightSpinner";
import { useToast } from "../Toast";
import { shareApi } from "../../services/api";

interface ShareButtonProps {
  videoId: string;
  videoTitle: string;
}

// Simple SVG icons for social platforms (avoid external deps)
const TwitterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export const ShareButton: React.FC<ShareButtonProps> = ({
  videoId,
  videoTitle,
}) => {
  const { showToast, ToastComponent } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [viewCount, setViewCount] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [copied, setCopied] = useState(false);

  const openModal = useCallback(async () => {
    setIsOpen(true);

    if (shareUrl) return; // Already loaded

    setIsLoading(true);
    try {
      const result = await shareApi.createShareLink(videoId);
      setShareUrl(result.share_url);
      setViewCount((result as { view_count?: number }).view_count || 0);
      setIsActive(true);
    } catch (err) {
      showToast("Erreur lors de la création du lien de partage", "error");
    } finally {
      setIsLoading(false);
    }
  }, [videoId, shareUrl, showToast]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Impossible de copier le lien", "error");
    }
  }, [shareUrl, showToast]);

  const handleToggleActive = useCallback(async () => {
    if (isActive) {
      // Deactivate
      try {
        await shareApi.deleteShare(videoId);
        setIsActive(false);
        setShareUrl("");
        showToast("Partage désactivé", "success");
      } catch {
        showToast("Erreur lors de la désactivation", "error");
      }
    } else {
      // Re-activate by creating new share
      setIsLoading(true);
      try {
        const result = await shareApi.createShareLink(videoId);
        setShareUrl(result.share_url);
        setIsActive(true);
        showToast("Partage réactivé", "success");
      } catch {
        showToast("Erreur lors de la réactivation", "error");
      } finally {
        setIsLoading(false);
      }
    }
  }, [isActive, videoId, showToast]);

  // Social share URLs
  const encodedUrl = encodeURIComponent(shareUrl);

  const socialLinks = [
    {
      name: "Email",
      icon: <Mail className="w-5 h-5" />,
      href: `mailto:?subject=${encodeURIComponent(`Analyse DeepSight : ${videoTitle}`)}&body=${encodeURIComponent(`Découvre cette analyse de la vidéo "${videoTitle}" :\n\n${shareUrl}\n\nGénéré par DeepSight — deepsightsynthesis.com`)}`,
      bg: "bg-gray-600 hover:bg-gray-700",
    },
    {
      name: "X",
      icon: <TwitterIcon className="w-5 h-5" />,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Découvrez cette analyse de "${videoTitle}"`)}&url=${encodedUrl}`,
      bg: "bg-black hover:bg-gray-800",
    },
    {
      name: "LinkedIn",
      icon: <LinkedInIcon className="w-5 h-5" />,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      bg: "bg-[#0A66C2] hover:bg-[#084d94]",
    },
    {
      name: "WhatsApp",
      icon: <WhatsAppIcon className="w-5 h-5" />,
      href: `https://wa.me/?text=${encodeURIComponent(`Regarde cette analyse DeepSight : ${videoTitle} ${shareUrl}`)}`,
      bg: "bg-[#25D366] hover:bg-[#1fb855]",
    },
  ];

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors duration-150"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Partager</span>
      </button>

      {/* Modal */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />

              {/* Dialog */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="fixed inset-0 z-[201] flex items-center justify-center p-4"
                onClick={(e) =>
                  e.target === e.currentTarget && setIsOpen(false)
                }
              >
                <div className="bg-bg-elevated rounded-xl border border-border-default shadow-2xl w-full max-w-md overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">
                        Partager cette analyse
                      </h3>
                      <p className="text-sm text-text-muted truncate max-w-xs mt-0.5">
                        {videoTitle}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-bg-hover"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <DeepSightSpinner size="md" />
                      </div>
                    ) : isActive && shareUrl ? (
                      <>
                        {/* Link copy */}
                        <div className="flex gap-2">
                          <input
                            readOnly
                            value={shareUrl}
                            className="flex-1 px-3 py-2 text-sm bg-bg-surface border border-border-default rounded-lg text-text-secondary truncate"
                          />
                          <button
                            onClick={handleCopy}
                            className={`
                              flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                              ${
                                copied
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-accent-primary text-white hover:bg-accent-primary-hover"
                              }
                            `}
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4" />
                                Copié
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copier
                              </>
                            )}
                          </button>
                        </div>

                        {/* View count */}
                        {viewCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Eye className="w-3.5 h-3.5" />
                            {viewCount} {viewCount === 1 ? "vue" : "vues"}
                          </div>
                        )}

                        {/* Separator */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-border-subtle" />
                          <span className="text-xs text-text-muted">
                            ou partager via
                          </span>
                          <div className="flex-1 h-px bg-border-subtle" />
                        </div>

                        {/* Social buttons */}
                        <div className="flex justify-center gap-3">
                          {socialLinks.map((social) => (
                            <a
                              key={social.name}
                              href={social.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`
                                flex items-center justify-center w-10 h-10 rounded-full text-white
                                transition-transform hover:scale-110
                                ${social.bg}
                              `}
                              title={social.name}
                            >
                              {social.icon}
                            </a>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-sm text-text-muted py-4">
                        Le partage est désactivé pour cette analyse.
                      </p>
                    )}

                    {/* Toggle active */}
                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-sm text-text-secondary">
                        Lien actif
                      </span>
                      <button
                        onClick={handleToggleActive}
                        className={`
                          relative w-10 h-5 rounded-full transition-colors duration-200
                          ${isActive ? "bg-accent-primary" : "bg-border-default"}
                        `}
                        disabled={isLoading}
                      >
                        <span
                          className={`
                            absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                            ${isActive ? "translate-x-5" : "translate-x-0.5"}
                          `}
                        />
                      </button>
                    </div>

                    {/* Info text */}
                    <p className="text-xs text-text-muted">
                      Toute personne disposant de ce lien pourra consulter
                      l'analyse.
                    </p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {ToastComponent}
    </>
  );
};
