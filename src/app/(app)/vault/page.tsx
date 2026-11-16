import { VaultPanel } from "@/components/vault/VaultPanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { toMeta } from "@/server/vault/service";
import { redirect } from "next/navigation";

export default async function VaultPage() {
  let totpEnabled = true;
  try {
    const ctx = await requireCan("vault.read");
    totpEnabled = ctx.user.totpEnabled;
  } catch {
    redirect("/");
  }
  const secrets = await prisma.secret.findMany({
    orderBy: [{ folder: "asc" }, { title: "asc" }],
  });
  return (
    <VaultPanel
      initial={JSON.parse(JSON.stringify(secrets.map(toMeta)))}
      totpEnabled={totpEnabled}
    />
  );
}
