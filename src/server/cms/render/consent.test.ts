import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CONSENT_COOKIE,
  renderConsentAndAnalytics,
  renderVerificationMeta,
} from "./consent";
import { renderSiteDocument } from "./document";

describe("consent + metrika", () => {
  it("без ID Метрики баннер не рендерится", () => {
    const html = renderConsentAndAnalytics({
      analytics: { yandexMetrika: null },
      privacyUrl: "https://chat.vaybik.ru/privacy",
    });
    expect(html).toBe("");
  });

  it("с ID — баннер и cookie; тег грузится только после согласия", () => {
    const html = renderConsentAndAnalytics({
      analytics: { yandexMetrika: "12345678" },
      privacyUrl: "https://chat.vaybik.ru/privacy",
    });
    expect(html).toContain('id="vaybik-consent"');
    expect(html).toContain(ANALYTICS_CONSENT_COOKIE);
    expect(html).toContain("https://chat.vaybik.ru/privacy");
    expect(html).toContain('data-consent="1"');
    expect(html).toContain("webvisor:true");
    // тег не вставлен в HTML напрямую — только после cookie=1 в JS
    expect(html).not.toMatch(/<script[^>]+mc\.yandex\.ru\/metrika\/tag\.js/);
    expect(html).toContain("mc.yandex.ru/metrika/tag.js");
    expect(html).toContain('if(c==="1"){loadMetrika();return;}');
  });

  it("verification meta в head при public + domain", () => {
    const html = renderSiteDocument({
      mode: "public",
      title: "Главная",
      path: "/",
      template: "home",
      blocks: [],
      nav: [],
      assetsOrigin: "https://vaybik.ru",
      siteOrigin: "https://vaybik.ru",
      domain: {
        analytics: {
          yandexWebmaster: "yw-token",
          googleSearchConsole: "gsc-token",
          yandexMetrika: "99",
        },
        privacyUrl: "https://chat.vaybik.ru/privacy",
      },
    });
    expect(html).toContain('name="yandex-verification" content="yw-token"');
    expect(html).toContain(
      'name="google-site-verification" content="gsc-token"',
    );
    expect(html).toContain("vaybik-consent");
    expect(html).not.toContain("/js/metrika.js");
  });
});

describe("renderVerificationMeta", () => {
  it("пустой — пустая строка", () => {
    expect(renderVerificationMeta(null)).toBe("");
  });
});
