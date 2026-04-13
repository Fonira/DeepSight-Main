/**
 * 📸 CAROUSEL GALLERY v1.0 — TikTok carousel image viewer
 * ═══════════════════════════════════════════════════════════════════════════════
 * Grid gallery with lightbox modal for TikTok carousel (photo mode) posts.
 * Dark mode glassmorphism style, Framer Motion animations.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface CarouselGalleryProps {
  images: string[];
  title?: string;
}

export const CarouselGallery: React.FC<CarouselGalleryProps> = ({
  images,
  title,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, closeLightbox, goNext, goPrev]);

  if (!images || images.length === 0) return null;

  return (
    <div className="w-full">
      {/* Header badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70">
          <span>📸</span>
          <span>Photo Mode</span>
          <span className="text-white/40">({images.length})</span>
        </span>
        {title && (
          <span className="text-sm text-white/50 truncate">{title}</span>
        )}
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {images.map((src, index) => (
          <button
            key={index}
            onClick={() => openLightbox(index)}
            className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-[#12121a] hover:border-white/20 transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label={`Ouvrir image ${index + 1} sur ${images.length}`}
          >
            <img
              src={src}
              alt={
                title ? `${title} — image ${index + 1}` : `Image ${index + 1}`
              }
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs bg-black/50 backdrop-blur-sm rounded-md px-2 py-1">
                {index + 1}/{images.length}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={closeLightbox}
            />

            {/* Content */}
            <div className="relative z-10 flex items-center justify-center w-full h-full p-4 md:p-8">
              {/* Close button */}
              <button
                onClick={closeLightbox}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 border border-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors z-20"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Previous arrow */}
              {images.length > 1 && (
                <button
                  onClick={goPrev}
                  className="absolute left-4 md:left-8 p-2 rounded-full bg-white/10 border border-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors z-20"
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Image */}
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentIndex}
                  src={images[currentIndex]}
                  alt={
                    title
                      ? `${title} — image ${currentIndex + 1}`
                      : `Image ${currentIndex + 1}`
                  }
                  className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              {/* Next arrow */}
              {images.length > 1 && (
                <button
                  onClick={goNext}
                  className="absolute right-4 md:right-8 p-2 rounded-full bg-white/10 border border-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors z-20"
                  aria-label="Image suivante"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              {/* Slide indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
                <span className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/80">
                  {currentIndex + 1} / {images.length}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CarouselGallery;
