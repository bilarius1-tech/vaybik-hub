import { describe, expect, it } from "vitest";
import {
  expiredMail,
  expirySoonMail,
  inviteMail,
  testMail,
} from "@/server/mail/template";

describe("mail templates", () => {
  it("invite: кнопка пароля, вход и «сохраните ссылку»", () => {
    const m = inviteMail({
      clientName: "Тест",
      inviteUrl: "https://vaybik.ru/admin/invite/abc",
      loginUrl: "https://vaybik.ru/admin/login",
    });
    expect(m.subject).toContain("Тест");
    expect(m.html).toContain("Задать пароль");
    expect(m.html).toContain("https://vaybik.ru/admin/invite/abc");
    expect(m.html).toContain("Войти в кабинет");
    expect(m.html).toContain("Сохраните эту ссылку для входа");
    expect(m.text).toContain("https://vaybik.ru/admin/login");
    expect(m.text).toContain("@bilarius");
  });

  it("expiry 7 / 1 и expired", () => {
    const e7 = expirySoonMail({
      clientName: "Клиент",
      serviceName: "Чат",
      untilRu: "01.12.2026",
      daysLeft: 7,
      loginUrl: "https://vaybik.ru/admin/login",
    });
    expect(e7.subject).toContain("7");
    expect(e7.html).toContain("Войти в кабинет");

    const e1 = expirySoonMail({
      clientName: "Клиент",
      serviceName: "Чат",
      untilRu: "01.12.2026",
      daysLeft: 1,
      loginUrl: "https://vaybik.ru/admin/login",
    });
    expect(e1.subject).toContain("завтра");

    const ex = expiredMail({
      clientName: "Клиент",
      serviceName: "Чат",
      untilRu: "01.12.2026",
      loginUrl: "https://vaybik.ru/admin/login",
    });
    expect(ex.subject).toContain("истёк");
    expect(ex.html).toContain("заглушку");
  });

  it("test mail", () => {
    const t = testMail({ loginUrl: "https://vaybik.ru/admin/login" });
    expect(t.subject).toContain("Тестовое");
    expect(t.html).toContain("SMTP");
  });
});
