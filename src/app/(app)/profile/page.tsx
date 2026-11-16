import { ProfilePanel } from "@/components/users/ProfilePanel";
import { requirePageSession } from "@/server/auth/gate";
import { prisma } from "@/server/db";

export default async function ProfilePage() {
  const { user, sessionId } = await requirePageSession();
  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    },
  });

  return (
    <ProfilePanel
      email={user.email}
      name={user.name}
      role={user.role}
      totpEnabled={user.totpEnabled}
      initialSessions={JSON.parse(
        JSON.stringify(
          sessions.map((s) => ({ ...s, current: s.id === sessionId })),
        ),
      )}
    />
  );
}
