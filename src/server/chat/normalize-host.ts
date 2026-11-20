/**
 * Нормализация хоста лендинга: без схемы, www, пути, порта, нижний регистр.
 * Пустая строка / невалид → null.
 */
export function normalizeSiteHost(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      s = u.hostname;
    } else {
      // host/path или host:port
      s = s.split("/")[0] ?? s;
      if (s.includes(":") && !s.startsWith("[")) {
        s = s.split(":")[0] ?? s;
      }
    }
  } catch {
    return null;
  }
  if (s.startsWith("www.")) s = s.slice(4);
  s = s.replace(/\.$/, "");
  if (!s || s.includes(" ") || !/^[a-z0-9.-]+$/.test(s)) return null;
  if (!s.includes(".")) return null; // нужен домен с точкой
  return s;
}

/** siteUrl для хранения в Client (всегда https). */
export function siteUrlFromHost(host: string): string {
  return `https://${host}`;
}

/** Извлечь нормализованный хост из Client.siteUrl. */
export function hostFromSiteUrl(
  siteUrl: string | null | undefined,
): string | null {
  return normalizeSiteHost(siteUrl);
}
