import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml, sanitizeSvgIcon } from "./sanitize";

describe("sanitizeCmsHtml", () => {
  it("убирает script", () => {
    const out = sanitizeCmsHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
  });

  it("убирает iframe", () => {
    const out = sanitizeCmsHtml('<iframe src="https://evil.test"></iframe><b>x</b>');
    expect(out).not.toContain("iframe");
    expect(out).toContain("<b>x</b>");
  });

  it("убирает on*-атрибуты", () => {
    const out = sanitizeCmsHtml('<a href="/x" onclick="alert(1)">link</a>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain('href="/x"');
  });

  it("блокирует javascript:-ссылки", () => {
    const out = sanitizeCmsHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it("убирает style-атрибуты", () => {
    const out = sanitizeCmsHtml('<p style="color:red" class="ok">t</p>');
    expect(out).not.toMatch(/style=/i);
    expect(out).toContain('class="ok"');
  });

  it("сохраняет data-* и классы", () => {
    const out = sanitizeCmsHtml(
      '<section class="sec alt" data-magic-rings=\'{"a":1}\' id="faq">x</section>',
    );
    expect(out).toContain('class="sec alt"');
    expect(out).toContain("data-magic-rings");
    expect(out).toContain('id="faq"');
  });

  it("разрешает SVG path", () => {
    const out = sanitizeCmsHtml(
      '<svg viewBox="0 0 24 24"><path d="M1 2" fill="none" stroke="currentColor"/></svg>',
    );
    expect(out).toContain("<svg");
    expect(out).toContain("<path");
    expect(out).toContain('d="M1 2"');
  });
});

describe("sanitizeSvgIcon", () => {
  it("оставляет только SVG", () => {
    const out = sanitizeSvgIcon(
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg><script>x</script>',
    );
    expect(out).toContain("<circle");
    expect(out).not.toContain("script");
  });
});
