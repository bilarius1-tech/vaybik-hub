import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { bumpSiteVersion } from "@/server/cms/site-version";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { ensureAdminDisallow } from "@/server/seo/robots-normalize";
import { z } from "zod";

const bodySchema = z.object({
  text: z.string().max(50_000),
});

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in (value as object)) {
    return String((value as { text: string }).text);
  }
  return "";
}

export async function GET() {
  try {
    await requireCan("settings.manage");
    const row = await prisma.setting.findUnique({
      where: { key: "site.robots" },
    });
    return jsonOk({ text: ensureAdminDisallow(asText(row?.value)) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("settings.manage");
    const body = bodySchema.parse(await req.json());
    const text = ensureAdminDisallow(body.text);
    await prisma.setting.upsert({
      where: { key: "site.robots" },
      create: { key: "site.robots", value: text, updatedBy: auth.user.id },
      update: { value: text, updatedBy: auth.user.id },
    });
    await bumpSiteVersion(prisma, "site.robots");
    await writeAudit({
      actorId: auth.user.id,
      action: "seo.robots.update",
      entity: "Setting",
      entityId: "site.robots",
      diff: { length: text.length },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return jsonOk({ text });
  } catch (err) {
    return handleRouteError(err);
  }
}
