import { describe, expect, it } from "vitest";
import { mediaRefSchema, faqClientSchema } from "./cms-block-schemas";

describe("mediaRefSchema", () => {
  it("строку превращает в { src }", () => {
    expect(mediaRefSchema.parse("/img/a.webp")).toEqual({
      src: "/img/a.webp",
      mediaId: null,
      alt: null,
    });
  });

  it("принимает объект", () => {
    expect(
      mediaRefSchema.parse({ mediaId: "m1", alt: "x" }),
    ).toMatchObject({ mediaId: "m1", alt: "x" });
  });
});

describe("faqClientSchema", () => {
  it("валидирует вопрос", () => {
    const r = faqClientSchema.safeParse({
      items: [{ question: "", answerHtml: "<p>a</p>" }],
    });
    expect(r.success).toBe(false);
  });
});
