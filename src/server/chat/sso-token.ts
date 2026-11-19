import { createHmac, randomBytes } from "node:crypto";
import { getChatSsoConfig } from "./config";

export type SsoMode = "impersonate" | "client";

export type SsoPayload = {
  iss: "vaybik-hub";
  aud: "chat";
  jti: string;
  iat: number;
  exp: number;
  mode: SsoMode;
  sub: string;
  email: string;
  hubClientId: string;
  impersonatedBy: string | null;
  returnUrl: string;
};

export type IssueSsoInput = {
  mode: SsoMode;
  userId: string;
  email: string;
  /** Пустая строка — студия без конкретного клиента (чат должен принять). */
  hubClientId: string;
  impersonatedBy: string | null;
  returnUrl: string;
  /** Относительный путь чата → query next на /sso */
  chatNext?: string;
  /** секунды жизни токена (по контракту 60) */
  ttlSec?: number;
  nowSec?: number;
};

function b64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

/** returnUrl только на хосте APP_URL / HUB (не чужой редирект). */
export function buildSafeReturnUrl(path: string): string | null {
  const app = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (!app) return null;
  let base: URL;
  try {
    base = new URL(app);
  } catch {
    return null;
  }
  const clean = path.startsWith("/") ? path : `/${path}`;
  // APP_URL уже с /admin → путь относительно basePath
  return `${base.origin}${base.pathname.replace(/\/$/, "")}${clean}`;
}

export function assertReturnUrlAllowed(returnUrl: string): boolean {
  const app = (process.env.APP_URL || "").trim();
  if (!app) return false;
  try {
    const allowed = new URL(app);
    const got = new URL(returnUrl);
    return got.protocol === allowed.protocol && got.host === allowed.host;
  } catch {
    return false;
  }
}

/**
 * Выпуск SSO-токена. Полный токен наружу только для Location redirect —
 * не логировать и не класть в БД (только jti).
 */
export function issueSsoToken(input: IssueSsoInput): {
  token: string;
  jti: string;
  exp: number;
  ssoUrl: string;
} {
  const cfg = getChatSsoConfig();
  if (!cfg) {
    const err = new Error(
      "SSO не настроен: задайте CHAT_BASE_URL и HUB_CHAT_SSO_SECRET",
    ) as Error & { status: number; code: string };
    err.status = 503;
    err.code = "CHAT_SSO_NOT_CONFIGURED";
    throw err;
  }

  if (!assertReturnUrlAllowed(input.returnUrl)) {
    const err = new Error("Недопустимый returnUrl") as Error & {
      status: number;
      code: string;
    };
    err.status = 400;
    err.code = "BAD_RETURN_URL";
    throw err;
  }

  const iat = input.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = input.ttlSec ?? 60;
  const jti = randomBytes(16).toString("hex");
  const payload: SsoPayload = {
    iss: "vaybik-hub",
    aud: "chat",
    jti,
    iat,
    exp: iat + ttl,
    mode: input.mode,
    sub: input.userId,
    email: input.email,
    hubClientId: input.hubClientId,
    impersonatedBy: input.impersonatedBy,
    returnUrl: input.returnUrl,
  };

  const payloadRaw = JSON.stringify(payload);
  const sig = createHmac("sha256", cfg.ssoSecret)
    .update(payloadRaw, "utf8")
    .digest();
  const token = `${b64url(payloadRaw)}.${b64url(sig)}`;
  let ssoUrl = `${cfg.baseUrl}/sso?token=${encodeURIComponent(token)}`;
  if (input.chatNext) {
    ssoUrl += `&next=${encodeURIComponent(input.chatNext)}`;
  }

  return { token, jti, exp: payload.exp, ssoUrl };
}

/** Для unit-тестов: проверить подпись (зеркало логики чата). */
export function verifySsoToken(
  token: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): SsoPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  let payloadRaw: string;
  let sig: Buffer;
  try {
    payloadRaw = Buffer.from(payloadB64, "base64url").toString("utf8");
    sig = Buffer.from(sigB64, "base64url");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret)
    .update(payloadRaw, "utf8")
    .digest();
  if (expected.length !== sig.length) return null;
  // constant-time
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i]! ^ sig[i]!;
  if (diff !== 0) return null;

  let payload: SsoPayload;
  try {
    payload = JSON.parse(payloadRaw) as SsoPayload;
  } catch {
    return null;
  }
  if (payload.iss !== "vaybik-hub" || payload.aud !== "chat") return null;
  if (typeof payload.exp !== "number" || payload.exp < nowSec) return null;
  return payload;
}
