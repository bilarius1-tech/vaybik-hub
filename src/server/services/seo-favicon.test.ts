import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { pngToIco } from "./seo-favicon";

describe("pngToIco", () => {
  it("собирает ICO с PNG-payload", async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 255, g: 138, b: 31, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const ico = pngToIco(png);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(1);
    expect(ico.length).toBe(22 + png.length);
    expect(ico.subarray(22).equals(png)).toBe(true);
  });
});
