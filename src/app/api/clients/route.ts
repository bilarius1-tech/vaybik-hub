import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { clientCreateSchema } from "@/server/clients/schemas";
import { listClients } from "@/server/clients/service";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireCan("clients.manage");
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const statusRaw = req.nextUrl.searchParams.get("status");
    const status =
      statusRaw === "active" ||
      statusRaw === "paused" ||
      statusRaw === "archived"
        ? statusRaw
        : undefined;
    const clients = await listClients({ q, status });
    return jsonOk({ clients });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("clients.manage");
    const body = clientCreateSchema.parse(await req.json());

    const client = await prisma.client.create({
      data: {
        name: body.name,
        siteUrl: body.siteUrl,
        contact: body.contact,
        status: body.status,
      },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "clients.create",
      entity: "Client",
      entityId: client.id,
      diff: { name: client.name, status: client.status },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ client }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
