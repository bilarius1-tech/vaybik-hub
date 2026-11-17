"use client";

import { Button } from "@/components/ui/Button";
import type { ReactNode } from "react";

export function Repeater<T>({
  items,
  onChange,
  createItem,
  renderItem,
  label = "Элементы",
  addLabel = "+ добавить",
}: {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, index: number, helpers: {
    update: (patch: Partial<T>) => void;
    remove: () => void;
  }) => ReactNode;
  label?: string;
  addLabel?: string;
}) {
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-mu">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange([...items, createItem()])}
        >
          {addLabel}
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-bd p-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button size="sm" variant="ghost" onClick={() => move(i, 1)}>
              ↓
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange([...items.slice(0, i + 1), structuredClone(item), ...items.slice(i + 1)])}
            >
              Дубль
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              Удалить
            </Button>
          </div>
          {renderItem(item, i, {
            update: (patch) =>
              onChange(
                items.map((it, idx) =>
                  idx === i ? { ...it, ...patch } : it,
                ),
              ),
            remove: () => onChange(items.filter((_, j) => j !== i)),
          })}
        </div>
      ))}
    </div>
  );
}
