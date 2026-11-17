export type MediaVariantName = "w480" | "w960" | "w1600" | "orig" | "preview";

export type MediaVariant = {
  name: MediaVariantName | string;
  w?: number | null;
  h?: number | null;
  file: string;
  size: number;
  mime: string;
};

export function mediaPublicBase(): string {
  const base =
    process.env.MEDIA_PUBLIC_BASE?.trim() || "/admin/api/public/media";
  return base.replace(/\/$/, "");
}

export function mediaUrl(
  asset: { id: string; version: number },
  variant: MediaVariantName | string = "orig",
  ext?: string,
): string {
  const e = ext ? (ext.startsWith(".") ? ext : `.${ext}`) : "";
  // file name is in variants; callers usually pass full path via variant file
  return `${mediaPublicBase()}/${asset.id}/v${asset.version}/${variant}${e}`;
}

/** Полный публичный URL по записи варианта */
export function mediaVariantUrl(
  asset: { id: string; version: number },
  variant: MediaVariant,
): string {
  return `${mediaPublicBase()}/${asset.id}/v${asset.version}/${variant.file}`;
}

export function mediaSoftLimitBytes(): number {
  const mb = Number(process.env.MEDIA_SOFT_LIMIT_MB || "1024");
  const n = Number.isFinite(mb) && mb > 0 ? mb : 1024;
  return Math.floor(n * 1024 * 1024);
}

/** Проверка сегментов пути public media */
export function assertSafeMediaPath(
  id: string,
  version: string,
  file: string,
): { id: string; version: number; file: string } {
  if (!/^c[a-z0-9]{20,32}$/i.test(id) && !/^[\w-]{8,64}$/.test(id)) {
    throw Object.assign(new Error("Некорректный id медиа"), {
      status: 400,
      code: "BAD_NAME",
    });
  }
  if (!/^v\d+$/.test(version)) {
    throw Object.assign(new Error("Некорректная версия"), {
      status: 400,
      code: "BAD_NAME",
    });
  }
  if (!/^[a-z0-9._-]+\.(webp|jpg|jpeg|png|gif|svg|avif)$/i.test(file)) {
    throw Object.assign(new Error("Некорректное имя файла"), {
      status: 400,
      code: "BAD_NAME",
    });
  }
  if (file.includes("..") || file.includes("/") || file.includes("\\")) {
    throw Object.assign(new Error("Некорректное имя файла"), {
      status: 400,
      code: "BAD_NAME",
    });
  }
  return { id, version: Number(version.slice(1)), file };
}
