"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Sort field sent to the server; defaults to `key` when omitted. */
  sortField?: string;
  sortable?: boolean;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTableSort {
  field: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  sort?: DataTableSort;
  onSortChange?: (field: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Rendered above the table — search box, filter selects, toggles. */
  filterBar?: React.ReactNode;
}

/**
 * The shared list-page table: server-side paging and sorting (the caller
 * owns the actual query — this only renders what it's given and reports
 * clicks), a loading skeleton, an empty state that explains the page and
 * offers one action, and an error state with retry. Row height, header and
 * hover styling all come from the existing Table components (already
 * restyled to the design system in package 1.6) — this wraps them rather
 * than reimplementing table markup.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  isError = false,
  onRetry,
  sort,
  onSortChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  page,
  pageSize,
  total,
  onPageChange,
  filterBar,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <div className="space-y-4">
      {filterBar}

      <div className="overflow-hidden rounded-lg border border-line">
        <Table>
          <TableHeader className="sticky top-0 z-(--z-sticky)">
            <TableRow>
              {columns.map((column) => {
                const sortField = column.sortField ?? column.key;
                const isSorted = sort?.field === sortField;
                return (
                  <TableHead
                    key={column.key}
                    className={cn(column.align === "right" && "text-right", column.className)}
                    aria-sort={isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(sortField)}
                        className={cn(
                          "inline-flex items-center gap-1 text-[13px] leading-[18px] font-medium text-ink-muted hover:text-ink",
                          column.align === "right" && "flex-row-reverse"
                        )}
                      >
                        {column.header}
                        {isSorted ? (
                          sort.direction === "asc" ? (
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.align === "right" ? "text-right" : undefined}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <p className="body text-ink-muted">Could not load this list. Try again.</p>
                    {onRetry && (
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Try again
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {showEmpty && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div>
                      <p className="body-strong">{emptyTitle}</p>
                      <p className="body text-ink-muted">{emptyDescription}</p>
                    </div>
                    {emptyAction}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.align === "right" ? "text-right" : undefined}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {!isLoading && !isError && total > 0 && (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
