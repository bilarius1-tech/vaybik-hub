import { describe, expect, it } from "vitest";
import {
  chatStudioSsoHref,
  parseChatClientIdFromNext,
  resolveChatManageSsoHref,
  sanitizeChatManagePath,
} from "./studio-sso";

describe("studio-sso paths", () => {
  it("sanitizeChatManagePath", () => {
    expect(sanitizeChatManagePath("/manage/help")).toBe("/manage/help");
    expect(
      sanitizeChatManagePath("/manage/clients/abc123"),
    ).toBe("/manage/clients/abc123");
    expect(sanitizeChatManagePath("//evil")).toBeNull();
    expect(sanitizeChatManagePath("https://evil/x")).toBeNull();
    expect(sanitizeChatManagePath("/admin")).toBeNull();
    expect(sanitizeChatManagePath("/manage/login")).toBeNull();
  });

  it("parseChatClientIdFromNext", () => {
    expect(parseChatClientIdFromNext("/manage/clients/cmx123")).toBe("cmx123");
    expect(parseChatClientIdFromNext("/manage/help")).toBeNull();
    expect(parseChatClientIdFromNext("/manage/clients/../x")).toBeNull();
  });

  it("resolveChatManageSsoHref", () => {
    expect(
      resolveChatManageSsoHref(
        "https://chat.vaybik.ru/manage/clients/{externalId}",
        "cid1",
      ),
    ).toBe("/sso/chat?next=%2Fmanage%2Fclients%2Fcid1");
    expect(resolveChatManageSsoHref(null, "x")).toBeNull();
    expect(chatStudioSsoHref("/manage")).toBe("/sso/chat?next=%2Fmanage");
  });
});
