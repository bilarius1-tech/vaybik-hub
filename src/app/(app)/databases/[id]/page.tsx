import { DatabaseDetail } from "@/components/databases/DatabaseDetail";
import { can, requireCan } from "@/server/auth/require";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function DatabaseDetailPage({ params }: Props) {
  let ctx;
  try {
    ctx = await requireCan("databases.read");
  } catch {
    redirect("/");
  }
  const { id } = await params;
  return (
    <DatabaseDetail
      id={id}
      isOwner={ctx.user.role === "OWNER"}
      canRestore={can(ctx.user, "databases.restore")}
    />
  );
}
