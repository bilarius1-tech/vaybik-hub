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

test("создать сервис и увидеть статус", async ({ page }) => {
  await login(page);
  const slug = `e2e-${Date.now().toString(36)}`;
  await page.goto("/admin/services/new");
  await page.getByLabel("Название").fill("E2E Example");
  await page.getByLabel("Slug").fill(slug);
  await page.getByRole("textbox", { name: "URL", exact: true }).fill("https://example.com");
  await page.getByLabel("Health URL").fill("https://example.com");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/services/${slug}`));
  await expect(page.getByRole("heading", { name: "E2E Example" })).toBeVisible();
  await page.getByRole("button", { name: "Проверить сейчас" }).click();
  await expect(page.getByText(/Проверка выполнена|UP|DEGRADED|DOWN|UNKNOWN/)).toBeVisible({
    timeout: 20_000,
  });
});
