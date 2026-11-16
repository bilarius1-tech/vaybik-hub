import { VaultPanel } from "@/components/vault/VaultPanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { toMeta } from "@/server/vault/service";
import { redirect } from "next/navigation";

export default async function VaultPage() {
  try {
    await requireCan("vault.read");
  } catch {
    redirect("/");
  }
  const secrets = await prisma.secret.findMany({
    orderBy: [{ folder: "asc" }, { title: "asc" }],
  });
  return <VaultPanel initial={JSON.parse(JSON.stringify(secrets.map(toMeta)))} />;
}
