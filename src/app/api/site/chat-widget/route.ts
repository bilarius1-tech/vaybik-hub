import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import {
  assertAllowedSrc,
  CHAT_WIDGET_SETTING_KEY,
  chatWidgetSchema,
  parseChatWidget,
} from "@/server/cms/chat-widget";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function GET() {
  try {
    await requireCan("settings.manage");
    const row = await prisma.setting.findUnique({
      where: { key: CHAT_WIDGET_SETTING_KEY },
    });
    return jsonOk({ widget: parseChatWidget(row?.value) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("settings.manage");
    const body = chatWidgetSchema.parse(await req.json());
    const widget = assertAllowedSrc(body);
    await prisma.setting.upsert({
      where: { key: CHAT_WIDGET_SETTING_KEY },
      create: {
        key: CHAT_WIDGET_SETTING_KEY,
        value: widget,
        updatedBy: auth.user.id,
      },
      update: { value: widget, updatedBy: auth.user.id },
    });
    await bumpSiteVersion(prisma, "site.chatWidget");
    await writeAudit({
      actorId: auth.user.id,
      action: "site.chatWidget.update",
      entity: "Setting",
      entityId: CHAT_WIDGET_SETTING_KEY,
      diff: {
        enabled: widget.enabled,
        src: widget.src,
        publicId: widget.publicId ? "[set]" : "",
        pathsCount: widget.paths.length,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ widget });
  } catch (err) {
    return handleRouteError(err);
  }
}
