import { CLIENT_INVITE_TTL_MS } from "@/server/auth/constants";

export type InviteMessageVars = {
  имя: string;
  сайт: string;
  ссылка: string;
  вход: string;
  срок_ссылки: string;
};

/** Срок приглашения для шаблона: «72 часа» (часы, не «3 дня»). */
export function inviteTtlLabel(ms = CLIENT_INVITE_TTL_MS): string {
  const hours = Math.round(ms / 3_600_000);
  if (hours === 1) return "1 час";
  const mod10 = hours % 10;
  const mod100 = hours % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${hours} часа`;
  }
  if (mod10 === 1 && mod100 !== 11) return `${hours} час`;
  return `${hours} часов`;
}

/** Домен из URL сайта клиента. */
export function siteDomainFromUrl(siteUrl: string | null | undefined): string {
  const raw = (siteUrl || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return raw.replace(/^https?:\/\//i, "").split("/")[0] || raw;
  }
}

/**
 * Подстановка переменных. Без имени — «Добрый день!» вместо «{имя}, добрый день!».
 */
export function renderInviteMessage(
  template: string,
  vars: InviteMessageVars,
): string {
  const name = vars.имя.trim();
  let out = template;

  if (!name) {
    out = out.replace(/\{имя\},?\s*добрый день!/gi, "Добрый день!");
    out = out.replace(/\{имя\},?\s*/g, "");
  } else {
    out = out.replace(/\{имя\}/g, name);
  }

  const site = vars.сайт.trim() || "вашем сайте";
  out = out.replace(/\{сайт\}/g, site);
  out = out.replace(/\{ссылка\}/g, vars.ссылка);
  out = out.replace(/\{вход\}/g, vars.вход);
  out = out.replace(/\{срок_ссылки\}/g, vars.срок_ссылки);
  return out.trim() + "\n";
}

export function buildInviteMessageVars(input: {
  contactName: string | null | undefined;
  siteUrl: string | null | undefined;
  inviteUrl: string;
  loginUrl: string;
}): InviteMessageVars {
  return {
    имя: (input.contactName || "").trim(),
    сайт: siteDomainFromUrl(input.siteUrl),
    ссылка: input.inviteUrl,
    вход: input.loginUrl,
    срок_ссылки: inviteTtlLabel(),
  };
}
