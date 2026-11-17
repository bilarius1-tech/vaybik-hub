import { z } from "zod";

export const CHAT_WIDGET_SETTING_KEY = "site.chatWidget";

const ALLOWED_SRC_HOSTS = new Set(["chat.vaybik.ru", "chat-test.vaybik.ru"]);

export const DEFAULT_CHAT_WIDGET_SRC = "https://chat.vaybik.ru/widget.js";

export const chatWidgetSchema = z.object({
  enabled: z.boolean().default(false),
  src: z.string().url().default(DEFAULT_CHAT_WIDGET_SRC),
  publicId: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9_-]*$/, "publicId: только латиница, цифры, _ и -")
    .default(""),
  /** Пусто + enabled → весь сайт; иначе только перечисленные пути */
  paths: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
});

export type ChatWidgetConfig = z.infer<typeof chatWidgetSchema>;

export function parseChatWidget(value: unknown): ChatWidgetConfig {
  const parsed = chatWidgetSchema.safeParse(value ?? {});
  if (!parsed.success) {
    return chatWidgetSchema.parse({});
  }
  return assertAllowedSrc(parsed.data);
}

/** Только chat.vaybik.ru / chat-test.vaybik.ru, путь widget.js */
export function assertAllowedSrc(cfg: ChatWidgetConfig): ChatWidgetConfig {
  let src = cfg.src.trim() || DEFAULT_CHAT_WIDGET_SRC;
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    src = DEFAULT_CHAT_WIDGET_SRC;
    url = new URL(src);
  }
  if (url.protocol !== "https:" || !ALLOWED_SRC_HOSTS.has(url.hostname)) {
    src = DEFAULT_CHAT_WIDGET_SRC;
    url = new URL(src);
  }
  // нормализуем к /widget.js на разрешённом хосте
  if (!url.pathname.endsWith("/widget.js") && url.pathname !== "/widget.js") {
    url.pathname = "/widget.js";
  }
  url.search = "";
  url.hash = "";
  return { ...cfg, src: url.toString() };
}

export function normalizeSitePath(path: string): string {
  const p = path.trim() || "/";
  if (p === "/") return "/";
  return p.endsWith("/") ? p : `${p}/`;
}

/** paths[] пусто → весь сайт; иначе точное совпадение нормализованных путей */
export function chatWidgetApplies(
  cfg: ChatWidgetConfig,
  pagePath: string,
): boolean {
  if (!cfg.enabled) return false;
  if (!cfg.publicId.trim()) return false;
  if (!cfg.paths.length) return true;
  const cur = normalizeSitePath(pagePath);
  return cfg.paths.some((p) => normalizeSitePath(p) === cur);
}

export function renderChatWidgetScript(cfg: ChatWidgetConfig): string {
  const safe = assertAllowedSrc(cfg);
  if (!safe.enabled || !safe.publicId.trim()) return "";
  const src = safe.src.replace(/"/g, "");
  const id = safe.publicId.replace(/"/g, "");
  return `<script src="${src}" data-id="${id}" async></script>`;
}

export function chatWidgetSnippetPreview(cfg: ChatWidgetConfig): string {
  const safe = assertAllowedSrc(cfg);
  const id = safe.publicId.trim() || "YOUR_PUBLIC_ID";
  return `<script src="${safe.src}" data-id="${id}" async></script>`;
}
