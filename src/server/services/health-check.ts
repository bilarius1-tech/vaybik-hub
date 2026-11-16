import { connect as tlsConnect } from "node:tls";
import type { CheckStatus } from "@prisma/client";
import { assertSafeFetchUrl } from "@/server/services/ssrf";

export type HealthCheckInput = {
  healthUrl: string;
  expectedStatus?: number;
  keyword?: string | null;
  timeoutMs?: number;
};

export type HealthCheckResult = {
  status: CheckStatus;
  httpStatus: number | null;
  responseMs: number | null;
  error: string | null;
  certExpiresAt: Date | null;
  bodySnippet?: string;
};

async function getCertExpiry(hostname: string, port: number): Promise<Date | null> {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (cert && cert.valid_to) {
          resolve(new Date(cert.valid_to));
        } else {
          resolve(null);
        }
      },
    );
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve(null);
    });
    socket.on("error", () => resolve(null));
  });
}

export async function runHealthCheck(
  input: HealthCheckInput,
): Promise<HealthCheckResult> {
  const timeoutMs = input.timeoutMs ?? 10_000;
  const expected = input.expectedStatus ?? 200;

  let url: URL;
  try {
    url = await assertSafeFetchUrl(input.healthUrl);
  } catch (err) {
    return {
      status: "DOWN",
      httpStatus: null,
      responseMs: null,
      error: err instanceof Error ? err.message : "SSRF",
      certExpiresAt: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  let certExpiresAt: Date | null = null;
  if (url.protocol === "https:") {
    const port = url.port ? Number(url.port) : 443;
    certExpiresAt = await getCertExpiry(url.hostname, port);
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "vaybik-hub-healthcheck/1.0" },
    });
    const responseMs = Date.now() - started;
    const text = await res.text();
    const bodySnippet = text.slice(0, 500);

    if (res.status !== expected) {
      return {
        status: "DOWN",
        httpStatus: res.status,
        responseMs,
        error: `Ожидался ${expected}, получен ${res.status}`,
        certExpiresAt,
        bodySnippet,
      };
    }

    if (input.keyword && !text.includes(input.keyword)) {
      return {
        status: "DEGRADED",
        httpStatus: res.status,
        responseMs,
        error: `Ключевое слово не найдено: ${input.keyword}`,
        certExpiresAt,
        bodySnippet,
      };
    }

    // Медленный ответ — деградация
    const status: CheckStatus =
      responseMs > Math.min(timeoutMs * 0.8, 5000) ? "DEGRADED" : "UP";

    return {
      status,
      httpStatus: res.status,
      responseMs,
      error: null,
      certExpiresAt,
      bodySnippet,
    };
  } catch (err) {
    const responseMs = Date.now() - started;
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Таймаут"
          : err.message
        : "Ошибка запроса";
    return {
      status: "DOWN",
      httpStatus: null,
      responseMs,
      error: msg,
      certExpiresAt,
    };
  } finally {
    clearTimeout(timer);
  }
}
