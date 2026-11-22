import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { seoCountersSchema } from "@/server/seo/schemas";
import { SITE_CMS_SLUG } from "@/server/services/seo-defaults";
import { ensureServiceSeo, updateServiceSeo } from "@/server/services/seo";

const KEY = "seo.counters";

export async function GET() {
  try {
    await requireCan("settings.manage");
    const site = await prisma.service.findUnique({
      where: { slug: SITE_CMS_SLUG },
    });
    if (site) {
      const seo = await ensureServiceSeo(prisma, site);
      return jsonOk({
        counters: {
          yandexWebmaster: seo.yandexWebmaster,
          yandexMetrika: seo.yandexMetrika,
          googleSearchConsole: seo.googleSearchConsole,
          googleAnalytics: seo.googleAnalytics,
        },
      });
    }
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    return jsonOk({ counters: row?.value ?? {} });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = seoCountersSchema.parse(await req.json());
    const site = await prisma.service.findUnique({
      where: { slug: SITE_CMS_SLUG },
    });
    if (site) {
      const seo = await updateServiceSeo(
        prisma,
        site.id,
        {
          yandexWebmaster: body.yandexWebmaster,
          yandexMetrika: body.yandexMetrika,
          googleSearchConsole: body.googleSearchConsole,
          googleAnalytics: body.googleAnalytics,
        },
        ctx.user.id,
      );
      await writeAudit({
        actorId: ctx.user.id,
        action: "seo.counters_update",
        entity: "ServiceSeo",
        entityId: seo.id,
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonOk({
        counters: {
          yandexWebmaster: seo.yandexWebmaster,
          yandexMetrika: seo.yandexMetrika,
          googleSearchConsole: seo.googleSearchConsole,
          googleAnalytics: seo.googleAnalytics,
        },
      });
    }
    const row = await prisma.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: body, updatedBy: ctx.user.id },
      update: { value: body, updatedBy: ctx.user.id },
    });
    await writeAudit({
      actorId: ctx.user.id,
      action: "seo.counters_update",
      entity: "Setting",
      entityId: KEY,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ counters: row.value });
  } catch (err) {
    return handleRouteError(err);
  }
}
