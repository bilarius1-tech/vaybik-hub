/** Конфиг исходящей почты (SMTP Яндекс, bilariuss@yandex.ru). Без значений — почта выключена. */

export type MailConfig = {
  from: string;
  replyTo: string | null;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  testTo: string | null;
};

export function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from =
    process.env.MAIL_FROM?.trim() ||
    (user ? `Вайбик <${user}>` : "");
  if (!host || !user || !pass || !from) return null;

  const port = Number(process.env.SMTP_PORT || "465");
  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure =
    secureEnv === "true" || secureEnv === "1"
      ? true
      : secureEnv === "false" || secureEnv === "0"
        ? false
        : port === 465;

  return {
    from,
    replyTo: process.env.MAIL_REPLY_TO?.trim() || null,
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure,
    user,
    pass,
    testTo: process.env.MAIL_TEST_TO?.trim() || null,
  };
}

export function isMailConfigured(): boolean {
  return getMailConfig() !== null;
}

/** Публичный URL входа в кабинет (с basePath /admin). */
export function cabinetLoginUrl(): string {
  const base =
    process.env.APP_URL?.replace(/\/$/, "") || "https://vaybik.ru/admin";
  return `${base}/login`;
}

export const VAYBIK_CONTACTS = {
  telegram: "https://t.me/bilarius",
  telegramLabel: "@bilarius",
  email: "bilariuss@yandex.ru",
  max: "https://max.ru/u/f9LHodD0cOJJqrzWNIgwcfSejU7L3YdJqC3eucYgoH12ooXijtHFm3XjPv4",
} as const;
