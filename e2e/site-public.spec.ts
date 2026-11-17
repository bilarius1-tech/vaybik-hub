import { expect, test } from "@playwright/test";

/**
 * Публичный site-сервер. Нужен SITE_BASE_URL (например http://127.0.0.1:3100
 * или https://site-test.vaybik.ru). Без него — skip.
 */
const base = process.env.SITE_BASE_URL;

test.describe("site public", () => {
  test.skip(!base, "SITE_BASE_URL не задан");

  test("healthz ok", async ({ request }) => {
    const res = await request.get(`${base}/healthz`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  test("главная отдаёт X-Vaybik-Site: cms", async ({ request }) => {
    const res = await request.get(`${base}/`);
    expect(res.status()).toBe(200);
    expect(res.headers()["x-vaybik-site"]).toBe("cms");
    const html = await res.text();
    expect(html).toContain("<main");
  });

  test("robots на не-vaybik.ru — Disallow: /", async ({ request }) => {
    const res = await request.get(`${base}/robots.txt`);
    expect(res.status()).toBe(200);
    const text = await res.text();
    // на тестовом хосте всегда Disallow
    if (!base?.includes("vaybik.ru") || base.includes("site-test")) {
      expect(text).toContain("Disallow: /");
    }
  });
});
