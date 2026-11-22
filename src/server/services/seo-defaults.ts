/**
 * Шаблоны robots/llms/JSON-LD для доменного SEO сервисов.
 * YandexGPT — обязательный User-agent в шаблоне.
 */

export const SITE_CMS_SLUG = "vaybik-site-cms";

/** Не отдаём публичный SEO (region и т.п.). */
export const SEO_PUBLIC_DENY_SLUGS = new Set(["region"]);

export function defaultRobotsTxt(opts: {
  host: string;
  sitemapUrl: string;
  extraDisallow?: string[];
}): string {
  const disallow = [
    "/admin/",
    ...(opts.extraDisallow || []),
  ];
  const disallowLines = disallow.map((d) => `Disallow: ${d}`).join("\n");
  const agents = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Google-Extended",
    "Googlebot",
    "Bingbot",
    "YandexBot",
    "YandexAdditional",
    "YandexGPT",
    "Applebot-Extended",
    "CCBot",
    "*",
  ];
  const blocks = agents
    .map(
      (ua) =>
        `User-agent: ${ua}\nAllow: /\n${disallowLines}`,
    )
    .join("\n\n");
  return `${blocks}\n\nHost: ${opts.host}\nSitemap: ${opts.sitemapUrl}\n`;
}

export function defaultLlmsTxt(opts: {
  name: string;
  url: string;
  description?: string | null;
}): string {
  const desc =
    opts.description?.trim() ||
    `Сервис «${opts.name}» экосистемы Вайбик.`;
  return `# ${opts.name}\n\n> ${desc}\n\n- Сайт: ${opts.url}\n- Студия: https://vaybik.ru/\n`;
}

export function defaultJsonLd(opts: {
  name: string;
  url: string;
  description?: string | null;
  isProduct?: boolean;
}): unknown {
  const org = {
    "@type": "Organization",
    name: "Вайбик",
    url: "https://vaybik.ru",
  };
  if (!opts.isProduct) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        org,
        {
          "@type": "WebSite",
          name: opts.name,
          url: opts.url,
          description: opts.description || undefined,
          publisher: org,
        },
      ],
    };
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      {
        "@type": "WebApplication",
        name: opts.name,
        url: opts.url,
        description: opts.description || undefined,
        applicationCategory: "BusinessApplication",
        provider: org,
        isPartOf: { "@type": "WebSite", url: "https://vaybik.ru" },
      },
    ],
  };
}

/** Публичный origin хаба без /admin (для абсолютных URL иконок). */
export function hubOrigin(): string {
  const app = (process.env.APP_URL || "https://vaybik.ru/admin").replace(
    /\/$/,
    "",
  );
  return app.replace(/\/admin$/, "") || "https://vaybik.ru";
}

export function hubAdminBase(): string {
  return (process.env.APP_URL || "https://vaybik.ru/admin").replace(/\/$/, "");
}

export function publicServiceSeoUrl(slug: string): string {
  return `${hubAdminBase()}/api/public/services/${encodeURIComponent(slug)}/seo`;
}

export function publicServiceIconUrl(
  slug: string,
  file: string,
): string {
  return `${hubAdminBase()}/api/public/services/${encodeURIComponent(slug)}/icons/${file}`;
}
