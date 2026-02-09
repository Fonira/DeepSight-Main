/**
 * DEEP SIGHT v8.0 — Premium Toast Notifications
 * Slide-in from corner, progress bar, auto-dismiss, Framer Motion
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

const toastConfig = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    progress: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    border: 'border-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    progress: 'bg-red-500',
  },
  info: {
    icon: Info,
    border: 'border-accent-primary/30',
    bg: 'bg-accent-primary-muted',
    text: 'text-accent-primary-hover',
    progress: 'bg-accent-primary',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    progress: 'bg-amber-500',
  },
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 4000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed top-4 right-4 z-[400] max-w-sm w-full pointer-events-auto"
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 30, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={`
            relative overflow-hidden rounded-lg border ${config.border}
            bg-bg-elevated backdrop-blur-xl shadow-lg
          `}>
            <div className="flex items-start gap-3 p-3.5 pr-10">
              <div className={`flex-shrink-0 p-1 rounded-md ${config.bg}`}>
                <Icon className={`w-4 h-4 ${config.text}`} />
              </div>
              <p className="text-sm text-text-primary leading-relaxed flex-1">{message}</p>
            </div>

            {/* Close button */}
            <button
              onClick={() => { setIsVisible(false); setTimeout(onClose, 150); }}
              className="absolute top-3 right-3 w-6 h-6 rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-all flex items-center justify-center"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Progress bar */}
            <div className="h-0.5 bg-border-subtle">
              <motion.div
                className={`h-full ${config.progress}`}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: duration / 1000, ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export const useToast = () => {
  const [toast, setToast] = React.useState<{ message: string; type: ToastProps['type'] } | null>(null);

  const showToast = (message: string, type: ToastProps['type'] = 'info') => {
    setToast({ message, type });
  };

  const ToastComponent = toast ? (
    <Toast {...toast} onClose={() => setToast(null)} />
  ) : null;

  return { showToast, ToastComponent };
};
