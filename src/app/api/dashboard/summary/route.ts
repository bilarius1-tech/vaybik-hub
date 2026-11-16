import { NextRequest } from "next/server";
import { requireCan } from "@/server/auth/require";
import { handleRouteError, jsonOk } from "@/server/http/response";
import {
  getDashboardSummary,
  type Period,
} from "@/server/services/dashboard";

export async function GET(req: NextRequest) {
  try {
    await requireCan("services.manage");
    const period = (req.nextUrl.searchParams.get("period") || "week") as Period;
    const summary = await getDashboardSummary(
      period === "day" || period === "month" ? period : "week",
    );
    return jsonOk(summary);
  } catch (err) {
    return handleRouteError(err);
  }
}
