import { describe, expect, it } from "vitest";
import {
  leadsStudioSsoHref,
  sanitizeLeadsManagePath,
} from "./studio-sso";

describe("leads studio-sso paths", () => {
  it("sanitizeLeadsManagePath", () => {
    expect(sanitizeLeadsManagePath("/manage")).toBe("/manage");
    expect(sanitizeLeadsManagePath("/manage/settings")).toBe(
      "/manage/settings",
    );
    expect(sanitizeLeadsManagePath("//evil")).toBeNull();
    expect(sanitizeLeadsManagePath("https://evil/x")).toBeNull();
    expect(sanitizeLeadsManagePath("/admin")).toBeNull();
    expect(sanitizeLeadsManagePath("/manage/login")).toBeNull();
  });

  it("leadsStudioSsoHref", () => {
    expect(leadsStudioSsoHref("/manage")).toBe(
      "/sso/leads?next=%2Fmanage",
    );
    expect(leadsStudioSsoHref("/manage/foo")).toBe(
      "/sso/leads?next=%2Fmanage%2Ffoo",
    );
  });
});
