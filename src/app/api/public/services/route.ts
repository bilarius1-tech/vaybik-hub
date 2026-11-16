import { prisma } from "@/server/db";
import { jsonOk } from "@/server/http/response";

export async function GET() {
  const services = await prisma.service.findMany({
    where: { isPublic: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      url: true,
      description: true,
      icon: true,
      status: true,
      isDeployed: true,
      tags: true,
    },
  });

  return jsonOk(
    { services },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
