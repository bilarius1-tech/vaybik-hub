import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { SITE_CMS_SLUG } from "@/server/services/seo-defaults";
import { ensureServiceSeo, updateServiceSeo } from "@/server/services/seo";
import { z } from "zod";

const bodySchema = z.object({
  text: z.string().max(200_000),
});

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in (value as object)) {
    return String((value as { text: string }).text);
  }
  return "";
}

export async function GET() {
  try {
    await requireCan("settings.manage");
    const site = await prisma.service.findUnique({
      where: { slug: SITE_CMS_SLUG },
    });
    if (site) {
      const seo = await ensureServiceSeo(prisma, site);
      if (seo.llmsTxt?.trim()) {
        return jsonOk({ text: seo.llmsTxt });
      }
    }
    const row = await prisma.setting.findUnique({
      where: { key: "site.llms" },
    });
    return jsonOk({ text: asText(row?.value) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("settings.manage");
    const body = bodySchema.parse(await req.json());
    const site = await prisma.service.findUnique({
      where: { slug: SITE_CMS_SLUG },
    });
    if (site) {
      await updateServiceSeo(
        prisma,
        site.id,
        { llmsTxt: body.text },
        auth.user.id,
      );
    } else {
      await prisma.setting.upsert({
        where: { key: "site.llms" },
        create: { key: "site.llms", value: body.text, updatedBy: auth.user.id },
        update: { value: body.text, updatedBy: auth.user.id },
      });
      await bumpSiteVersion(prisma, "site.llms");
    }
    await writeAudit({
      actorId: auth.user.id,
      action: "seo.llms.update",
      entity: site ? "ServiceSeo" : "Setting",
      entityId: site ? site.id : "site.llms",
      diff: { length: body.text.length },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ text: body.text });
  } catch (err) {
    return handleRouteError(err);
  }
}
