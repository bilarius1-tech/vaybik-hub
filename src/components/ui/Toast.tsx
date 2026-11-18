"use client";

import { cn } from "@/lib/cn";

export type ToastState = {
  tone: "ok" | "err";
  text: string;
} | null;

/** Короткий тост внизу экрана. */
export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md px-4 py-2 text-[13px] font-bold shadow-card",
        toast.tone === "ok"
          ? "bg-gr text-white"
          : "bg-rd text-white",
      )}
    >
      {toast.text}
    </div>
  );
}
