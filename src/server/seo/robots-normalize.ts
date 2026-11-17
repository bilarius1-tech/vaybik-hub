/**
 * Гарантирует Disallow: /admin/ в каждом блоке User-agent robots.txt.
 * Боты со своим UA игнорируют группу `*`, поэтому правило нужно везде.
 */
export function ensureAdminDisallow(text: string): string {
  const raw = text.replace(/\r\n/g, "\n").trimEnd();
  if (!raw.trim()) {
    return `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: https://vaybik.ru/sitemap.xml\n`;
  }

  const parts = raw.split(/(?=^User-agent:\s*)/m).filter((p) => p.trim());
  const out: string[] = [];

  for (const part of parts) {
    if (!/^User-agent:/im.test(part)) {
      out.push(part.trimEnd());
      continue;
    }
    const lines = part.replace(/\n+$/, "").split("\n");
    const hasAdmin = lines.some((l) =>
      /^\s*Disallow:\s*\/admin\/?\s*$/i.test(l),
    );
    if (!hasAdmin) {
      // после Allow: / или в конец блока перед пустой строкой
      let inserted = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*Allow:\s*\/\s*$/i.test(lines[i]!)) {
          lines.splice(i + 1, 0, "Disallow: /admin/");
          inserted = true;
          break;
        }
      }
      if (!inserted) lines.push("Disallow: /admin/");
    }
    out.push(lines.join("\n"));
  }

  let result = out.join("\n\n").replace(/\n{3,}/g, "\n\n");
  if (!/Sitemap:/i.test(result)) {
    result += `\n\nSitemap: https://vaybik.ru/sitemap.xml`;
  }
  return result.endsWith("\n") ? result : `${result}\n`;
}
