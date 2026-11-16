import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function GET(req: NextRequest) {
  try {
    await requireCan("activity.read");
    const sp = req.nextUrl.searchParams;
    const action = sp.get("action") || undefined;
    const entity = sp.get("entity") || undefined;
    const actorId = sp.get("actorId") || undefined;
    const take = Math.min(Number(sp.get("limit") || 50), 200);
    const cursor = sp.get("cursor") || undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        action: action ? { contains: action } : undefined,
        entity: entity || undefined,
        actorId: actorId || undefined,
      },
      orderBy: { id: "desc" },
      take,
      ...(cursor
        ? { skip: 1, cursor: { id: BigInt(cursor) } }
        : {}),
    });

    return jsonOk({
      logs: logs.map((l) => ({
        ...l,
        id: l.id.toString(),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
