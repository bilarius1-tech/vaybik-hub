import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import { assertSameOrigin } from "@/server/http/request";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { generatePassword } from "@/server/vault/password";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await requireCan("vault.manage");
    const body = z
      .object({
        length: z.number().int().min(12).max(64).default(20),
        symbols: z.boolean().default(true),
      })
      .parse(await req.json().catch(() => ({})));
    return jsonOk({ password: generatePassword(body.length, { symbols: body.symbols }) });
  } catch (err) {
    return handleRouteError(err);
  }
}
