import { describe, expect, it } from "vitest";
import { STATEMENT_TIMEOUT_MS, wrapDbError } from "./client";
import { assertReadOnlySelect } from "./sql-guard";

describe("query timeout mapping", () => {
  it("мапит код 57014 в QUERY_TIMEOUT", () => {
    const err = Object.assign(new Error("canceling statement due to statement timeout"), {
      code: "57014",
    });
    const wrapped = wrapDbError(err, "vaybik_admin");
    expect((wrapped as Error & { code?: string }).code).toBe("QUERY_TIMEOUT");
    expect((wrapped as Error & { status?: number }).status).toBe(408);
    expect(wrapped.message).toContain(String(STATEMENT_TIMEOUT_MS / 1000));
  });
});

describe("select guard + timeout path", () => {
  it("pg_sleep в SELECT допускается синтаксисом (таймаут на стороне БД)", () => {
    expect(() => assertReadOnlySelect("SELECT pg_sleep(10)")).not.toThrow();
  });
});
