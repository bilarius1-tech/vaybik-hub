import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processMediaBuffer, MEDIA_MAX_BYTES } from "./process";

describe("processMediaBuffer", () => {
  it("отклоняет неизвестный MIME", async () => {
    await expect(processMediaBuffer(Buffer.from("not-an-image"), "x.bin")).rejects.toMatchObject({
      code: "MIME",
    });
  });

  it("отклоняет слишком большой файл", async () => {
    const buf = Buffer.alloc(MEDIA_MAX_BYTES + 1, 0xff);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    await expect(processMediaBuffer(buf, "big.jpg")).rejects.toMatchObject({
      code: "TOO_LARGE",
    });
  });

  it("делает webp-варианты и убирает EXIF у jpeg", async () => {
    const jpeg = await sharp({
      create: { width: 800, height: 400, channels: 3, background: "#ff8a1f" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
      .toBuffer();

    const result = await processMediaBuffer(jpeg, "photo.jpg");
    expect(result.kind).toBe("IMAGE");
    expect(result.variants.some((v) => v.name === "w480")).toBe(true);
    expect(result.files.has("orig.jpg")).toBe(true);
    const meta = await sharp(result.files.get("orig.jpg")!).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("GIF сохраняет orig.gif и preview.webp", async () => {
    // минимальный 1x1 GIF89a
    const gif = Buffer.from(
      "47494638396101000100800000ffffff00000021f90401000001002c000000000100010000020144003b",
      "hex",
    );
    const result = await processMediaBuffer(gif, "a.gif");
    expect(result.kind).toBe("GIF");
    expect(result.files.has("orig.gif")).toBe(true);
    expect(result.files.has("preview.webp")).toBe(true);
    // orig байты совпадают — анимация сохранена
    expect(result.files.get("orig.gif")!.equals(gif)).toBe(true);
  });

  it("SVG проходит санитайзер", async () => {
    const svg = Buffer.from(
      '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><script>x</script><circle cx="5" cy="5" r="4"/></svg>',
      "utf8",
    );
    const result = await processMediaBuffer(svg, "i.svg");
    expect(result.kind).toBe("SVG");
    const text = result.files.get("orig.svg")!.toString("utf8");
    expect(text).not.toContain("script");
    expect(text).toContain("circle");
  });
});
