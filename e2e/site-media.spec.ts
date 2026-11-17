import { expect, test } from "@playwright/test";
import { execSync } from "node:child_process";
import { generateSync } from "otplib";

const EMAIL = process.env.E2E_EMAIL || "e2e-owner@vaybik.test";
const PASSWORD = process.env.E2E_PASSWORD || "e2e-password-12";
const TOTP_SECRET =
  process.env.E2E_TOTP_SECRET || "3NOK6FBL53UNIUTA2EWAO6W2ZDH34YPF";

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

test("медиа: загрузка PNG на вкладке Медиа", async ({ page }) => {
  await login(page);
  await page.goto("/admin/site");
  await page.getByRole("tab", { name: "Медиа" }).click();
  await expect(page.getByText("Папки", { exact: true })).toBeVisible();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "e2e-tiny.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByText(/Загружено|уже есть/)).toBeVisible({
    timeout: 20_000,
  });
});
