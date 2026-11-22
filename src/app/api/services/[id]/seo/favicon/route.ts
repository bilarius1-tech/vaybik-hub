import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { ensureServiceSeo } from "@/server/services/seo";
import { generateServiceFavicons } from "@/server/services/seo-favicon";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { SITE_CMS_SLUG } from "@/server/services/seo-defaults";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("services.manage");
    const { id } = await ctx.params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) return jsonError("NOT_FOUND", "Сервис не найден", 404);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("VALIDATION", "Нужен файл file", 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    await ensureServiceSeo(prisma, service);
    const generated = await generateServiceFavicons({
      serviceId: service.id,
      source: buf,
      mime: file.type || "application/octet-stream",
      name: service.name,
      shortName: service.slug,
    });
    const seo = await prisma.serviceSeo.update({
      where: { serviceId: service.id },
      data: {
        faviconSourceFile: generated.sourceFile,
        faviconSourceMime: generated.sourceMime,
        faviconGeneratedAt: new Date(),
      },
    });
    if (service.slug === SITE_CMS_SLUG) {
      await bumpSiteVersion(prisma, "service-seo.favicon");
    }
    await writeAudit({
      actorId: auth.user.id,
      action: "service.seo_favicon",
      entity: "ServiceSeo",
      entityId: seo.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ seo, files: generated.files });
  } catch (err) {
    if (err instanceof Error && /Favicon|SVG|PNG|JPEG|WebP|большой/i.test(err.message)) {
      return jsonError("VALIDATION", err.message, 400);
    }
    return handleRouteError(err);
  }
}
