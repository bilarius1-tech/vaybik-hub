import { UsersPanel } from "@/components/users/UsersPanel";
import { requireCan } from "@/server/auth/require";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  try {
    await requireCan("users.manage");
  } catch {
    redirect("/");
  }

  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        totpEnabled: true,
        isBlocked: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { sessions: true } },
      },
    }),
    prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <UsersPanel
      initialUsers={JSON.parse(JSON.stringify(users))}
      initialInvites={JSON.parse(JSON.stringify(invites))}
    />
  );
}
