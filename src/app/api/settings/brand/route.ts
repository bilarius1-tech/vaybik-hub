import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { brandSchema, SETTINGS_KEYS } from "@/server/settings/schemas";

export async function GET() {
  try {
    await requireCan("settings.manage");
    const row = await prisma.setting.findUnique({
      where: { key: SETTINGS_KEYS.brand },
    });
    return jsonOk({ brand: brandSchema.parse(row?.value ?? {}) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = brandSchema.parse(await req.json());
    const row = await prisma.setting.upsert({
      where: { key: SETTINGS_KEYS.brand },
      create: { key: SETTINGS_KEYS.brand, value: body, updatedBy: ctx.user.id },
      update: { value: body, updatedBy: ctx.user.id },
    });
    await writeAudit({
      actorId: ctx.user.id,
      action: "settings.brand_update",
      entity: "Setting",
      entityId: SETTINGS_KEYS.brand,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ brand: row.value });
  } catch (err) {
    return handleRouteError(err);
  }
}
