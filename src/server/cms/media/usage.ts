/**
 * Собирает ссылки на mediaId из данных блока.
 * Ищет объекты { mediaId } и атрибуты data-media-id в HTML-строках.
 */
export type MediaRef = { mediaId: string; field: string };

function walk(value: unknown, field: string, out: MediaRef[]): void {
  if (value == null) return;
  if (typeof value === "string") {
    const re = /data-media-id=["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value))) {
      out.push({ mediaId: m[1], field });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${field}.${i}`, out));
    return;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.mediaId === "string" && obj.mediaId) {
      out.push({ mediaId: obj.mediaId, field });
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === "mediaId") continue;
      const next = field ? `${field}.${k}` : k;
      walk(v, next, out);
    }
  }
}

export function collectMediaRefs(
  _type: string,
  data: unknown,
): MediaRef[] {
  const out: MediaRef[] = [];
  walk(data, "", out);
  // нормализуем field (убрать ведущую точку)
  const seen = new Set<string>();
  const unique: MediaRef[] = [];
  for (const r of out) {
    const field = r.field.replace(/^\./, "") || "data";
    const key = `${r.mediaId}|${field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ mediaId: r.mediaId, field });
  }
  return unique;
}
