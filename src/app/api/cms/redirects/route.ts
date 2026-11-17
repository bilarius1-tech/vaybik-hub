import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { redirectInputSchema, validateRedirect } from "@/server/cms/redirects";
import { prisma } from "@/server/db";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

export async function GET() {
  try {
    await requireCan("content.manage");
    const redirects = await prisma.redirect.findMany({
      orderBy: { fromPath: "asc" },
    });
    return jsonOk({ redirects });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("content.manage");
    const body = redirectInputSchema.parse(await req.json());

    const existing = await prisma.redirect.findMany();
    const check = validateRedirect(
      {
        fromPath: body.fromPath,
        toPath: body.toPath,
        match: body.match,
        isActive: body.isActive,
      },
      existing,
    );
    if (!check.ok) {
      return jsonError("VALIDATION", check.errors[0] || "Ошибка валидации", 400, {
        errors: check.errors,
        warnings: check.warnings,
      });
    }

    if (body.toPath.startsWith("/")) {
      const archived = await prisma.page.findFirst({
        where: { path: body.toPath, status: "ARCHIVED" },
      });
      if (archived) {
        check.warnings.push(
          `цель «${body.toPath}» — страница в статусе ARCHIVED`,
        );
      }
    }

    const redirect = await prisma.redirect.create({
      data: {
        ...body,
        updatedById: auth.user.id,
      },
    });

    await writeAudit({
      actorId: auth.user.id,
      action: "cms.redirect.create",
      entity: "Redirect",
      entityId: redirect.id,
      diff: {
        fromPath: redirect.fromPath,
        toPath: redirect.toPath,
        code: redirect.code,
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk(
      { redirect, warnings: check.warnings, suggestedToPath: check.suggestedToPath },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
