import { describe, expect, it } from "vitest";
import { validateRedirect } from "./redirects";

const base = {
  fromPath: "/old/",
  toPath: "/new/",
  match: "EXACT" as const,
  isActive: true,
};

describe("validateRedirect", () => {
  it("отклоняет from === to", () => {
    const r = validateRedirect({ ...base, toPath: "/old/" }, []);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/совпадать/);
  });

  it("отклоняет дубль fromPath", () => {
    const r = validateRedirect(base, [{ ...base, id: "1" }]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/уже есть/);
  });

  it("предупреждает о цепочке и предлагает спрямление", () => {
    const r = validateRedirect(base, [
      {
        id: "1",
        fromPath: "/new/",
        toPath: "/final/",
        match: "EXACT",
        isActive: true,
      },
    ]);
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBe(1);
    expect(r.suggestedToPath).toBe("/final/");
  });

  it("отклоняет пересекающиеся PREFIX", () => {
    const r = validateRedirect(
      {
        fromPath: "/leadweb/",
        toPath: "/",
        match: "PREFIX",
        isActive: true,
      },
      [
        {
          id: "1",
          fromPath: "/leadweb/old/",
          toPath: "/",
          match: "PREFIX",
          isActive: true,
        },
      ],
    );
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/пересекается/);
  });

  it("отклоняет петлю", () => {
    const r = validateRedirect(base, [
      {
        id: "1",
        fromPath: "/new/",
        toPath: "/old/",
        match: "EXACT",
        isActive: true,
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /петля/.test(e))).toBe(true);
  });
});
