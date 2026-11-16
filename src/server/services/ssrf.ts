import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

/** Запрещённые частные/loopback/link-local диапазоны (SSRF) */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true;
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (isIP(mapped) === 4) return isPrivateIp(mapped);
    }
    return false;
  }
  return true;
}

export type UrlCheckResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export function parsePublicHttpUrl(raw: string): UrlCheckResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Некорректный URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Разрешены только http/https" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "URL с credentials запрещён" };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost")) {
    return { ok: false, reason: "Запрещённый хост" };
  }
  if (isIP(host) && isPrivateIp(host)) {
    return { ok: false, reason: "Приватный IP запрещён" };
  }
  return { ok: true, url };
}

/** Резолв DNS + проверка, что все A/AAAA не приватные */
export async function assertSafeFetchUrl(raw: string): Promise<URL> {
  const parsed = parsePublicHttpUrl(raw);
  if (!parsed.ok) {
    throw Object.assign(new Error(parsed.reason), {
      status: 400,
      code: "SSRF",
    });
  }
  const host = parsed.url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw Object.assign(new Error("Приватный IP запрещён"), {
        status: 400,
        code: "SSRF",
      });
    }
    return parsed.url;
  }
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (!records.length) {
      throw Object.assign(new Error("Не удалось разрешить хост"), {
        status: 400,
        code: "SSRF",
      });
    }
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        throw Object.assign(new Error("Хост резолвится в приватный IP"), {
          status: 400,
          code: "SSRF",
        });
      }
    }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "SSRF") {
      throw err;
    }
    throw Object.assign(new Error("Не удалось разрешить хост"), {
      status: 400,
      code: "SSRF",
    });
  }
  return parsed.url;
}
