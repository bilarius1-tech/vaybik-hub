import { prisma } from "@/server/db";
import { cabinetLoginUrl } from "@/server/mail/config";
import {
  buildInviteMessageVars,
  renderInviteMessage,
} from "@/lib/invite-message";
import {
  DEFAULT_CLIENT_INVITE_MESSAGE,
  SETTINGS_KEYS,
  clientInviteMessageSchema,
} from "@/server/settings/schemas";

export {
  buildInviteMessageVars,
  inviteTtlLabel,
  renderInviteMessage,
  siteDomainFromUrl,
} from "@/lib/invite-message";

export async function getInviteMessageTemplate(): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTINGS_KEYS.clientInviteMessage },
  });
  const parsed = clientInviteMessageSchema.parse(row?.value ?? {});
  return parsed.template || DEFAULT_CLIENT_INVITE_MESSAGE;
}

export async function renderClientInviteMessage(input: {
  contactName: string | null | undefined;
  siteUrl: string | null | undefined;
  inviteUrl: string;
  loginUrl?: string;
}): Promise<string> {
  const template = await getInviteMessageTemplate();
  return renderInviteMessage(
    template,
    buildInviteMessageVars({
      contactName: input.contactName,
      siteUrl: input.siteUrl,
      inviteUrl: input.inviteUrl,
      loginUrl: input.loginUrl || cabinetLoginUrl(),
    }),
  );
}
