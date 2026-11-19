import { NextRequest } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import {
  sendClientInviteEmail,
  sendTestMailTo,
} from "@/server/mail/client-notify";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["invite", "test"]),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional(),
});

/** Отправить приглашение на почту или тестовое письмо админу. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { id } = await ctx.params;
    const raw = bodySchema.parse(await req.json().catch(() => ({})));

    if (raw.action === "test") {
      const result = await sendTestMailTo({
        to: auth.user.email,
        clientId: id,
      });
      if (!result.ok) {
        const status = result.code === "MAIL_NOT_CONFIGURED" ? 503 : 400;
        return jsonError(result.code, result.message, status);
      }
      await writeAudit({
        actorId: auth.user.id,
        action: "client.mail_test",
        entity: "Client",
        entityId: id,
        diff: { to: result.to },
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      return jsonOk({ sent: true, to: result.to });
    }

    const email =
      raw.email === "" || raw.email == null ? null : raw.email.toLowerCase();
    const result = await sendClientInviteEmail({
      clientId: id,
      email,
      actorId: auth.user.id,
    });
    if (!result.ok) {
      const status =
        result.code === "MAIL_NOT_CONFIGURED"
          ? 503
          : result.code === "NOT_FOUND"
            ? 404
            : 400;
      return jsonError(result.code, result.message, status);
    }
    await writeAudit({
      actorId: auth.user.id,
      action: "client.mail_invite",
      entity: "ClientInvite",
      entityId: result.inviteId,
      diff: { clientId: id, to: result.to },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({
      sent: true,
      to: result.to,
      acceptUrl: result.acceptUrl,
      inviteId: result.inviteId,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
