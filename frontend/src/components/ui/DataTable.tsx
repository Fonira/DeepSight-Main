/**
 * DEEP SIGHT v9.0 — Premium DataTable
 * Sticky header, row hover, animated pagination, empty state.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T, index: number) => void;
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  pageSize = 10,
  emptyIcon,
  emptyTitle = 'No data',
  emptyDescription = 'There are no items to display.',
  onRowClick,
  rowKey,
  loading,
  className = '',
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = useMemo(
    () => data.slice(page * pageSize, (page + 1) * pageSize),
    [data, page, pageSize]
  );

  // Reset page if data shrinks
  React.useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(totalPages - 1);
  }, [totalPages, page]);

  const alignClass = (a?: string) =>
    a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';

  // Empty state
  if (!loading && data.length === 0) {
    return (
      <div className={`rounded-lg border border-border-subtle bg-bg-secondary p-12 text-center ${className}`}>
        <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
          {emptyIcon || <Inbox className="w-8 h-8 text-text-muted" />}
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-1">{emptyTitle}</h3>
        <p className="text-sm text-text-tertiary max-w-sm mx-auto">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border-subtle bg-bg-secondary overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Sticky Header */}
          <thead>
            <tr className="border-b border-border-subtle bg-bg-tertiary/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-3 font-medium text-text-tertiary text-xs uppercase tracking-wider
                    sticky top-0 bg-bg-tertiary/95 backdrop-blur-sm
                    ${alignClass(col.align)}
                  `}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            <AnimatePresence mode="popLayout">
              {pageData.map((row, idx) => (
                <motion.tr
                  key={rowKey(row, page * pageSize + idx)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: idx * 0.02 }}
                  onClick={() => onRowClick?.(row, page * pageSize + idx)}
                  className={`
                    border-b border-border-subtle last:border-b-0
                    transition-colors duration-100
                    ${onRowClick ? 'cursor-pointer hover:bg-bg-hover' : ''}
                  `}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${alignClass(col.align)}`}
                    >
                      {col.render(row, page * pageSize + idx)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-bg-tertiary/30">
          <span className="text-xs text-text-tertiary tabular-nums">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}
          </span>

          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => setPage(0)}
              disabled={page === 0}
              aria-label="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </PaginationButton>
            <PaginationButton
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </PaginationButton>

            <span className="px-2 text-xs font-medium text-text-secondary tabular-nums">
              {page + 1} / {totalPages}
            </span>

            <PaginationButton
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </PaginationButton>
            <PaginationButton
              onClick={() => setPage(totalPages - 1)}
              disabled={page === totalPages - 1}
              aria-label="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </PaginationButton>
          </div>
        </div>
      )}
    </div>
  );
}

const PaginationButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <button
    className={`
      w-7 h-7 rounded-md flex items-center justify-center
      text-text-tertiary hover:text-text-primary hover:bg-bg-hover
      disabled:opacity-30 disabled:pointer-events-none
      transition-colors duration-100
      ${className}
    `}
    {...props}
  >
    {children}
  </button>
);
