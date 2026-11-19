import { describe, expect, it } from "vitest";
import { helpMarkdownToHtml } from "./help-markdown";

describe("helpMarkdownToHtml", () => {
  it("рендерит заголовки, списки, код и жирный", () => {
    const html = helpMarkdownToHtml(
      "# Title\n\n## Sub\n\n- **bold** item\n- `code`\n\n```html\n<script>x</script>\n```\n",
    );
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>");
    expect(html).toContain("<pre>");
    // script-тег из fence должен быть экранирован текстом, не исполняемым тегом
    expect(html).not.toMatch(/<script[\s>]/i);
  });

  it("не пропускает сырой HTML из markdown", () => {
    const html = helpMarkdownToHtml(
      'Hello <script>alert(1)</script> <img src=x onerror=alert(1)> [ok](https://vaybik.ru)',
    );
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain('href="https://vaybik.ru"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("рендерит GFM-таблицы", () => {
    const html = helpMarkdownToHtml(
      "| A | B |\n| --- | --- |\n| 1 | 2 |\n",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
    expect(html).toContain("<td>");
  });
});
