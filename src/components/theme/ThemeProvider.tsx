"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemeMode = "dark" | "light";
export type ThemeVariant = "A" | "B" | "C";

type ThemeContextValue = {
  mode: ThemeMode;
  variant: ThemeVariant;
  toggleMode: () => void;
  setVariant: (v: ThemeVariant) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = "vaybik-theme-mode";
const VARIANT_KEY = "vaybik-theme-variant";

const modeListeners = new Set<() => void>();
const variantListeners = new Set<() => void>();

function emit(listeners: Set<() => void>) {
  listeners.forEach((l) => l());
}

function subscribeMode(onStoreChange: () => void) {
  modeListeners.add(onStoreChange);
  return () => {
    modeListeners.delete(onStoreChange);
  };
}

function subscribeVariant(onStoreChange: () => void) {
  variantListeners.add(onStoreChange);
  return () => {
    variantListeners.delete(onStoreChange);
  };
}

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "light" || v === "dark" ? v : "dark";
  } catch {
    return "dark";
  }
}

function readVariant(fallback: ThemeVariant): ThemeVariant {
  try {
    const v = localStorage.getItem(VARIANT_KEY);
    return v === "A" || v === "B" || v === "C" ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeMode(mode: ThemeMode) {
  localStorage.setItem(MODE_KEY, mode);
  emit(modeListeners);
}

function writeVariant(variant: ThemeVariant) {
  localStorage.setItem(VARIANT_KEY, variant);
  emit(variantListeners);
}

function applyDom(mode: ThemeMode, variant: ThemeVariant) {
  const root = document.documentElement;
  root.dataset.theme = variant;
  root.classList.toggle("light", mode === "light");
}

type Props = {
  children: ReactNode;
  defaultVariant?: ThemeVariant;
};

export function ThemeProvider({ children, defaultVariant = "A" }: Props) {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => "dark" as ThemeMode);
  const variant = useSyncExternalStore(
    subscribeVariant,
    () => readVariant(defaultVariant),
    () => defaultVariant,
  );

  useEffect(() => {
    applyDom(mode, variant);
  }, [mode, variant]);

  const toggleMode = useCallback(() => {
    writeMode(readMode() === "dark" ? "light" : "dark");
  }, []);

  const setVariant = useCallback((v: ThemeVariant) => {
    writeVariant(v);
  }, []);

  const value = useMemo(
    () => ({ mode, variant, toggleMode, setVariant }),
    [mode, variant, toggleMode, setVariant],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
