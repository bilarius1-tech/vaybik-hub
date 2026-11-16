import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan, requireReauth } from "@/server/auth/require";
import {
  restartContainer,
  startContainer,
  stopContainer,
  updateContainer,
} from "@/server/docker/service";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { notifyEvent } from "@/server/services/telegram";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string; name: string }> };

const bodySchema = z.object({
  action: z.enum(["restart", "start", "stop", "update"]),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("services.manage");
    const { id, name } = await ctx.params;
    const containerName = decodeURIComponent(name);
    const body = bodySchema.parse(await req.json());

    if (body.action === "stop" || body.action === "update") {
      await requireReauth();
    }

    let result;
    switch (body.action) {
      case "restart":
        result = await restartContainer(id, containerName);
        break;
      case "start":
        result = await startContainer(id, containerName);
        break;
      case "stop":
        result = await stopContainer(id, containerName);
        break;
      case "update":
        result = await updateContainer(id, containerName);
        break;
      default:
        return jsonError("VALIDATION", "Неизвестное действие", 400);
    }

    await writeAudit({
      actorId: auth.user.id,
      action: `docker.${body.action}`,
      entity: "Service",
      entityId: id,
      diff: { container: result.name, image: "image" in result ? result.image : undefined },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    void notifyEvent({
      event: `docker.${body.action}`,
      entityId: id,
      text: `Docker ${body.action}: ${result.name} (сервис ${result.service}) — ${auth.user.email}`,
    });

    return jsonOk({ result });
  } catch (err) {
    return handleRouteError(err);
  }
}
