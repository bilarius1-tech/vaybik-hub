import nodemailer from "nodemailer";
import { getMailConfig, isMailConfigured } from "@/server/mail/config";
import type { MailContent } from "@/server/mail/template";

export type SendMailResult =
  | { ok: true; messageId?: string }
  | { ok: false; code: string; message: string };

/** Отправить письмо. Без SMTP → MAIL_NOT_CONFIGURED (остальное приложение не ломаем). */
export async function sendMail(input: {
  to: string;
  content: MailContent;
}): Promise<SendMailResult> {
  const cfg = getMailConfig();
  if (!cfg) {
    return {
      ok: false,
      code: "MAIL_NOT_CONFIGURED",
      message: "Почта не настроена (SMTP_* / MAIL_FROM в .env)",
    };
  }
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, code: "BAD_EMAIL", message: "Некорректный email" };
  }

  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const info = await transport.sendMail({
      from: cfg.from,
      to,
      replyTo: cfg.replyTo || undefined,
      subject: input.content.subject,
      text: input.content.text,
      html: input.content.html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "SMTP_ERROR", message: message.slice(0, 400) };
  }
}

export { isMailConfigured };
