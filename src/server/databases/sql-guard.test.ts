import { describe, expect, it } from "vitest";
import { assertReadOnlySelect } from "./sql-guard";

describe("assertReadOnlySelect", () => {
  it("пропускает простой SELECT", () => {
    expect(assertReadOnlySelect("SELECT 1")).toBe("SELECT 1");
  });

  it("пропускает WITH … SELECT", () => {
    const q = "WITH x AS (SELECT 1 AS a) SELECT * FROM x";
    expect(assertReadOnlySelect(q)).toBe(q);
  });

  it.each([
    "DELETE FROM users",
    "UPDATE users SET x=1",
    "INSERT INTO t VALUES (1)",
    "TRUNCATE TABLE t",
    "DROP TABLE t",
    "ALTER TABLE t ADD COLUMN x int",
    "SELECT * INTO t2 FROM t",
    "SELECT * FROM t FOR UPDATE",
    "EXPLAIN ANALYZE UPDATE t SET x=1",
  ])("отклоняет мутацию/DDL: %s", (sql) => {
    expect(() => assertReadOnlySelect(sql)).toThrow(/запрещ|SELECT INTO|только SELECT/i);
  });

  it("отклоняет несколько операторов", () => {
    expect(() => assertReadOnlySelect("SELECT 1; DELETE FROM t")).toThrow(
      /один оператор/i,
    );
  });
});
