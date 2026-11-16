import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { contactsSchema, SETTINGS_KEYS } from "@/server/settings/schemas";

export async function GET() {
  try {
    await requireCan("settings.manage");
    const row = await prisma.setting.findUnique({
      where: { key: SETTINGS_KEYS.contacts },
    });
    return jsonOk({ contacts: contactsSchema.parse(row?.value ?? {}) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = contactsSchema.parse(await req.json());
    const normalized = {
      ...body,
      email: body.email || null,
      social: {
        vk: body.social?.vk || null,
        youtube: body.social?.youtube || null,
        github: body.social?.github || null,
      },
    };
    const row = await prisma.setting.upsert({
      where: { key: SETTINGS_KEYS.contacts },
      create: {
        key: SETTINGS_KEYS.contacts,
        value: normalized,
        updatedBy: ctx.user.id,
      },
      update: { value: normalized, updatedBy: ctx.user.id },
    });
    await writeAudit({
      actorId: ctx.user.id,
      action: "settings.contacts_update",
      entity: "Setting",
      entityId: SETTINGS_KEYS.contacts,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ contacts: row.value });
  } catch (err) {
    return handleRouteError(err);
  }
}
