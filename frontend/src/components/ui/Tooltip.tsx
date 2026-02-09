/**
 * DEEP SIGHT v9.0 — Premium Tooltip
 * Animated tooltip with arrow, multiple positions, Framer Motion.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  delay = 300,
  className = '',
  disabled = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;

    switch (side) {
      case 'top':
        setPos({ x: rect.left + rect.width / 2, y: rect.top - gap });
        break;
      case 'bottom':
        setPos({ x: rect.left + rect.width / 2, y: rect.bottom + gap });
        break;
      case 'left':
        setPos({ x: rect.left - gap, y: rect.top + rect.height / 2 });
        break;
      case 'right':
        setPos({ x: rect.right + gap, y: rect.top + rect.height / 2 });
        break;
    }
  }, [visible, side]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const motionOrigin = {
    top: { initial: { opacity: 0, y: 4 }, anchor: 'translateX(-50%) translateY(-100%)' },
    bottom: { initial: { opacity: 0, y: -4 }, anchor: 'translateX(-50%)' },
    left: { initial: { opacity: 0, x: 4 }, anchor: 'translateX(-100%) translateY(-50%)' },
    right: { initial: { opacity: 0, x: -4 }, anchor: 'translateY(-50%)' },
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </div>

      {createPortal(
        <AnimatePresence>
          {visible && content && (
            <motion.div
              role="tooltip"
              className={`
                fixed z-[500] pointer-events-none
                px-2.5 py-1.5 rounded-md
                bg-bg-elevated border border-border-default
                shadow-lg text-xs font-medium text-text-primary
                max-w-xs
                ${className}
              `}
              style={{
                left: pos.x,
                top: pos.y,
                transform: motionOrigin[side].anchor,
              }}
              initial={{ ...motionOrigin[side].initial, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
