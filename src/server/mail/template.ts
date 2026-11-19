import { VAYBIK_CONTACTS, cabinetLoginUrl } from "@/server/mail/config";

export type MailContent = { subject: string; html: string; text: string };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function btn(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;background:#ff8a1f;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">${esc(label)}</a>`;
}

function wrapHtml(opts: {
  title: string;
  bodyHtml: string;
  loginUrl: string;
}): string {
  const login = opts.loginUrl;
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#1a1d24">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;border:1px solid #e6e8ec;overflow:hidden">
        <tr><td style="padding:20px 28px;background:#1a1d24;color:#fff">
          <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em">vaybik<span style="color:#ff8a1f">.</span>ru</div>
          <div style="font-size:12px;opacity:0.7;margin-top:4px">студия автоматизации</div>
        </td></tr>
        <tr><td style="padding:28px">
          ${opts.bodyHtml}
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e6e8ec">
            ${btn(login, "Войти в кабинет")}
          </div>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#5c6570">
            Вопросы: Telegram <a href="${esc(VAYBIK_CONTACTS.telegram)}" style="color:#ff8a1f">${esc(VAYBIK_CONTACTS.telegramLabel)}</a>,
            <a href="mailto:${esc(VAYBIK_CONTACTS.email)}" style="color:#ff8a1f">${esc(VAYBIK_CONTACTS.email)}</a>,
            <a href="${esc(VAYBIK_CONTACTS.max)}" style="color:#ff8a1f">MAX</a>
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#8b939e">Письмо отправлено сервисом Вайбик</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function contactsText(): string {
  return [
    `Telegram: ${VAYBIK_CONTACTS.telegramLabel} (${VAYBIK_CONTACTS.telegram})`,
    `Email: ${VAYBIK_CONTACTS.email}`,
    `MAX: ${VAYBIK_CONTACTS.max}`,
  ].join("\n");
}

export function inviteMail(input: {
  clientName: string;
  inviteUrl: string;
  loginUrl?: string;
}): MailContent {
  const loginUrl = input.loginUrl || cabinetLoginUrl();
  const subject = `Приглашение в кабинет Вайбик — ${input.clientName}`;
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Добро пожаловать в Вайбик</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55">
      <b>Вайбик</b> — студия автоматизации. <b>AI-консультант</b> на вашем сайте отвечает посетителям
      и передаёт заявки менеджерам в Telegram.
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55">
      Для «${esc(input.clientName)}» подготовлен доступ в кабинет. Задайте пароль по кнопке ниже
      (ссылка действует <b>72 часа</b>).
    </p>
    <div style="margin:0 0 22px">${btn(input.inviteUrl, "Задать пароль")}</div>
    <p style="margin:0 0 8px;font-size:14px;font-weight:700">Три шага после входа</p>
    <ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.55;color:#2a3038">
      <li>Войти в кабинет</li>
      <li>Подключить Telegram-группу менеджеров</li>
      <li>Проверить виджет на сайте</li>
    </ol>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#5c6570">
      <b>Сохраните эту ссылку для входа:</b><br>
      <a href="${esc(loginUrl)}" style="color:#ff8a1f;word-break:break-all">${esc(loginUrl)}</a>
    </p>`;
  const text = [
    "Добро пожаловать в Вайбик",
    "",
    "Вайбик — студия автоматизации. AI-консультант на сайте отвечает посетителям и передаёт заявки в Telegram.",
    "",
    `Задать пароль (72 ч): ${input.inviteUrl}`,
    "",
    "Три шага: 1) войти → 2) подключить Telegram-группу → 3) проверить виджет.",
    "",
    `Сохраните ссылку для входа: ${loginUrl}`,
    "",
    "Войти в кабинет: " + loginUrl,
    "",
    contactsText(),
  ].join("\n");
  return {
    subject,
    html: wrapHtml({ title: subject, bodyHtml, loginUrl }),
    text,
  };
}

export function expirySoonMail(input: {
  clientName: string;
  serviceName: string;
  untilRu: string;
  daysLeft: 7 | 1;
  loginUrl?: string;
}): MailContent {
  const loginUrl = input.loginUrl || cabinetLoginUrl();
  const subject =
    input.daysLeft === 7
      ? `Срок «${input.serviceName}» заканчивается через 7 дней`
      : `Срок «${input.serviceName}» заканчивается завтра`;
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Срок услуги подходит к концу</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55">
      Здравствуйте! У клиента <b>${esc(input.clientName)}</b> услуга
      <b>${esc(input.serviceName)}</b> действует до <b>${esc(input.untilRu)}</b>
      (осталось ${input.daysLeft === 7 ? "7 дней" : "1 день"}).
    </p>
    <p style="margin:0;font-size:15px;line-height:1.55">
      Чтобы виджет продолжал работать без перерыва — напишите Вайбику о продлении.
      Войти в кабинет можно по кнопке ниже.
    </p>`;
  const text = [
    "Срок услуги подходит к концу",
    "",
    `${input.clientName}: «${input.serviceName}» до ${input.untilRu} (осталось ${input.daysLeft} дн.).`,
    "",
    "Напишите Вайбику о продлении.",
    `Войти в кабинет: ${loginUrl}`,
    "",
    contactsText(),
  ].join("\n");
  return {
    subject,
    html: wrapHtml({ title: subject, bodyHtml, loginUrl }),
    text,
  };
}

export function expiredMail(input: {
  clientName: string;
  serviceName: string;
  untilRu: string;
  loginUrl?: string;
}): MailContent {
  const loginUrl = input.loginUrl || cabinetLoginUrl();
  const subject = `Срок «${input.serviceName}» истёк — виджет на паузе`;
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Срок услуги истёк</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55">
      У клиента <b>${esc(input.clientName)}</b> услуга <b>${esc(input.serviceName)}</b>
      закончилась ${esc(input.untilRu)}. На сайте посетители видят заглушку вместо консультанта.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.55">
      Чтобы снова включить виджет — напишите Вайбику о продлении. После оплаты срок обновят в кабинете.
    </p>`;
  const text = [
    "Срок услуги истёк",
    "",
    `${input.clientName}: «${input.serviceName}» закончилась ${input.untilRu}. Виджет показывает заглушку.`,
    "",
    "Напишите Вайбику о продлении.",
    `Войти в кабинет: ${loginUrl}`,
    "",
    contactsText(),
  ].join("\n");
  return {
    subject,
    html: wrapHtml({ title: subject, bodyHtml, loginUrl }),
    text,
  };
}

export function testMail(input: { loginUrl?: string }): MailContent {
  const loginUrl = input.loginUrl || cabinetLoginUrl();
  const subject = "Тестовое письмо Вайбик";
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Тест почты</h1>
    <p style="margin:0;font-size:15px;line-height:1.55">
      SMTP настроен. Если вы видите это письмо — исходящая почта хаба работает.
    </p>`;
  const text = [
    "Тестовое письмо Вайбик",
    "",
    "SMTP настроен.",
    `Войти в кабинет: ${loginUrl}`,
    "",
    contactsText(),
  ].join("\n");
  return {
    subject,
    html: wrapHtml({ title: subject, bodyHtml, loginUrl }),
    text,
  };
}
