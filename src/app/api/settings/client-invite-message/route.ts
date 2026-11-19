import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import {
  DEFAULT_CLIENT_INVITE_MESSAGE,
  SETTINGS_KEYS,
  clientInviteMessageSchema,
} from "@/server/settings/schemas";

export async function GET() {
  try {
    await requireCan("settings.manage");
    const row = await prisma.setting.findUnique({
      where: { key: SETTINGS_KEYS.clientInviteMessage },
    });
    const parsed = clientInviteMessageSchema.parse(row?.value ?? {});
    return jsonOk({
      template: parsed.template || DEFAULT_CLIENT_INVITE_MESSAGE,
      defaultTemplate: DEFAULT_CLIENT_INVITE_MESSAGE,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = clientInviteMessageSchema.parse(await req.json());
    const row = await prisma.setting.upsert({
      where: { key: SETTINGS_KEYS.clientInviteMessage },
      create: {
        key: SETTINGS_KEYS.clientInviteMessage,
        value: body,
        updatedBy: ctx.user.id,
      },
      update: { value: body, updatedBy: ctx.user.id },
    });
    await writeAudit({
      actorId: ctx.user.id,
      action: "settings.client_invite_message_update",
      entity: "Setting",
      entityId: SETTINGS_KEYS.clientInviteMessage,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    const parsed = clientInviteMessageSchema.parse(row.value ?? {});
    return jsonOk({ template: parsed.template });
  } catch (err) {
    return handleRouteError(err);
  }
}
