import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { assertNoPlaintextLeak } from "@/server/vault/crypto";
import { createSecret, revealSecretPayload } from "@/server/vault/service";

const hasDb = !!process.env.DATABASE_URL && !!process.env.VAULT_MASTER_KEY;

describe.skipIf(!hasDb)("vault service (db)", () => {
  it("в dataEnc нет открытого текста секрета", async () => {
    const password = `plain-secret-${Date.now()}-xyz`;
    const user =
      (await prisma.user.findFirst()) ||
      (await prisma.user.create({
        data: {
          email: `vault-test-${Date.now()}@example.com`,
          passwordHash: "x",
          role: "OWNER",
          name: "Vault Test",
        },
      }));

    const secret = await createSecret({
      title: "test-leak-check",
      kind: "login",
      tags: ["test"],
      secrets: { password },
      createdById: user.id,
    });

    try {
      assertNoPlaintextLeak(secret, [password]);
      const opened = revealSecretPayload(secret);
      expect(opened.password).toBe(password);
    } finally {
      await prisma.secret.delete({ where: { id: secret.id } });
    }
  });
});
