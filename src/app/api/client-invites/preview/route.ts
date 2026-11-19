import { NextRequest } from "next/server";
import { hashSessionToken } from "@/server/auth/session";
import { lookupClientInvite } from "@/server/clients/access";
import { prisma } from "@/server/db";
import { handleRouteError, jsonError, jsonOk } from "@/server/http/response";

/** Публичный preview: client-invite или staff-invite. */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    if (!token) {
      return jsonError("BAD_REQUEST", "token обязателен", 400);
    }

    const client = await lookupClientInvite(token);
    if (client) {
      return jsonOk({
        kind: "client",
        valid: client.valid,
        email: client.email,
        clientName: client.clientName,
        expiresAt: client.expiresAt,
        passwordMin: 10,
        emailFixed: Boolean(client.email),
      });
    }

    const tokenHash = hashSessionToken(token);
    const staff = await prisma.invite.findUnique({ where: { tokenHash } });
    if (!staff) {
      return jsonError("NOT_FOUND", "Приглашение не найдено", 404);
    }
    const valid = !staff.usedAt && staff.expiresAt > new Date();
    return jsonOk({
      kind: "staff",
      valid,
      email: staff.email,
      role: staff.role,
      expiresAt: staff.expiresAt,
      passwordMin: 12,
      emailFixed: true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
