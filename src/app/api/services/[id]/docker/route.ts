import { requireCan } from "@/server/auth/require";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { listServiceContainers } from "@/server/docker/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requireCan("services.manage");
    const { id } = await ctx.params;
    const data = await listServiceContainers(id);
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
