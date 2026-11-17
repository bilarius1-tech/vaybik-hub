import type { MediaVariant } from "../media/url";
import { esc, escAttr } from "./escape";

export type MediaAssetInfo = {
  id: string;
  version: number;
  alt: string | null;
  width: number | null;
  height: number | null;
  variants: MediaVariant[];
};

export type MediaRenderContext = {
  mediaBase: string;
  mediaById: Map<string, MediaAssetInfo>;
  warn?: (msg: string) => void;
};

type PhotoInput = {
  mediaId?: string | null;
  src?: string | null;
  alt?: string | null;
  version?: number;
};

function asPhoto(photo: unknown): PhotoInput | null {
  if (typeof photo === "string") return { src: photo };
  if (photo && typeof photo === "object") return photo as PhotoInput;
  return null;
}

function findVariant(
  variants: MediaVariant[],
  name: string,
): MediaVariant | undefined {
  return variants.find((v) => v.name === name || v.file.startsWith(name));
}

/**
 * Картинка из медиатеки: <picture> с webp-srcset + fallback.
 * Если ассета нет — пустая строка и warn.
 */
export function renderMediaPicture(
  photo: unknown,
  ctx: MediaRenderContext,
  opts?: {
    fallbackAlt?: string;
    lazy?: boolean;
    className?: string;
    width?: number | null;
    height?: number | null;
  },
): string {
  const p = asPhoto(photo);
  if (!p) return "";

  const lazy = opts?.lazy !== false;
  const loading = lazy ? ' loading="lazy"' : ' fetchpriority="high"';
  const cls = opts?.className ? ` class="${escAttr(opts.className)}"` : "";

  if (p.mediaId) {
    const asset = ctx.mediaById.get(p.mediaId);
    if (!asset) {
      ctx.warn?.(`media missing: ${p.mediaId}`);
      return "";
    }
    const base = `${ctx.mediaBase.replace(/\/$/, "")}/${asset.id}/v${asset.version}`;
    const variants = Array.isArray(asset.variants) ? asset.variants : [];
    const webpParts: string[] = [];
    for (const name of ["w480", "w960", "w1600"] as const) {
      const v = findVariant(variants, name);
      if (v) {
        const w =
          v.w ||
          (name === "w480" ? 480 : name === "w960" ? 960 : 1600);
        webpParts.push(`${base}/${v.file} ${w}w`);
      }
    }
    const orig = findVariant(variants, "orig") || variants[0];
    if (!orig) {
      ctx.warn?.(`media no variants: ${p.mediaId}`);
      return "";
    }
    const alt = escAttr(p.alt || asset.alt || opts?.fallbackAlt || "");
    const w = opts?.width ?? asset.width ?? orig.w;
    const h = opts?.height ?? asset.height ?? orig.h;
    const wh =
      (w ? ` width="${w}"` : "") + (h ? ` height="${h}"` : "");
    const source =
      webpParts.length > 0
        ? `<source type="image/webp" srcset="${escAttr(webpParts.join(", "))}">`
        : "";
    return `<picture>${source}<img src="${escAttr(`${base}/${orig.file}`)}" alt="${alt}"${wh}${loading} decoding="async"${cls}></picture>`;
  }

  if (p.src) {
    const alt = escAttr(p.alt || opts?.fallbackAlt || "");
    const w = opts?.width ? ` width="${opts.width}"` : "";
    const h = opts?.height ? ` height="${opts.height}"` : "";
    return `<img src="${escAttr(p.src)}" alt="${alt}"${w}${h}${loading} decoding="async"${cls}>`;
  }

  return "";
}

/** Простой src для мест, где нужна только ссылка (не picture). */
export function resolveMediaSrc(
  photo: unknown,
  ctx: MediaRenderContext | null,
  fallbackAlt?: string,
): { src: string; alt: string; html?: string } {
  const p = asPhoto(photo);
  if (!p) return { src: "", alt: fallbackAlt || "" };

  if (p.mediaId && ctx) {
    const asset = ctx.mediaById.get(p.mediaId);
    if (!asset) {
      ctx.warn?.(`media missing: ${p.mediaId}`);
      return { src: "", alt: p.alt || fallbackAlt || "" };
    }
    const variants = Array.isArray(asset.variants) ? asset.variants : [];
    const orig = findVariant(variants, "orig") || variants[0];
    if (!orig) return { src: "", alt: p.alt || asset.alt || fallbackAlt || "" };
    const src = `${ctx.mediaBase.replace(/\/$/, "")}/${asset.id}/v${asset.version}/${orig.file}`;
    return { src, alt: p.alt || asset.alt || fallbackAlt || "" };
  }

  if (typeof photo === "string") {
    return { src: photo, alt: fallbackAlt || "" };
  }
  return { src: p.src || "", alt: p.alt || fallbackAlt || "" };
}

export function escText(s: string): string {
  return esc(s);
}
