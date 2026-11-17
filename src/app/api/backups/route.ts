import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { handleRouteError, jsonOk } from "@/server/http/response";

export async function GET() {
  try {
    await requireCan("databases.read");
    const backups = await prisma.backup.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        dbConnection: { select: { id: true, name: true, slug: true } },
      },
    });
    return jsonOk({
      backups: backups.map((b) => ({
        ...b,
        sizeBytes: b.sizeBytes != null ? b.sizeBytes.toString() : null,
        fileName: b.file.split("/").pop(),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
