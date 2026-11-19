import { describe, expect, it } from "vitest";
import {
  buildInviteMessageVars,
  renderInviteMessage,
  siteDomainFromUrl,
} from "@/lib/invite-message";
import { DEFAULT_CLIENT_INVITE_MESSAGE } from "@/server/settings/schemas";

describe("invite-message", () => {
  it("siteDomainFromUrl", () => {
    expect(siteDomainFromUrl("https://www.russait.ru/path")).toBe("russait.ru");
    expect(siteDomainFromUrl("sertika.ru")).toBe("sertika.ru");
    expect(siteDomainFromUrl(null)).toBe("");
  });

  it("с именем подставляет {имя}", () => {
    const text = renderInviteMessage(DEFAULT_CLIENT_INVITE_MESSAGE, {
      имя: "Игорь",
      сайт: "russait.ru",
      ссылка: "https://vaybik.ru/admin/invite/x",
      вход: "https://vaybik.ru/admin/login",
      срок_ссылки: "72 часа",
    });
    expect(text.startsWith("Игорь, добрый день!")).toBe(true);
    expect(text).toContain("russait.ru");
    expect(text).toContain("https://vaybik.ru/admin/invite/x");
    expect(text).toContain("72 часа");
    expect(text).not.toContain("{");
  });

  it("без имени — Добрый день!", () => {
    const text = renderInviteMessage(DEFAULT_CLIENT_INVITE_MESSAGE, {
      имя: "",
      сайт: "vaybik.ru",
      ссылка: "https://x",
      вход: "https://y",
      срок_ссылки: "72 часа",
    });
    expect(text.startsWith("Добрый день!")).toBe(true);
    expect(text).not.toContain("{имя}");
  });

  it("buildInviteMessageVars", () => {
    const v = buildInviteMessageVars({
      contactName: " Анна ",
      siteUrl: "https://sertika.ru",
      inviteUrl: "https://invite",
      loginUrl: "https://login",
    });
    expect(v.имя).toBe("Анна");
    expect(v.сайт).toBe("sertika.ru");
    expect(v.срок_ссылки).toBe("72 часа");
  });
});
