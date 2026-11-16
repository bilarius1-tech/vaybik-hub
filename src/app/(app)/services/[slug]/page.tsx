import { ServiceDetail } from "@/components/services/ServiceDetail";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function ServicePage({ params }: Props) {
  try {
    await requireCan("services.manage");
  } catch {
    redirect("/");
  }
  const { slug } = await params;
  const service = await prisma.service.findUnique({ where: { slug } });
  if (!service) notFound();

  const checks = await prisma.healthCheck.findMany({
    where: { serviceId: service.id },
    orderBy: { checkedAt: "desc" },
    take: 100,
  });

  return (
    <ServiceDetail
      service={JSON.parse(JSON.stringify(service))}
      checks={JSON.parse(
        JSON.stringify(
          checks.map((c) => ({ ...c, id: c.id.toString() })),
        ),
      )}
    />
  );
}
