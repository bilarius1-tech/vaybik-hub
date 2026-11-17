import { describe, expect, it } from "vitest";
import {
  locationWithQuery,
  matchRedirect,
  type RedirectRule,
} from "./redirects";

const rules: RedirectRule[] = [
  {
    id: "1",
    fromPath: "/old/",
    toPath: "/new/",
    code: 301,
    match: "EXACT",
  },
  {
    id: "2",
    fromPath: "/blog/",
    toPath: "/news/",
    code: 302,
    match: "PREFIX",
  },
  {
    id: "3",
    fromPath: "/loop/",
    toPath: "/loop/",
    code: 301,
    match: "EXACT",
  },
];

describe("matchRedirect", () => {
  it("exact", () => {
    expect(matchRedirect("/old/", rules)).toEqual({
      to: "/new/",
      code: 301,
      id: "1",
    });
  });

  it("prefix + хвост", () => {
    expect(matchRedirect("/blog/2024/post/", rules)).toEqual({
      to: "/news/2024/post/",
      code: 302,
      id: "2",
    });
  });

  it("петля exact пропускается", () => {
    expect(matchRedirect("/loop/", rules)).toBeNull();
  });
});

describe("locationWithQuery", () => {
  it("сохраняет query", () => {
    expect(locationWithQuery("/new/", "?a=1")).toBe("/new/?a=1");
  });

  it("относительный Location без host", () => {
    expect(locationWithQuery("/new/", "")).toBe("/new/");
  });
});
