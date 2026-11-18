import { createHmac, timingSafeEqual } from "node:crypto";

/** X-Hub-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")> */
export function signHubBody(
  secret: string,
  rawBody: string,
  t = Math.floor(Date.now() / 1000),
): string {
  const payload = `${t}.${rawBody}`;
  const v1 = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

/** Проверка подписи (для unit-тестов / зеркала на стороне чата). */
export function verifyHubSignature(
  secret: string,
  rawBody: string,
  header: string,
  nowSec = Math.floor(Date.now() / 1000),
  maxSkewSec = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return i < 0 ? [p, ""] : [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
  if (Math.abs(nowSec - t) > maxSkewSec) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
