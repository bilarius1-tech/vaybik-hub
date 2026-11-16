import { requireCan } from "@/server/auth/require";
import { handleRouteError, jsonOk } from "@/server/http/response";
import { getContainerStatus } from "@/server/docker/service";

type Ctx = { params: Promise<{ id: string; name: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requireCan("services.manage");
    const { id, name } = await ctx.params;
    const status = await getContainerStatus(id, decodeURIComponent(name));
    return jsonOk({ container: status });
  } catch (err) {
    return handleRouteError(err);
  }
}
