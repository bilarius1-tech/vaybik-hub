import { describe, expect, it } from "vitest";
import {
  CHAT_STUDIO_WIDGET_CLIENT_ID,
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

  it("прочие slug — пусто", () => {
    expect(studioLinksForService("vaybik-main")).toEqual([]);
    expect(studioLinksForService("lead")).toEqual([]);
  });
});
