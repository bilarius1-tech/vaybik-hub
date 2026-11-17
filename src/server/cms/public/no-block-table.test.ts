import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public site не читает таблицу Block", () => {
  it("load.ts и site/server.ts не обращаются к prisma.block", () => {
    const roots = [
      path.join(process.cwd(), "src/server/cms/public/load.ts"),
      path.join(process.cwd(), "src/site/server.ts"),
    ];
    for (const file of roots) {
      const src = readFileSync(file, "utf8");
      // ищем реальные вызовы ORM, не комментарии
      expect(src).not.toMatch(/\bprisma\.block\b/);
      expect(src).not.toMatch(/\bsitePrisma\.block\b/);
      expect(src).not.toMatch(/\bdb\.block\.(find|create|update|delete)/);
      expect(src).not.toMatch(/include:\s*\{\s*blocks:/);
    }
  });
});
