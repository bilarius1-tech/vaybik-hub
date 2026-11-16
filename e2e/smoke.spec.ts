import { expect, test } from "@playwright/test";

test("открывает /admin/login без сессии", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Вход в Вайбик" }).or(
    page.getByText("Вход в Вайбик"),
  )).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
