import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sanitizeHubNext } from "./safe-next";

describe("sanitizeHubNext", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.APP_URL = "https://vaybik.ru/admin";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("принимает относительные пути с query", () => {
    expect(sanitizeHubNext("/sso/chat?next=%2Fmanage%2Fhelp")).toBe(
      "/sso/chat?next=%2Fmanage%2Fhelp",
    );
    expect(sanitizeHubNext("/clients")).toBe("/clients");
  });

  it("отклоняет open-redirect и login-loop", () => {
    expect(sanitizeHubNext("//evil")).toBeNull();
    expect(sanitizeHubNext("https://evil.example/x")).toBeNull();
    expect(sanitizeHubNext("/login")).toBeNull();
    expect(sanitizeHubNext("clients")).toBeNull();
  });

  it("нормализует абсолютный URL хаба с /admin", () => {
    expect(
      sanitizeHubNext("https://vaybik.ru/admin/sso/chat?next=/manage"),
    ).toBe("/sso/chat?next=/manage");
  });
});
