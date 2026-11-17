import { describe, expect, it } from "vitest";
import { can, requireRole, type AuthUser } from "./rbac";

const owner: AuthUser = {
  id: "1",
  email: "o@t",
  name: null,
  role: "OWNER",
  totpEnabled: true,
  isBlocked: false,
  partnerId: null,
};

const admin: AuthUser = { ...owner, id: "2", role: "ADMIN" };
const partner: AuthUser = { ...owner, id: "3", role: "PARTNER" };
const blocked: AuthUser = { ...owner, isBlocked: true };

describe("rbac", () => {
  it("owner может управлять пользователями", () => {
    expect(can(owner, "users.manage")).toBe(true);
    expect(can(admin, "users.manage")).toBe(false);
    expect(can(partner, "users.manage")).toBe(false);
  });

  it("заблокированный ничего не может", () => {
    expect(can(blocked, "activity.read")).toBe(false);
  });

  it("requireRole бросает 403", () => {
    expect(() => requireRole(admin, "OWNER")).toThrow(/прав/);
    expect(() => requireRole(owner, ["OWNER", "ADMIN"])).not.toThrow();
  });

  it("content.manage — OWNER и ADMIN, не PARTNER", () => {
    expect(can(owner, "content.manage")).toBe(true);
    expect(can(admin, "content.manage")).toBe(true);
    expect(can(partner, "content.manage")).toBe(false);
  });
});
