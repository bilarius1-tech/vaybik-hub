import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hosts = await prisma.seoPage.findMany({
    where: { inSitemap: true },
    distinct: ["host"],
    select: { host: true },
  });

  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
    ...hosts.map(
      (h) =>
        `Sitemap: https://${h.host}/admin/api/public/sitemap.xml`,
    ),
  ];

  if (hosts.length === 0) {
    lines.push("Sitemap: https://vaybik.ru/admin/api/public/sitemap.xml");
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
