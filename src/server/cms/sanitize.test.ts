import { describe, expect, it } from "vitest";
import {
  sanitizeCmsHtml,
  sanitizeRichText,
  sanitizeSvgFile,
  sanitizeSvgIcon,
} from "./sanitize";

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

  it("сохраняет viewBox (регистр)", () => {
    const out = sanitizeCmsHtml(
      '<svg class="ic" width="18" height="18" viewBox="0 0 24 24"><path d="M1 2"/></svg>',
    );
    expect(out).toMatch(/viewBox="0 0 24 24"/i);
    expect(out).not.toMatch(/onclick/i);
  });

  it("по-прежнему режет on*, style и javascript:", () => {
    const out = sanitizeCmsHtml(
      '<a href="javascript:alert(1)" onclick="x" style="color:red">t</a><svg viewBox="0 0 1 1" onclick="y"></svg>',
    );
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/style=/i);
  });
});

describe("sanitizeSvgIcon viewBox", () => {
  it("сохраняет viewBox", () => {
    const out = sanitizeSvgIcon(
      '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M1 2"/></svg>',
    );
    expect(out).toMatch(/viewBox="0 0 24 24"/i);
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

describe("sanitizeSvgFile", () => {
  it("убирает script и foreignObject", () => {
    const out = sanitizeSvgFile(
      '<svg viewBox="0 0 10 10"><script>alert(1)</script><foreignObject><div/></foreignObject><circle cx="1" cy="1" r="1"/></svg>',
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("foreignObject");
    expect(out).toContain("circle");
  });

  it("блокирует внешний use href", () => {
    const out = sanitizeSvgFile(
      '<svg><use href="https://evil.test/x.svg#a"/></svg>',
    );
    expect(out).not.toMatch(/https:\/\/evil/);
  });

  it("оставляет внутренний use #id", () => {
    const out = sanitizeSvgFile('<svg><use href="#icon"/></svg>');
    expect(out).toContain('href="#icon"');
  });

  it("блокирует javascript в xlink:href", () => {
    const out = sanitizeSvgFile(
      '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
    );
    expect(out).not.toMatch(/javascript:/i);
  });
});

describe("sanitizeRichText", () => {
  it("basic: убирает h2 и img", () => {
    const out = sanitizeRichText(
      '<h2>t</h2><p>ok</p><img src="/x" alt="">',
      "basic",
    );
    expect(out).not.toContain("<h2");
    expect(out).not.toContain("<img");
    expect(out).toContain("<p>ok</p>");
  });

  it("блокирует javascript: и data:", () => {
    const out = sanitizeRichText(
      '<a href="javascript:alert(1)">a</a><a href="data:text/html,x">b</a>',
      "inline",
    );
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/data:/i);
  });

  it("target=_blank → rel noopener noreferrer", () => {
    const out = sanitizeRichText(
      '<a href="https://ex.test" target="_blank">x</a>',
      "inline",
    );
    expect(out).toContain('target="_blank"');
    expect(out).toMatch(/rel="[^"]*noopener/);
    expect(out).toMatch(/noreferrer/);
  });

  it("full: img с data-media-id", () => {
    const out = sanitizeRichText(
      '<p><img data-media-id="m1" src="/admin/api/public/media/m1/v1/orig.jpg" alt="a" onclick="x"></p>',
      "full",
    );
    expect(out).toContain('data-media-id="m1"');
    expect(out).toContain('alt="a"');
    expect(out).toContain('loading="lazy"');
    expect(out).not.toMatch(/onclick/i);
  });

  it("убирает style и iframe", () => {
    const out = sanitizeRichText(
      '<p style="color:red">t</p><iframe src="https://x"></iframe>',
      "basic",
    );
    expect(out).not.toMatch(/style=/i);
    expect(out).not.toContain("iframe");
  });
});
