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

test("создать секрет и раскрыть после reauth", async ({ page }) => {
  await login(page);
  const title = `e2e-secret-${Date.now().toString(36)}`;
  await page.goto("/admin/vault");
  await expect(page.getByRole("heading", { name: "Доступы" })).toBeVisible();

  await page.locator("#t").fill(title);
  await page.locator("#k").selectOption("login");
  await page.locator("#p").fill("super-secret-e2e-password");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Запись создана")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(title)).toBeVisible();

  await page.locator("#vp").fill(PASSWORD);
  await page.locator("#vc").fill(generateSync({ secret: TOTP_SECRET }));

  const row = page.locator("tr", { hasText: title });
  await row.getByRole("button", { name: "Показать" }).click();
  await expect(page.getByText("Секреты:")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("super-secret-e2e-password")).toBeVisible();
});
