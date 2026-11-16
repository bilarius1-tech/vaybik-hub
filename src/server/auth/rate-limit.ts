import { prisma } from "@/server/db";
import { LOGIN_BLOCK_MS, LOGIN_MAX_FAILURES } from "@/server/auth/constants";

export async function isBlocked(keys: string[]): Promise<boolean> {
  const now = new Date();
  const rows = await prisma.loginAttempt.findMany({
    where: { key: { in: keys } },
  });
  return rows.some((r) => r.blockedUntil != null && r.blockedUntil > now);
}

export async function recordFailure(keys: string[]): Promise<{ blocked: boolean }> {
  const now = new Date();
  let blocked = false;

  for (const key of keys) {
    const current = await prisma.loginAttempt.findUnique({ where: { key } });
    const reset = !current || (current.blockedUntil != null && current.blockedUntil <= now);
    const prev = reset ? 0 : current.failedCount;
    const failedCount = prev + 1;
    const blockedUntil =
      failedCount >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null;
    if (blockedUntil) blocked = true;

    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, failedCount, blockedUntil },
      update: { failedCount, blockedUntil },
    });
  }

  return { blocked };
}

export async function clearFailures(keys: string[]): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: { in: keys } } });
}

export function attemptKeys(email: string, ip: string | null): string[] {
  const keys = [`email:${email.toLowerCase()}`];
  if (ip) keys.push(`ip:${ip}`);
  return keys;
}
