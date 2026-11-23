"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

const PAGE_SIZE_ITEMS: Record<string, string> = {
  "5": "5 / page",
  "10": "10 / page",
  "20": "20 / page",
  "50": "50 / page",
};

export interface PaginationResult<T> {
  pageItems: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): Omit<PaginationResult<T>, "setPage" | "setPageSize"> {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  const end = Math.min(start + safePageSize, totalItems);

  return {
    pageItems: items.slice(start, end),
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex: totalItems === 0 ? 0 : start + 1,
    endIndex: end,
  };
}

export function usePagination<T>(
  items: readonly T[],
  defaultPageSize = 10
): PaginationResult<T> {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const computed = useMemo(
    () => paginateItems(items, page, pageSize),
    [items, page, pageSize]
  );

  const setPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), computed.totalPages);
    setPageState(clamped);
  };

  const setPageSize = (nextSize: number) => {
    setPageSizeState(nextSize);
    setPageState(1);
  };

  return {
    ...computed,
    setPage,
    setPageSize,
  };
}

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  itemLabel = "entries",
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">
          {startIndex}–{endIndex}
        </span>{" "}
        of <span className="font-medium text-foreground">{totalItems}</span>{" "}
        {itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rows</span>
          <Select
            value={String(pageSize)}
            items={PAGE_SIZE_ITEMS}
            onValueChange={(value) => {
              if (value) onPageSizeChange(Number(value));
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label="Rows per page"
              className="w-[104px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            aria-label="First page"
            className="rounded-lg"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="rounded-lg"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="min-w-[82px] text-center text-xs font-medium text-muted-foreground">
            Page <span className="text-foreground">{page}</span> / {totalPages}
          </span>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="rounded-lg"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            aria-label="Last page"
            className="rounded-lg"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
