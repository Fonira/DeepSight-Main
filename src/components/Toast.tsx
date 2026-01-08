import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: 'border-emerald-400/50 bg-gradient-to-br from-emerald-900/90 to-emerald-950/90',
    error: 'border-red-400/50 bg-gradient-to-br from-red-900/90 to-red-950/90',
    info: 'border-cyan-glow/50 bg-gradient-to-br from-teal-deep/90 to-abyss/90',
    warning: 'border-amber-400/50 bg-gradient-to-br from-amber-900/90 to-amber-950/90'
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  return createPortal(
    <div
      className="fixed top-6 right-6 z-[200] max-w-md"
      style={{
        animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div className={`
        glass-panel border-2 ${styles[type]} p-4 pr-12
        backdrop-blur-xl shadow-2xl rounded-lg
        relative overflow-hidden
      `}>
        <div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyan-glow to-gold-primary"
          style={{
            animation: `shrink ${duration}ms linear`
          }}
        />

        <div className="flex items-start gap-3">
          <span className="text-2xl">{icons[type]}</span>
          <p className="text-cream text-sm leading-relaxed flex-1">{message}</p>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-6 h-6 rounded text-cream/60 hover:text-cream hover:bg-white/10 transition-all duration-200"
        >
          ✕
        </button>
      </div>
    </div>,
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
