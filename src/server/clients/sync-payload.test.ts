import { describe, expect, it } from "vitest";
import { buildChatUpsertPayload } from "./sync-payload";

describe("buildChatUpsertPayload", () => {
  const client = { id: "c1", name: "Тест", status: "active" as const };
  const link = {
    status: "active" as const,
    activeFrom: new Date(Date.UTC(2026, 0, 1)),
    activeUntil: new Date(Date.UTC(2027, 0, 18)),
    paymentNote: "12к",
  };

  it("по умолчанию не кладёт null-даты (sync имени не затирает чат)", () => {
    const empty = buildChatUpsertPayload(client, {
      status: "active",
      activeFrom: null,
      activeUntil: null,
      paymentNote: null,
    });
    expect(empty).toEqual({
      hubClientId: "c1",
      name: "Тест",
      status: "ACTIVE",
    });
    expect("activeFrom" in empty).toBe(false);
    expect("activeUntil" in empty).toBe(false);
  });

  it("с датами включает их в тело", () => {
    const p = buildChatUpsertPayload(client, link, { todayYmd: "2026-11-18" });
    expect(p.activeFrom).toBe("2026-01-01");
    expect(p.activeUntil).toBe("2027-01-18");
    expect(p.paymentNote).toBe("12к");
    expect(p.status).toBe("ACTIVE");
  });

  it("includePeriodNulls позволяет очистить срок", () => {
    const p = buildChatUpsertPayload(
      client,
      {
        status: "active",
        activeFrom: null,
        activeUntil: null,
        paymentNote: null,
      },
      { includePeriodNulls: true, todayYmd: "2026-11-18" },
    );
    expect(p.activeFrom).toBeNull();
    expect(p.activeUntil).toBeNull();
    expect(p.paymentNote).toBeNull();
  });
});
