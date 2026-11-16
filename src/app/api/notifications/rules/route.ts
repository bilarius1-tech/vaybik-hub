import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { notificationRuleSchema } from "@/server/services/schemas";

export async function GET() {
  try {
    await requireCan("settings.manage");
    const rules = await prisma.notificationRule.findMany({
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ rules });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("settings.manage");
    const body = notificationRuleSchema.parse(await req.json());
    const rule = await prisma.notificationRule.create({ data: body });
    await writeAudit({
      actorId: ctx.user.id,
      action: "notifications.rule_create",
      entity: "NotificationRule",
      entityId: rule.id,
      diff: { event: rule.event },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ rule }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
