import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { clientUpdateSchema } from "@/server/clients/schemas";
import {
  getClient,
  updateClientStatus,
} from "@/server/clients/service";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("clients.manage");
    const { id } = await ctx.params;
    const client = await getClient(id);
    if (!client) return jsonError("NOT_FOUND", "Клиент не найден", 404);
    return jsonOk({ client });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("clients.manage");
    const { id } = await ctx.params;
    const body = clientUpdateSchema.parse(await req.json());

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Клиент не найден", 404);

    const data: {
      name?: string;
      siteUrl?: string | null;
      contact?: string | null;
    } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.siteUrl !== undefined) data.siteUrl = body.siteUrl;
    if (body.contact !== undefined) data.contact = body.contact;

    if (Object.keys(data).length > 0) {
      await prisma.client.update({ where: { id }, data });
    }

    let client =
      body.status !== undefined
        ? await updateClientStatus({ clientId: id, status: body.status })
        : await getClient(id);

    if (!client) return jsonError("NOT_FOUND", "Клиент не найден", 404);

    // Если меняли только имя — sync в чат с новым именем для уже подключённых
    if (body.name !== undefined && body.status === undefined) {
      client = await updateClientStatus({
        clientId: id,
        status: client.status,
      });
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "clients.update",
      entity: "Client",
      entityId: id,
      diff: {
        name: body.name,
        status: body.status,
        siteUrl: body.siteUrl,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ client });
  } catch (err) {
    return handleRouteError(err);
  }
}
