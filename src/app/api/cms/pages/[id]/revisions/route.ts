import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireCan("content.manage");
    const { id } = await ctx.params;
    const page = await prisma.page.findUnique({ where: { id } });
    if (!page) return jsonError("NOT_FOUND", "Страница не найдена", 404);

    const revisions = await prisma.pageRevision.findMany({
      where: { pageId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        note: true,
        createdAt: true,
        createdById: true,
      },
    });
    return jsonOk({ revisions, publishedRevisionId: page.publishedRevisionId });
  } catch (err) {
    return handleRouteError(err);
  }
}
