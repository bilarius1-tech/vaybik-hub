import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractMainBlocks } from "./recognize";

const FIX = join(process.cwd(), "src/server/cms/import/fixtures");

describe("extractMainBlocks", () => {
  it("распознаёт hero и faq из фикстуры", () => {
    const html = readFileSync(join(FIX, "mini-home.html"), "utf8");
    const { blocks, rawHtmlCount } = extractMainBlocks(html);
    expect(blocks.some((b) => b.type === "hero")).toBe(true);
    expect(blocks.some((b) => b.type === "faq")).toBe(true);
    expect(blocks.some((b) => b.type === "steps")).toBe(true);
    expect(rawHtmlCount).toBeLessThanOrEqual(1);
  });

  it("неизвестную секцию кладёт в rawHtml", () => {
    const html = readFileSync(join(FIX, "unknown-section.html"), "utf8");
    const { blocks } = extractMainBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("rawHtml");
  });
});
