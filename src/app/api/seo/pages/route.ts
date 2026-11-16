import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { seoPageSchema } from "@/server/seo/schemas";
import type { Prisma } from "@prisma/client";

export async function GET() {
  try {
    await requireCan("settings.manage");
    const pages = await prisma.seoPage.findMany({
      orderBy: [{ host: "asc" }, { path: "asc" }],
    });
    return jsonOk({ pages });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = seoPageSchema.parse(await req.json());
    const page = await prisma.seoPage.create({
      data: {
        ...body,
        canonical: body.canonical || null,
        ogImage: body.ogImage || null,
        jsonLd: (body.jsonLd as Prisma.InputJsonValue) ?? undefined,
      },
    });
    await writeAudit({
      actorId: ctx.user.id,
      action: "seo.create",
      entity: "SeoPage",
      entityId: page.id,
      diff: { host: page.host, path: page.path },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ page }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
