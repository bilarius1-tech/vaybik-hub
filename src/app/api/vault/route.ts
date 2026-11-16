import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { secretCreateSchema } from "@/server/vault/schemas";
import { createSecret, toMeta } from "@/server/vault/service";
import { assertNoPlaintextLeak } from "@/server/vault/crypto";

export async function GET(req: NextRequest) {
  try {
    await requireCan("vault.read");
    const folder = req.nextUrl.searchParams.get("folder") || undefined;
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const secrets = await prisma.secret.findMany({
      where: {
        folder: folder || undefined,
        OR: q
          ? [
              { title: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { tags: { has: q } },
            ]
          : undefined,
      },
      orderBy: [{ folder: "asc" }, { title: "asc" }],
    });
    return jsonOk({ secrets: secrets.map(toMeta) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ctx = await requireCan("vault.manage");
    const body = secretCreateSchema.parse(await req.json());
    const secret = await createSecret({
      ...body,
      url: body.url || null,
      createdById: ctx.user.id,
    });

    const plain = Object.values(body.secrets).filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    assertNoPlaintextLeak(secret, plain);

    await writeAudit({
      actorId: ctx.user.id,
      action: "vault.create",
      entity: "Secret",
      entityId: secret.id,
      diff: { title: secret.title, kind: secret.kind, folder: secret.folder },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ secret: toMeta(secret) }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
