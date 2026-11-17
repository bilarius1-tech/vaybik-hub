import { describe, expect, it } from "vitest";
import { isPublicPage } from "./visibility";

describe("isPublicPage", () => {
  it("DRAFT с publishedRevisionId — публична", () => {
    expect(
      isPublicPage({
        publishedRevisionId: "rev1",
        status: "DRAFT",
        deletedAt: null,
      }),
    ).toBe(true);
  });

  it("PUBLISHED с ревизией — публична", () => {
    expect(
      isPublicPage({
        publishedRevisionId: "rev1",
        status: "PUBLISHED",
        deletedAt: null,
      }),
    ).toBe(true);
  });

  it("ARCHIVED — не публична", () => {
    expect(
      isPublicPage({
        publishedRevisionId: "rev1",
        status: "ARCHIVED",
        deletedAt: null,
      }),
    ).toBe(false);
  });

  it("без ревизии — не публична", () => {
    expect(
      isPublicPage({
        publishedRevisionId: null,
        status: "PUBLISHED",
        deletedAt: null,
      }),
    ).toBe(false);
  });

  it("в корзине — не публична", () => {
    expect(
      isPublicPage({
        publishedRevisionId: "rev1",
        status: "PUBLISHED",
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });
});
