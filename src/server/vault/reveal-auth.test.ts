import { describe, expect, it } from "vitest";
import { AuthError } from "@/server/auth/require";
import { isReauthValid } from "@/server/auth/session";
import { handleRouteError } from "@/server/http/response";

describe("vault reveal auth", () => {
  it("без reauth → 401 REAUTH_REQUIRED", async () => {
    expect(isReauthValid(null)).toBe(false);
    expect(isReauthValid(new Date(Date.now() - 1000))).toBe(false);

    const res = handleRouteError(
      new AuthError(
        "Требуется повторная аутентификация",
        401,
        "REAUTH_REQUIRED",
      ),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("REAUTH_REQUIRED");
  });
});
