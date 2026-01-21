import React, { useEffect, useRef, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Description pour les lecteurs d'écran */
  ariaDescription?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  title,
  ariaDescription 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Sauvegarder l'élément actif et restaurer au close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      
      // Focus le modal après ouverture
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
    } else {
      document.body.style.overflow = 'unset';
      
      // Restaurer le focus
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
    return () => { 
      document.body.style.overflow = 'unset'; 
    };
  }, [isOpen]);

  // Gestion du clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop - click pour fermer */}
      <div
        className="absolute inset-0 bg-abyss/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
        style={{
          animation: 'fadeIn 0.3s ease-out'
        }}
      />

      {/* Dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={ariaDescription ? descId : undefined}
        tabIndex={-1}
        className="relative z-10 glass-panel-dark max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-gold-primary/30">
            <h2 id={titleId} className="text-2xl font-title brass-text">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg border-2 border-gold-primary/30 text-cream hover:border-gold-primary hover:bg-gold-primary/10 transition-all duration-300 hover:rotate-90 focus:outline-none focus:ring-2 focus:ring-gold-primary"
              aria-label="Fermer la fenêtre"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}

        {/* Description cachée pour les lecteurs d'écran */}
        {ariaDescription && (
          <p id={descId} className="sr-only">
            {ariaDescription}
          </p>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
