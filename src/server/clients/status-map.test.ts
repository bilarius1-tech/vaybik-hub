import { describe, expect, it } from "vitest";
import {
  clientStatusToServiceStatus,
  resolveManageUrl,
  toChatContractStatus,
} from "./status-map";

describe("clients status-map", () => {
  it("маппит статус клиента в ClientService", () => {
    expect(clientStatusToServiceStatus("active")).toBe("active");
    expect(clientStatusToServiceStatus("paused")).toBe("paused");
    expect(clientStatusToServiceStatus("archived")).toBe("off");
  });

  it("resolveManageUrl подставляет externalId", () => {
    expect(
      resolveManageUrl(
        "https://chat-test.vaybik.ru/manage/clients/{externalId}",
        "abc/1",
      ),
    ).toBe("https://chat-test.vaybik.ru/manage/clients/abc%2F1");
    expect(resolveManageUrl(null, "x")).toBeNull();
    expect(resolveManageUrl("https://x", null)).toBeNull();
  });

  it("toChatContractStatus: ACTIVE / PAUSED / OFF / EXPIRED", () => {
    expect(
      toChatContractStatus({
        clientStatus: "active",
        serviceStatus: "active",
        activeUntil: new Date(Date.UTC(2027, 0, 1)),
        todayYmd: "2026-11-18",
      }),
    ).toBe("ACTIVE");

    expect(
      toChatContractStatus({
        clientStatus: "paused",
        serviceStatus: "active",
        activeUntil: new Date(Date.UTC(2027, 0, 1)),
        todayYmd: "2026-11-18",
      }),
    ).toBe("PAUSED");

    expect(
      toChatContractStatus({
        clientStatus: "active",
        serviceStatus: "off",
        activeUntil: null,
        todayYmd: "2026-11-18",
      }),
    ).toBe("OFF");

    expect(
      toChatContractStatus({
        clientStatus: "active",
        serviceStatus: "active",
        activeUntil: new Date(Date.UTC(2026, 10, 1)),
        todayYmd: "2026-11-18",
      }),
    ).toBe("EXPIRED");
  });
});
