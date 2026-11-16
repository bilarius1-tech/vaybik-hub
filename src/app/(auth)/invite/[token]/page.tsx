import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  return <AcceptInviteForm token={token} />;
}
