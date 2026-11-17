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
  await expect(page.getByText(/Найдено:/)).toBeVisible();

  await page.getByRole("button", { name: "+ Создать страницу" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("/uslugi/").fill(path);
  await dialog.locator('input').nth(1).fill(title);
  await dialog.getByRole("button", { name: "Создать" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 15_000,
  });

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

test("сайт: список — URL-параметры сортировки и корзина", async ({ page }) => {
  await login(page);
  await page.goto("/admin/site?tab=pages&sort=path&pageSize=25");
  await expect(page.getByRole("heading", { name: "Сайт" })).toBeVisible();
  await expect(page.getByText(/Найдено:/)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("columnheader", { name: /Изменено/ }).click();
  await expect(page).toHaveURL(/sort=-updatedAt/);

  const slug = Date.now().toString(36);
  const path = `/e2e-list-${slug}/`;
  await page.getByRole("button", { name: "+ Создать страницу" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("/uslugi/").fill(path);
  await dialog.locator("input").nth(1).fill(`List ${slug}`);
  await dialog.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("heading", { name: `List ${slug}` })).toBeVisible(
    { timeout: 15_000 },
  );

  await page.goto("/admin/site?tab=pages&q=" + encodeURIComponent(path));
  await expect(page.getByText(path).first()).toBeVisible({ timeout: 10_000 });
  const row = page.locator("tr", { hasText: path });
  await row.getByRole("button", { name: "Удалить" }).click();
  await page.getByRole("button", { name: "В корзину" }).click();
  await expect(page.getByText(/В корзине:/)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Корзина" }).click();
  await expect(page).toHaveURL(/trash=1/);
  await expect(page.getByText(path).first()).toBeVisible();
  await page
    .locator("tr", { hasText: path })
    .getByRole("button", { name: "Восстановить" })
    .click();
  await expect(page.getByText("Восстановлено")).toBeVisible({ timeout: 10_000 });
});
