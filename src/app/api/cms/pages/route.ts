import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { assertPathAvailable } from "@/server/cms/service";
import {
  listPages,
  parsePageSize,
} from "@/server/cms/pages-list";
import { pageCreateSchema, pageStatusSchema } from "@/server/cms/schemas";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireCan("content.manage");
    const sp = req.nextUrl.searchParams;
    const statusRaw = sp.get("status");
    const status =
      statusRaw && statusRaw !== "ALL"
        ? pageStatusSchema.parse(statusRaw)
        : "ALL";
    const template = sp.get("template") || "ALL";
    const result = await listPages({
      q: sp.get("q") || undefined,
      status,
      template,
      sort: sp.get("sort") || undefined,
      page: Number(sp.get("page") || "1") || 1,
      pageSize: parsePageSize(sp.get("pageSize")),
      trash: sp.get("trash") === "1",
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("content.manage");
    const body = pageCreateSchema.parse(await req.json());
    await assertPathAvailable(body.path);

    const page = await prisma.page.create({
      data: {
        path: body.path,
        title: body.title,
        template: body.template,
        status: body.status,
        sortOrder: body.sortOrder,
        updatedById: ctx.user.id,
        source: "manual",
      },
      include: {
        _count: { select: { blocks: true } },
        updatedBy: { select: { id: true, email: true, name: true } },
      },
    });

    await writeAudit({
      actorId: ctx.user.id,
      action: "cms.page.create",
      entity: "Page",
      entityId: page.id,
      diff: { path: page.path, title: page.title },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ page }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
