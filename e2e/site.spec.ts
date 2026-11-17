import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import { generateSync } from "otplib";

const EMAIL = process.env.E2E_EMAIL || "e2e-owner@vaybik.test";
const PASSWORD = process.env.E2E_PASSWORD || "e2e-password-12";
const TOTP_SECRET =
  process.env.E2E_TOTP_SECRET || "3NOK6FBL53UNIUTA2EWAO6W2ZDH34YPF";

test.describe.configure({ mode: "serial" });

async function login(page: import("@playwright/test").Page) {
  execSync("npx tsx scripts/seed-e2e-user.ts", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Двухфакторная аутентификация")).toBeVisible();
  await page.getByLabel("Код").fill(generateSync({ secret: TOTP_SECRET }));
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible({
    timeout: 15_000,
  });
}

test("сайт: создать страницу, faq-блок, предпросмотр noindex", async ({
  page,
}) => {
  await login(page);
  const slug = Date.now().toString(36);
  const path = `/e2e-${slug}/`;
  const title = `E2E ${slug}`;

  await page.goto("/admin/site");
  await expect(page.getByRole("heading", { name: "Сайт" })).toBeVisible();

  const createCard = page.locator("text=Создать страницу").locator("..").locator("..");
  await createCard.getByPlaceholder("/uslugi/").fill(path);
  await createCard.locator("input").nth(1).fill(title);
  await page.getByRole("button", { name: "Создать страницу" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 15_000,
  });

  // select типа блока перед кнопкой «Добавить блок»
  const addSelect = page
    .getByRole("button", { name: "Добавить блок" })
    .locator("..")
    .locator("select");
  await addSelect.selectOption("faq");
  await page.getByRole("button", { name: "Добавить блок" }).click();
  await expect(page.getByText("Блок: FAQ")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Сохранить блок" }).click();
  await expect(page.getByText("Блок сохранён")).toBeVisible({ timeout: 10_000 });

  const previewPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Предпросмотр" }).click();
  const popup = await previewPromise;
  await popup.waitForLoadState("domcontentloaded");
  const robots = await popup
    .locator('meta[name="robots"]')
    .getAttribute("content");
  expect(robots).toMatch(/noindex/);
  await expect(popup.locator(".cms-preview-banner")).toContainText(
    "Предпросмотр",
  );
});
