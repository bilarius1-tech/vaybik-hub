import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { seoCountersSchema } from "@/server/seo/schemas";

const KEY = "seo.counters";

export async function GET() {
  try {
    await requireCan("settings.manage");
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
