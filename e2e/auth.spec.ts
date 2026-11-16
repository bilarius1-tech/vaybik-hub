import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import { generateSync } from "otplib";

const EMAIL = process.env.E2E_EMAIL || "e2e-owner@vaybik.test";
const PASSWORD = process.env.E2E_PASSWORD || "e2e-password-12";
const TOTP_SECRET =
  process.env.E2E_TOTP_SECRET || "3NOK6FBL53UNIUTA2EWAO6W2ZDH34YPF";

test.describe.configure({ mode: "serial" });

test.beforeEach(() => {
  execSync("npx tsx scripts/seed-e2e-user.ts", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
});

test("вход с 2FA и выход", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Двухфакторная аутентификация")).toBeVisible();

  const code = generateSync({ secret: TOTP_SECRET });
  await page.getByLabel("Код").fill(code);
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("блокировка после 5 неверных паролей", async ({ page }) => {
  await page.goto("/admin/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Пароль").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Войти" }).click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByText(/Слишком много попыток|15 минут/)).toBeVisible({
    timeout: 10_000,
  });
});
