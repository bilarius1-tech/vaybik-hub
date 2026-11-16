import { Setup2faForm } from "@/components/auth/Setup2faForm";
import { enforce2faGate, requirePageSession } from "@/server/auth/gate";

export default async function Setup2faPage() {
  const { user } = await requirePageSession();
  await enforce2faGate(user, "/setup-2fa");
  return <Setup2faForm email={user.email} />;
}
