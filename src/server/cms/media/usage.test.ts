import { describe, expect, it } from "vitest";
import { collectMediaRefs } from "./usage";

describe("collectMediaRefs", () => {
  it("находит mediaId в объектах", () => {
    const refs = collectMediaRefs("team", {
      people: [{ photo: { mediaId: "m1", alt: "a" } }],
    });
    expect(refs).toEqual([{ mediaId: "m1", field: "people.0.photo" }]);
  });

  it("находит data-media-id в HTML", () => {
    const refs = collectMediaRefs("text", {
      html: '<p><img data-media-id="m2" src="/x" alt=""></p>',
    });
    expect(refs.some((r) => r.mediaId === "m2")).toBe(true);
  });

  it("дедуплицирует", () => {
    const refs = collectMediaRefs("x", {
      a: { mediaId: "m1" },
      b: { mediaId: "m1" },
    });
    expect(refs.filter((r) => r.mediaId === "m1")).toHaveLength(2);
  });
});
