import { describe, expect, it } from "vitest";
import {
  clientStatusToChat,
  clientStatusToServiceStatus,
  resolveManageUrl,
} from "./status-map";

describe("client status map", () => {
  it("маппит статус клиента в чат", () => {
    expect(clientStatusToChat("active")).toBe("active");
    expect(clientStatusToChat("paused")).toBe("paused");
    expect(clientStatusToChat("archived")).toBe("off");
  });

  it("маппит статус клиента в ClientService", () => {
    expect(clientStatusToServiceStatus("active")).toBe("active");
    expect(clientStatusToServiceStatus("paused")).toBe("paused");
    expect(clientStatusToServiceStatus("archived")).toBe("off");
  });

  it("подставляет externalId в manageUrl", () => {
    expect(
      resolveManageUrl(
        "https://chat-test.vaybik.ru/manage/clients/{externalId}",
        "abc/1",
      ),
    ).toBe("https://chat-test.vaybik.ru/manage/clients/abc%2F1");
    expect(resolveManageUrl(null, "x")).toBeNull();
    expect(resolveManageUrl("https://x", null)).toBeNull();
  });
});
