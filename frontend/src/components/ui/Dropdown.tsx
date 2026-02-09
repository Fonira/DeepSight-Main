/**
 * DEEP SIGHT v9.0 — Premium Dropdown Menu
 * Animated menu with keyboard navigation, click-outside, Framer Motion.
 */

import React, { useRef, useState, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  selectedId?: string;
  align?: 'left' | 'right';
  width?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  onSelect,
  selectedId,
  align = 'left',
  width = 'w-56',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
          setFocusIndex(0);
        }
        return;
      }

      const selectableItems = items.filter((i) => !i.divider && !i.disabled);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusIndex((i) => (i + 1) % selectableItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIndex((i) => (i - 1 + selectableItems.length) % selectableItems.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusIndex >= 0) {
            const item = selectableItems[focusIndex];
            if (item) {
              onSelect(item.id);
              setIsOpen(false);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, items, focusIndex, onSelect]
  );

  // Position state
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: align === 'right' ? rect.right : rect.left,
    });
  }, [isOpen, align]);

  return (
    <div className="relative inline-flex" onKeyDown={handleKeyDown}>
      <div
        ref={triggerRef}
        onClick={() => {
          setIsOpen(!isOpen);
          setFocusIndex(-1);
        }}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        tabIndex={0}
      >
        {trigger}
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="listbox"
              className={`
                fixed z-[200] ${width}
                bg-bg-elevated border border-border-default
                rounded-lg shadow-xl overflow-hidden
                py-1
              `}
              style={{
                top: pos.top,
                ...(align === 'right'
                  ? { right: window.innerWidth - pos.left }
                  : { left: pos.left }),
              }}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              {items.map((item, idx) => {
                if (item.divider) {
                  return <div key={`div-${idx}`} className="h-px bg-border-subtle my-1 mx-2" />;
                }

                const isSelected = item.id === selectedId;
                const isFocused = idx === focusIndex;

                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    disabled={item.disabled}
                    onClick={() => {
                      onSelect(item.id);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full text-left px-3 py-2 text-sm flex items-center gap-2.5
                      transition-colors duration-100
                      ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      ${item.danger ? 'text-error hover:bg-error-muted' : ''}
                      ${isFocused ? 'bg-bg-hover' : ''}
                      ${!item.danger && !item.disabled ? 'text-text-secondary hover:text-text-primary hover:bg-bg-hover' : ''}
                      ${isSelected ? 'text-accent-primary-hover' : ''}
                    `}
                  >
                    {item.icon && (
                      <span className="flex-shrink-0 w-4 h-4" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-text-muted truncate mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-accent-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
