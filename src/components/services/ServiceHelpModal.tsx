"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useEffect, useMemo, useState } from "react";

export type HelpPageDto = {
  slug: string;
  title: string;
  order: number;
  updated: string;
  commit: string;
  html: string;
};

type Props = {
  open: boolean;
  serviceId: string;
  serviceName: string;
  onClose: () => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "ok"; pages: HelpPageDto[] }
  | { status: "error"; message: string };

export function ServiceHelpModal({
  open,
  serviceId,
  serviceName,
  onClose,
}: Props) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/admin/api/services/${serviceId}/help`, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const json = (await res.json().catch(() => null)) as
          | { pages?: HelpPageDto[]; error?: { message?: string } }
          | null;
        if (cancelled) return;
        if (!res.ok || !json?.pages) {
          setState({
            status: "error",
            message: "Справка недоступна",
          });
          return;
        }
        setState({ status: "ok", pages: json.pages });
        setActiveSlug(json.pages[0]?.slug ?? null);
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Справка недоступна" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, serviceId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (state.status !== "ok") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.pages;
    return state.pages.filter((p) => p.title.toLowerCase().includes(q));
  }, [state, query]);

  const active = useMemo(() => {
    if (state.status !== "ok") return null;
    return (
      state.pages.find((p) => p.slug === activeSlug) ?? state.pages[0] ?? null
    );
  }, [state, activeSlug]);

  if (!open) return null;

  const commit =
    active?.commit && active.commit !== "pending" ? active.commit : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-bd bg-gradient-to-b from-card2 to-card shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bd px-4 py-3">
          <div>
            <h3
              id="service-help-title"
              className="text-[15px] font-extrabold text-tx"
            >
              Справка — {serviceName}
            </h3>
            {active ? (
              <p className="mt-0.5 text-[12.5px] text-mu">
                Обновлено: {active.updated || "—"}
                {commit ? (
                  <>
                    {" "}
                    · <code className="text-tx">{commit}</code>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        {state.status === "loading" ? (
          <div className="p-6 text-[13.5px] text-mu">Загрузка…</div>
        ) : state.status === "error" ? (
          <div className="p-6 text-[13.5px] text-mu">{state.message}</div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr]">
            <aside className="flex min-h-0 flex-col border-b border-bd md:border-b-0 md:border-r">
              <div className="border-b border-bd p-3">
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по заголовкам"
                  aria-label="Поиск по заголовкам"
                />
              </div>
              <nav
                className="min-h-0 flex-1 overflow-y-auto p-2"
                aria-label="Оглавление"
              >
                {filtered.length === 0 ? (
                  <p className="px-2 py-3 text-[12.5px] text-mu">
                    Ничего не найдено
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {filtered.map((p) => {
                      const selected = p.slug === active?.slug;
                      return (
                        <li key={p.slug}>
                          <button
                            type="button"
                            onClick={() => setActiveSlug(p.slug)}
                            className={
                              selected
                                ? "w-full rounded-lg bg-ac/15 px-2.5 py-2 text-left text-[13px] font-semibold text-tx"
                                : "w-full rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-mu hover:bg-bg2 hover:text-tx"
                            }
                          >
                            {p.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </nav>
            </aside>
            <article className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
              {active ? (
                <div
                  className="help-prose text-[13.5px] leading-relaxed text-tx [&_a]:text-ac [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-bd [&_blockquote]:pl-3 [&_blockquote]:text-mu [&_code]:rounded [&_code]:bg-bg2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12.5px] [&_h1]:mb-3 [&_h1]:text-[20px] [&_h1]:font-extrabold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-[16px] [&_h2]:font-extrabold [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-[14.5px] [&_h3]:font-bold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-bd [&_pre]:bg-bg2 [&_pre]:p-3 [&_pre]:text-[12.5px] [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-bd [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-bd [&_th]:bg-bg2 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: active.html }}
                />
              ) : (
                <p className="text-mu">Нет страниц</p>
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
