import { NextRequest } from "next/server";
import { writeAudit } from "@/server/auth/audit";
import { requireCan } from "@/server/auth/require";
import { startClientSelfSso } from "@/server/clients/access";
import { assertSameOrigin, clientIp, userAgent } from "@/server/http/request";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";
import { z } from "zod";

const bodySchema = z.object({
  clientServiceId: z.string().min(1),
});

/** CLIENT: открыть свой сервис через SSO mode=client. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireCan("client.self");
    const body = bodySchema.parse(await req.json());
    const result = await startClientSelfSso({
      userId: auth.user.id,
      email: auth.user.email,
      clientServiceId: body.clientServiceId,
    });
    if (!result.ok) {
      const status = result.code === "FORBIDDEN" ? 403 : 400;
      return jsonError(result.code, result.message, status);
    }

    await writeAudit({
      actorId: auth.user.id,
      action: "client.sso_open",
      entity: "ClientService",
      entityId: body.clientServiceId,
      diff: { mode: "client", jti: result.jti },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return jsonOk({ redirectUrl: result.ssoUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}
