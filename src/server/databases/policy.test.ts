import { describe, expect, it } from "vitest";
import {
  assertConnectionNotBlocked,
  assertRestoreTargetAllowed,
  isProdAdminDatabase,
} from "./policy";

const base = {
  id: "1",
  slug: "admin",
  name: "Админка Вайбик",
  engine: "postgres",
  host: "postgres",
  port: 5432,
  database: "vaybik_admin",
  secretId: null,
  isSystem: true,
  backupSchedule: null,
  retention: 14,
  externalStorage: null,
  lastSizeBytes: null,
  lastTableCount: null,
  lastPgVersion: null,
  lastInspectedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("restore policy", () => {
  it("разрешает только target=test при верном имени", () => {
    expect(() =>
      assertRestoreTargetAllowed({
        target: "test",
        connection: base,
        confirmName: "Админка Вайбик",
      }),
    ).not.toThrow();
  });

  it("запрещает цель, отличную от test", () => {
    expect(() =>
      assertRestoreTargetAllowed({
        target: "prod",
        connection: base,
        confirmName: "Админка Вайбик",
      }),
    ).toThrow(/тестовый/);
  });

  it("требует точное имя", () => {
    expect(() =>
      assertRestoreTargetAllowed({
        target: "test",
        connection: base,
        confirmName: "не то",
      }),
    ).toThrow(/точное имя/);
  });

  it("блокирует region в имени/хосте", () => {
    expect(() =>
      assertConnectionNotBlocked({
        host: "region-db",
        name: "x",
        slug: "x",
        database: "bitrix",
      }),
    ).toThrow(/region/);
  });

  it("isProdAdminDatabase для system", () => {
    expect(isProdAdminDatabase(base)).toBe(true);
  });
});
