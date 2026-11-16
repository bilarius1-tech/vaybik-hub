import { describe, expect, it } from "vitest";
import { can, type AuthUser } from "@/server/auth/rbac";

const partner: AuthUser = {
  id: "p1",
  email: "partner@example.com",
  name: "Partner",
  role: "PARTNER",
  totpEnabled: true,
  isBlocked: false,
  partnerId: "partner-org-1",
};

/** Фаза 1: партнёрских эндпоинтов ещё нет; RBAC не даёт чужие модули */
describe("partner isolation (фаза 1)", () => {
  it("PARTNER не может сервисы, vault, настройки, пользователей, БД", () => {
    expect(can(partner, "partner.self")).toBe(true);
    expect(can(partner, "services.manage")).toBe(false);
    expect(can(partner, "vault.read")).toBe(false);
    expect(can(partner, "vault.manage")).toBe(false);
    expect(can(partner, "settings.manage")).toBe(false);
    expect(can(partner, "users.manage")).toBe(false);
    expect(can(partner, "activity.read")).toBe(false);
    expect(can(partner, "databases.read")).toBe(false);
    expect(can(partner, "databases.restore")).toBe(false);
  });
});
