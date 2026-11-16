import { jsonOk } from "@/server/http/response";

export async function GET() {
  return jsonOk({ ok: true, service: "vaybik-hub" });
}
