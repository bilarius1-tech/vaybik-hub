import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  className?: string;
  /** Если задано — заголовок кликабелен для сортировки */
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  className?: string;
  sortKey?: string | null;
  sortDir?: "asc" | "desc" | null;
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  selectedIds?: Set<string>;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  className,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  selectedIds,
}: Props<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sortKey === col.key;
              const arrow =
                active && sortDir === "asc"
                  ? " ↑"
                  : active && sortDir === "desc"
                    ? " ↓"
                    : col.sortable
                      ? " ↕"
                      : "";
              return (
                <th
                  key={col.key}
                  className={cn(
                    "border-b-2 border-bd2 px-2 py-2.5 text-left font-bold text-mu",
                    col.className,
                    col.sortable && "cursor-pointer select-none hover:text-tx",
                  )}
                  onClick={
                    col.sortable && onSort
                      ? () => onSort(col.key)
                      : undefined
                  }
                  aria-sort={
                    active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.header}
                  {arrow ? (
                    <span className="text-[11px] opacity-70">{arrow}</span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            const selected = selectedIds?.has(id);
            return (
              <tr
                key={id}
                className={cn(
                  "border-b border-rowline transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--ac)_8%,transparent)]",
                  onRowClick && "cursor-pointer",
                  selected &&
                    "bg-[color-mix(in_srgb,var(--ac)_12%,transparent)]",
                )}
                onClick={
                  onRowClick
                    ? (e) => {
                        const t = e.target as HTMLElement;
                        if (
                          t.closest(
                            "a,button,input,select,textarea,label,[data-no-row-click]",
                          )
                        ) {
                          return;
                        }
                        onRowClick(row);
                      }
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-2 py-[9px] tabular-nums text-tx",
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
