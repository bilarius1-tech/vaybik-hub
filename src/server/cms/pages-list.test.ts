import { describe, expect, it } from "vitest";
import {
  parsePageSize,
  parsePageSort,
} from "./pages-list";

describe("parsePageSort", () => {
  it("по умолчанию — updatedAt desc", () => {
    expect(parsePageSort(undefined)).toEqual({
      key: "updatedAt",
      dir: "desc",
    });
    expect(parsePageSort("")).toEqual({ key: "updatedAt", dir: "desc" });
  });

  it("парсит -path и path", () => {
    expect(parsePageSort("-path")).toEqual({ key: "path", dir: "desc" });
    expect(parsePageSort("title")).toEqual({ key: "title", dir: "asc" });
  });

  it("неизвестный ключ → updatedAt desc", () => {
    expect(parsePageSort("foo")).toEqual({ key: "updatedAt", dir: "desc" });
  });
});

describe("parsePageSize", () => {
  it("допускает 25/50/100, иначе 25", () => {
    expect(parsePageSize(25)).toBe(25);
    expect(parsePageSize("50")).toBe(50);
    expect(parsePageSize(100)).toBe(100);
    expect(parsePageSize(7)).toBe(25);
    expect(parsePageSize(null)).toBe(25);
  });
});
