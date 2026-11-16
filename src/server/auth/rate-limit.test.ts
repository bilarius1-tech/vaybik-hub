import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { attemptKeys, clearFailures, isBlocked, recordFailure } from "./rate-limit";
import { prisma } from "@/server/db";
import { LOGIN_MAX_FAILURES } from "./constants";

describe("rate-limit", () => {
  const keys = attemptKeys("rate@test.local", "127.0.0.1");

  beforeEach(async () => {
    await clearFailures(keys);
  });

  it("блокирует после 5 неудач", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) {
      const r = await recordFailure(keys);
      expect(r.blocked).toBe(false);
      expect(await isBlocked(keys)).toBe(false);
    }
    const last = await recordFailure(keys);
    expect(last.blocked).toBe(true);
    expect(await isBlocked(keys)).toBe(true);
  });

  it("clearFailures снимает блок", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await recordFailure(keys);
    expect(await isBlocked(keys)).toBe(true);
    await clearFailures(keys);
    expect(await isBlocked(keys)).toBe(false);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
