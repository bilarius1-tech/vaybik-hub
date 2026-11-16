import { getPublicSitePayload } from "@/server/settings/site";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function GET() {
  try {
    const site = await getPublicSitePayload();
    return jsonOk(
      { site },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
