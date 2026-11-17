import { describe, expect, it } from "vitest";
import {
  connectionUriWithoutQuery,
  parseDatabaseUrl,
  pgEnvFromUrl,
  redactSecrets,
  sanitizePgError,
} from "./pg-url";

describe("parseDatabaseUrl", () => {
  it("убирает ?schema=public и отдаёт части подключения", () => {
    const url =
      "postgresql://hub:s3cret@postgres:5432/vaybik_hub?schema=public&connection_limit=5";
    const parts = parseDatabaseUrl(url);
    expect(parts).toEqual({
      host: "postgres",
      port: "5432",
      user: "hub",
      password: "s3cret",
      database: "vaybik_hub",
    });
    const env = pgEnvFromUrl(url);
    expect(env.PGDATABASE).toBe("vaybik_hub");
    expect(env.PGPASSWORD).toBe("s3cret");
    expect(env.PGHOST).toBe("postgres");
    expect(Object.values(env).join(" ")).not.toContain("schema");
  });

  it("декодирует percent-encoding в пароле", () => {
    const parts = parseDatabaseUrl(
      "postgresql://u:p%40ss%2Fword@127.0.0.1:5433/db",
    );
    expect(parts.password).toBe("p@ss/word");
    expect(parts.port).toBe("5433");
  });

  it("connectionUriWithoutQuery без schema", () => {
    const uri = connectionUriWithoutQuery(
      "postgresql://u:p@h:5432/d?schema=public",
    );
    expect(uri).toBe("postgresql://u:p@h:5432/d");
    expect(uri).not.toContain("schema");
  });
});

describe("sanitizePgError", () => {
  it("не содержит URI и пароль в тексте ошибки", () => {
    const uri = "postgresql://hub:SuperSecret99@postgres:5432/vaybik_hub?schema=public";
    const err = Object.assign(new Error(`Command failed: pg_dump ${uri}`), {
      code: 1,
      stderr: `pg_dump: error: could not connect to ${uri} password=SuperSecret99`,
    });
    const safe = sanitizePgError(err, { database: "vaybik_hub" });
    expect(safe.message).toContain("БД=vaybik_hub");
    expect(safe.message).toContain("code=1");
    expect(safe.message).not.toContain("SuperSecret99");
    expect(safe.message).not.toContain("postgresql://");
    expect(safe.message).not.toContain("hub:");
    expect(redactSecrets(uri)).toBe("[redacted-uri]");
  });
});
