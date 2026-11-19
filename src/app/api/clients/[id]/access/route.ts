import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { createClientInviteSchema } from "@/server/auth/schemas";
import {
  createClientInvite,
  getClientAccess,
  revokeClientInvite,
} from "@/server/clients/access";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("clients.manage");
    const { id } = await ctx.params;
    const access = await getClientAccess(id);
    return jsonOk(access);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Создать / перевыпустить приглашение клиента. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { id } = await ctx.params;
    const raw = await req.json().catch(() => ({}));
    const body = createClientInviteSchema.parse(raw);
    const email =
      body.email === "" || body.email == null ? null : body.email;

    const result = await createClientInvite({
      clientId: id,
      email,
      createdBy: auth.user.id,
    });
    if (!result.ok) {
      return jsonError(result.code, result.message, 400);
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "client.invite",
      entity: "ClientInvite",
      entityId: result.inviteId,
      diff: { clientId: id, email: result.email },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({
      inviteId: result.inviteId,
      email: result.email,
      expiresAt: result.expiresAt,
      acceptUrl: result.acceptUrl,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Отозвать активное приглашение: body { inviteId }. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { inviteId?: string };
    const inviteId = String(body.inviteId || "").trim();
    if (!inviteId) {
      return jsonError("BAD_REQUEST", "inviteId обязателен", 400);
    }
    const result = await revokeClientInvite(id, inviteId);
    if (!result.ok) {
      return jsonError(result.code, result.message, 400);
    }
    await writeAudit({
      actorId: auth.user.id,
      action: "client.invite_revoke",
      entity: "ClientInvite",
      entityId: inviteId,
      diff: { clientId: id },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ revoked: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
