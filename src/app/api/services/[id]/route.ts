import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireRoleAuth } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { serviceUpsertSchema } from "@/server/services/schemas";
import { parsePublicHttpUrl } from "@/server/services/ssrf";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("services.manage");
    const { id } = await ctx.params;
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) return jsonError("NOT_FOUND", "Сервис не найден", 404);

    const checks = await prisma.healthCheck.findMany({
      where: { serviceId: id },
      orderBy: { checkedAt: "desc" },
      take: 100,
    });

    return jsonOk({
      service,
      checks: checks.map((c) => ({ ...c, id: c.id.toString() })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("services.manage");
    const { id } = await ctx.params;
    const body = serviceUpsertSchema.partial().parse(await req.json());

    if (body.healthUrl) {
      const check = parsePublicHttpUrl(body.healthUrl);
      if (!check.ok) return jsonError("SSRF", check.reason, 400);
    }

    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Сервис не найден", 404);

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...body,
        repoUrl: body.repoUrl === "" ? null : body.repoUrl,
        healthUrl: body.healthUrl === "" ? null : body.healthUrl,
        publicPagePath:
          body.publicPagePath === "" ? null : body.publicPagePath,
        manageUrl: body.manageUrl === "" ? null : body.manageUrl,
      },
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "services.update",
      entity: "Service",
      entityId: id,
      diff: { slug: service.slug },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ service });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireRoleAuth("OWNER");
    const { id } = await ctx.params;
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) return jsonError("NOT_FOUND", "Сервис не найден", 404);

    await prisma.service.delete({ where: { id } });
    await writeAudit({
      actorId: auth.user.id,
      action: "services.delete",
      entity: "Service",
      entityId: id,
      diff: { slug: existing.slug },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
