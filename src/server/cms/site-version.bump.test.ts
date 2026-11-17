import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

/** Мутации, которые обязаны повышать site.contentVersion */
const MUST_BUMP = [
  "src/app/api/cms/pages/[id]/publish/route.ts",
  "src/app/api/cms/pages/[id]/unpublish/route.ts",
  "src/app/api/cms/nav/route.ts",
  "src/app/api/cms/redirects/route.ts",
  "src/app/api/cms/redirects/[id]/route.ts",
  "src/app/api/seo/pages/route.ts",
  "src/app/api/seo/pages/[id]/route.ts",
  "src/app/api/settings/contacts/route.ts",
  "src/app/api/cms/media/[id]/route.ts",
  "src/app/api/cms/media/[id]/replace/route.ts",
];

describe("bumpSiteVersion на мутациях сайта", () => {
  it("ключевые роуты вызывают bump (прямо или через сервис)", () => {
    for (const rel of MUST_BUMP) {
      const file = path.join(process.cwd(), rel);
      const src = readFileSync(file, "utf8");
      const ok =
        src.includes("bumpSiteVersion") ||
        src.includes("publishPage") ||
        src.includes("unpublishPage");
      expect(ok, `${rel} должен bump'ать версию сайта`).toBe(true);
    }
  });

  it("в api/cms есть хотя бы несколько вызовов bump", () => {
    const files = walk(path.join(process.cwd(), "src/app/api"));
    let hits = 0;
    for (const f of files) {
      if (readFileSync(f, "utf8").includes("bumpSiteVersion")) hits += 1;
    }
    expect(hits).toBeGreaterThanOrEqual(6);
  });
});
