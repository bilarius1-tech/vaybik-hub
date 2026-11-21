import { describe, expect, it } from "vitest";
import {
  CHAT_STUDIO_WIDGET_CLIENT_ID,
  studioCabinetLinks,
  studioLinksForService,
} from "./studio-service-links";

describe("studioLinksForService", () => {
  it("чат — 4 SSO-ссылки через /sso/chat", () => {
    const links = studioLinksForService("chat");
    expect(links).toHaveLength(4);
    expect(links.map((l) => l.label)).toEqual([
      "Клиенты чата",
      "Наш виджет (база знаний)",
      "Справка чата",
      "Лендинг чата (SEO)",
    ]);
    for (const l of links) {
      expect(l.href.startsWith("/sso/chat?next=")).toBe(true);
      expect(l.external).toBeFalsy();
    }
    expect(links[1]?.href).toContain(
      encodeURIComponent(
        `/manage/clients/${CHAT_STUDIO_WIDGET_CLIENT_ID}`,
      ),
    );
    expect(links[0]?.href).toBe("/sso/chat?next=%2Fmanage");
    expect(links[2]?.href).toBe("/sso/chat?next=%2Fmanage%2Fhelp");
    expect(links[3]?.href).toBe("/sso/chat?next=%2Fmanage%2Flanding");
  });

  it("design-atlas — внешние ссылки на сайт", () => {
    const links = studioLinksForService("design-atlas");
    expect(links).toEqual([
      {
        label: "Открыть сайт",
        href: "https://design.vaybik.ru",
        external: true,
      },
      {
        label: "Пример сайта для клиента",
        href: "https://design.vaybik.ru/primer",
        external: true,
      },
    ]);
  });

  it("lead — SSO в кабинет лидов", () => {
    const links = studioLinksForService("lead");
    expect(links).toEqual([
      { label: "Кабинет лидов", href: "/sso/leads?next=%2Fmanage" },
    ]);
  });

  it("прочие slug — пусто", () => {
    expect(studioLinksForService("vaybik-main")).toEqual([]);
  });
});

describe("studioCabinetLinks", () => {
  it("без SSO — чат и лиды disabled, Атлас внешний", () => {
    const links = studioCabinetLinks({
      chatSsoReady: false,
      leadsSsoReady: false,
    });
    expect(links).toHaveLength(3);
    expect(links[0]?.disabled).toBe(true);
    expect(links[1]?.disabled).toBe(true);
    expect(links[2]?.external).toBe(true);
    expect(links[2]?.disabled).toBeFalsy();
  });

  it("с SSO — все активны", () => {
    const links = studioCabinetLinks({
      chatSsoReady: true,
      leadsSsoReady: true,
    });
    expect(links.every((l) => !l.disabled)).toBe(true);
    expect(links[0]?.href).toBe("/sso/chat?next=%2Fmanage");
    expect(links[1]?.href).toBe("/sso/leads?next=%2Fmanage");
  });
});
