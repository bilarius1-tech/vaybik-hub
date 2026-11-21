"use client";

import { useEffect, useState } from "react";

/** Fallback тема A (DESIGN.md) — если getComputedStyle недоступен. */
export const CHART_FALLBACK = {
  ac: "#ff8a1f",
  ac2: "#ffc37a",
  cy: "#5ce1e6",
  gr: "#22c55e",
  yl: "#f5b041",
  rd: "#ef4444",
  vi: "#a78bfa",
  pk: "#ec4899",
  mu: "#9aa5c3",
  tx: "#e8ecf8",
  bd: "#253156",
  card: "#121a30",
  /** DEMO — нейтральный серый */
  demo: "#94a3b8",
  /** OFF — тёмно-серый */
  off: "#4b5563",
} as const;

export type ChartPalette = {
  ac: string;
  ac2: string;
  cy: string;
  gr: string;
  yl: string;
  rd: string;
  vi: string;
  pk: string;
  mu: string;
  tx: string;
  bd: string;
  card: string;
  demo: string;
  off: string;
  /** Подписи / легенда */
  muted: string;
  /** Сетка осей */
  grid: string;
  series: string[];
  clients: {
    DEMO: string;
    ACTIVE: string;
    PAUSED: string;
    EXPIRED: string;
    OFF: string;
  };
};

function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw || fallback;
}

/** #rgb / #rrggbb / rgb() / rgba() → rgba(..., a) */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = color.trim();
  if (hex.startsWith("#")) {
    let h = hex.slice(1);
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 6 || h.length === 8) {
      const r = Number.parseInt(h.slice(0, 2), 16);
      const g = Number.parseInt(h.slice(2, 4), 16);
      const b = Number.parseInt(h.slice(4, 6), 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
    }
  }
  const rgb = hex.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i,
  );
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  }
  return color;
}

export function getChartPalette(): ChartPalette {
  const ac = readCssVar("--ac", CHART_FALLBACK.ac);
  const ac2 = readCssVar("--ac2", CHART_FALLBACK.ac2);
  const cy = readCssVar("--cy", CHART_FALLBACK.cy);
  const gr = readCssVar("--gr", CHART_FALLBACK.gr);
  const yl = readCssVar("--yl", CHART_FALLBACK.yl);
  const rd = readCssVar("--rd", CHART_FALLBACK.rd);
  const vi = readCssVar("--vi", CHART_FALLBACK.vi);
  const pk = readCssVar("--pk", CHART_FALLBACK.pk);
  const mu = readCssVar("--mu", CHART_FALLBACK.mu);
  const tx = readCssVar("--tx", CHART_FALLBACK.tx);
  const bd = readCssVar("--bd", CHART_FALLBACK.bd);
  const card = readCssVar("--card", CHART_FALLBACK.card);
  const demo = CHART_FALLBACK.demo;
  const off = CHART_FALLBACK.off;

  return {
    ac,
    ac2,
    cy,
    gr,
    yl,
    rd,
    vi,
    pk,
    mu,
    tx,
    bd,
    card,
    demo,
    off,
    // Подписи — светлый muted (не --bd: он тёмный и «чернеет» на фоне)
    muted: mu || CHART_FALLBACK.mu,
    // Сетка — полупрозрачный текст, не цвет рамки карточки
    grid: withAlpha(tx || CHART_FALLBACK.tx, 0.14),
    series: [ac, cy, gr, vi, pk, yl],
    clients: {
      DEMO: demo,
      ACTIVE: gr,
      PAUSED: yl,
      EXPIRED: rd,
      OFF: off,
    },
  };
}

/** Линия с лёгкой заливкой под ней. */
export function lineDatasetStyle(
  color: string,
  opts?: { fillAlpha?: number },
) {
  const fillAlpha = opts?.fillAlpha ?? 0.14;
  return {
    borderColor: color,
    backgroundColor: withAlpha(color, fillAlpha),
    fill: "origin" as const,
    tension: 0.35,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2,
  };
}

export function useChartPalette(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(() => getChartPalette());

  useEffect(() => {
    const refresh = () => setPalette(getChartPalette());
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    if (document.body) {
      obs.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
    window.addEventListener("storage", refresh);
    return () => {
      obs.disconnect();
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return palette;
}
