import { describe, expect, it, vi } from "vitest";
import { renderMediaPicture } from "./media";

describe("renderMediaPicture", () => {
  it("строит picture/srcset", () => {
    const warn = vi.fn();
    const html = renderMediaPicture(
      { mediaId: "cabcdefghijklmnopqrstuv", alt: "кот" },
      {
        mediaBase: "/media",
        mediaById: new Map([
          [
            "cabcdefghijklmnopqrstuv",
            {
              id: "cabcdefghijklmnopqrstuv",
              version: 2,
              alt: "кот",
              width: 800,
              height: 600,
              variants: [
                { name: "w480", w: 480, h: 360, file: "w480.webp", size: 1, mime: "image/webp" },
                { name: "w960", w: 960, h: 720, file: "w960.webp", size: 1, mime: "image/webp" },
                { name: "orig", w: 800, h: 600, file: "orig.jpg", size: 1, mime: "image/jpeg" },
              ],
            },
          ],
        ]),
        warn,
      },
    );
    expect(html).toContain("<picture>");
    expect(html).toContain("w480.webp 480w");
    expect(html).toContain("/media/cabcdefghijklmnopqrstuv/v2/orig.jpg");
    expect(html).toContain('alt="кот"');
    expect(warn).not.toHaveBeenCalled();
  });

  it("без ассета — пусто и warn", () => {
    const warn = vi.fn();
    const html = renderMediaPicture(
      { mediaId: "missing" },
      { mediaBase: "/media", mediaById: new Map(), warn },
    );
    expect(html).toBe("");
    expect(warn).toHaveBeenCalled();
  });
});
