import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { serviceUpsertSchema } from "@/server/services/schemas";
import { parsePublicHttpUrl } from "@/server/services/ssrf";

export async function GET() {
  try {
    await requireCan("services.manage");
    const services = await prisma.service.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return jsonOk({ services });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("services.manage");
    const body = serviceUpsertSchema.parse(await req.json());

    if (body.healthUrl) {
      const check = parsePublicHttpUrl(body.healthUrl);
      if (!check.ok) return jsonError("SSRF", check.reason, 400);
    }

    const service = await prisma.service.create({
      data: {
        ...body,
        repoUrl: body.repoUrl || null,
        healthUrl: body.healthUrl || null,
        description: body.description || null,
        icon: body.icon || null,
        composeProject: body.composeProject || null,
        branch: body.branch || "main",
        keyword: body.keyword || null,
      },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "services.create",
      entity: "Service",
      entityId: service.id,
      diff: { slug: service.slug, name: service.name },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ service }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
