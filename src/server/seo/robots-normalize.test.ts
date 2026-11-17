import { describe, expect, it } from "vitest";
import { ensureAdminDisallow } from "./robots-normalize";

describe("ensureAdminDisallow", () => {
  it("добавляет Disallow: /admin/ в каждую группу", () => {
    const src = `User-agent: Googlebot
Allow: /

User-agent: *
Allow: /

Sitemap: https://vaybik.ru/sitemap.xml
`;
    const out = ensureAdminDisallow(src);
    expect(out).toMatch(/User-agent: Googlebot\nAllow: \/\nDisallow: \/admin\//);
    expect(out).toMatch(/User-agent: \*\nAllow: \/\nDisallow: \/admin\//);
    expect(out).toContain("Sitemap: https://vaybik.ru/sitemap.xml");
  });

  it("не дублирует, если уже есть", () => {
    const src = `User-agent: *\nAllow: /\nDisallow: /admin/\n`;
    const out = ensureAdminDisallow(src);
    expect(out.match(/Disallow: \/admin\//g)?.length).toBe(1);
  });
});
