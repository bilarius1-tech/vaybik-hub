import type { NextRequest } from "next/server";

export function clientIp(req: NextRequest): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

export function userAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}

/** CSRF: для мутаций Origin должен совпадать с Host (или APP_URL) */
export function assertSameOrigin(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin) {
    // same-site form/fetch без Origin в старых клиентах — отклоняем мутации
    throw Object.assign(new Error("Отсутствует Origin"), {
      status: 403,
      code: "CSRF",
    });
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Object.assign(new Error("Некорректный Origin"), {
      status: 403,
      code: "CSRF",
    });
  }

  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      const allowed = new URL(appUrl).host;
      if (originHost === allowed || (host && originHost === host)) return;
    } catch {
      /* ignore */
    }
  }

  if (host && originHost === host) return;

  throw Object.assign(new Error("Origin не совпадает с Host"), {
    status: 403,
    code: "CSRF",
  });
}
