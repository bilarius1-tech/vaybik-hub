import { describe, expect, it } from "vitest";
import { normalizePagePath, pagePathSchema } from "./path";

describe("pagePathSchema", () => {
  it("принимает / и вложенные пути", () => {
    expect(pagePathSchema.parse("/")).toBe("/");
    expect(pagePathSchema.parse("/uslugi/landing/")).toBe("/uslugi/landing/");
  });

  it("отклоняет без слэша в конце и /admin", () => {
    expect(() => pagePathSchema.parse("/x")).toThrow();
    expect(() => pagePathSchema.parse("/admin/x/")).toThrow();
  });
});

describe("normalizePagePath", () => {
  it("добавляет слэши", () => {
    expect(normalizePagePath("uslugi")).toBe("/uslugi/");
    expect(normalizePagePath("/x")).toBe("/x/");
    expect(normalizePagePath("/")).toBe("/");
  });
});
