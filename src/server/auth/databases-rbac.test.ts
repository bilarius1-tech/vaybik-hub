import { describe, expect, it } from "vitest";
import { can, requirePermission, type AuthUser } from "./rbac";

function user(role: AuthUser["role"]): AuthUser {
  return {
    id: "u1",
    email: "t@t",
    role,
    totpEnabled: false,
    isBlocked: false,
    partnerId: null,
    name: null,
  };
}

describe("databases RBAC", () => {
  it("партнёр не видит databases.read", () => {
    expect(can(user("PARTNER"), "databases.read")).toBe(false);
    expect(() => requirePermission(user("PARTNER"), "databases.read")).toThrow(
      /прав/i,
    );
  });

  it("ADMIN читает, но не restore", () => {
    expect(can(user("ADMIN"), "databases.read")).toBe(true);
    expect(can(user("ADMIN"), "databases.restore")).toBe(false);
  });

  it("OWNER может restore", () => {
    expect(can(user("OWNER"), "databases.restore")).toBe(true);
  });
});
