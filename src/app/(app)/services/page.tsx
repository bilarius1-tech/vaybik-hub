import { ServicesList } from "@/components/services/ServicesList";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function ServicesPage() {
  try {
    await requireCan("services.manage");
  } catch {
    redirect("/");
  }

  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Время среза для аптайма 24ч (server component)
  const since24h = new Date();
  since24h.setUTCHours(since24h.getUTCHours() - 24);
  const withSpark = await Promise.all(
    services.map(async (s) => {
      const checks = await prisma.healthCheck.findMany({
        where: {
          serviceId: s.id,
          checkedAt: { gte: since24h },
        },
        orderBy: { checkedAt: "asc" },
        take: 48,
        select: { responseMs: true, status: true },
      });
      const up = checks.filter(
        (c) => c.status === "UP" || c.status === "DEGRADED",
      ).length;
      return {
        ...s,
        spark: checks.map((c) => c.responseMs).filter((v): v is number => v != null),
        uptime24: checks.length
          ? Math.round((up / checks.length) * 1000) / 10
          : null,
      };
    }),
  );

  return <ServicesList initial={JSON.parse(JSON.stringify(withSpark))} />;
}
