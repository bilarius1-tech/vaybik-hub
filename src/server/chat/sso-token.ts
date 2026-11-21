import { createHmac, randomBytes } from "node:crypto";
import { getChatSsoConfig } from "./config";

export type SsoMode = "impersonate" | "client";

/** Аудитория SSO: у каждого сервиса свой aud (чат / лиды / …). */
export type SsoAudience = "chat" | "leads";

export type SsoPayload = {
  iss: "vaybik-hub";
  aud: SsoAudience;
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

export type SsoProductConfig = {
  baseUrl: string;
  ssoSecret: string;
  /** Код ошибки 503, если не задан product и нет chat-config */
  notConfiguredCode?: string;
  notConfiguredMessage?: string;
};

export type IssueSsoInput = {
  mode: SsoMode;
  userId: string;
  email: string;
  /** Пустая строка — студия без конкретного клиента (сервис должен принять). */
  hubClientId: string;
  impersonatedBy: string | null;
  returnUrl: string;
  /** По умолчанию "chat" — поведение impersonate/client для чата без изменений. */
  aud?: SsoAudience;
  /** baseUrl + secret; если нет — берём CHAT_BASE_URL / HUB_CHAT_SSO_SECRET. */
  product?: SsoProductConfig;
  /** Относительный путь сервиса → query next на /sso */
  chatNext?: string;
  serviceNext?: string;
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

function resolveProduct(
  input: IssueSsoInput,
): SsoProductConfig | null {
  if (input.product) return input.product;
  const chat = getChatSsoConfig();
  if (!chat) return null;
  return {
    baseUrl: chat.baseUrl,
    ssoSecret: chat.ssoSecret,
    notConfiguredCode: "CHAT_SSO_NOT_CONFIGURED",
    notConfiguredMessage:
      "SSO не настроен: задайте CHAT_BASE_URL и HUB_CHAT_SSO_SECRET",
  };
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
  const cfg = resolveProduct(input);
  if (!cfg) {
    const err = new Error(
      input.product?.notConfiguredMessage ||
        "SSO не настроен: задайте CHAT_BASE_URL и HUB_CHAT_SSO_SECRET",
    ) as Error & { status: number; code: string };
    err.status = 503;
    err.code =
      input.product?.notConfiguredCode || "CHAT_SSO_NOT_CONFIGURED";
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

  const aud: SsoAudience = input.aud ?? "chat";
  const iat = input.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = input.ttlSec ?? 60;
  const jti = randomBytes(16).toString("hex");
  const payload: SsoPayload = {
    iss: "vaybik-hub",
    aud,
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
  const nextPath = input.serviceNext ?? input.chatNext;
  if (nextPath) {
    ssoUrl += `&next=${encodeURIComponent(nextPath)}`;
  }

  return { token, jti, exp: payload.exp, ssoUrl };
}

/** Для unit-тестов: проверить подпись (зеркало логики сервиса). */
export function verifySsoToken(
  token: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  expectedAud: SsoAudience = "chat",
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
  if (payload.iss !== "vaybik-hub" || payload.aud !== expectedAud) return null;
  if (typeof payload.exp !== "number" || payload.exp < nowSec) return null;
  return payload;
}
