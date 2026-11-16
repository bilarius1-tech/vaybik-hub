import { assertSafeFetchUrl } from "@/server/services/ssrf";

export type InspectResult = {
  url: string;
  status: number | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  errors: string[];
};

function metaContent(html: string, nameOrProp: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["']`,
    "i",
  );
  return html.match(re)?.[1] || html.match(re2)?.[1] || null;
}

export async function inspectPage(rawUrl: string): Promise<InspectResult> {
  const url = await assertSafeFetchUrl(rawUrl);
  const errors: string[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "vaybik-hub-seo-inspect/1.0" },
      redirect: "follow",
    });
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
    const description = metaContent(html, "description");
    const robots = metaContent(html, "robots");
    const canonical =
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
      null;
    const ogTitle = metaContent(html, "og:title");
    const ogDescription = metaContent(html, "og:description");
    const ogImage = metaContent(html, "og:image");

    if (!title) errors.push("Нет <title>");
    if (!description) errors.push("Нет meta description");
    if (title && title.length > 60) errors.push(`Title длинный: ${title.length}`);
    if (description && description.length > 160) {
      errors.push(`Description длинный: ${description.length}`);
    }

    return {
      url: url.toString(),
      status: res.status,
      title,
      description,
      canonical,
      robots,
      ogTitle,
      ogDescription,
      ogImage,
      errors,
    };
  } finally {
    clearTimeout(timer);
  }
}
