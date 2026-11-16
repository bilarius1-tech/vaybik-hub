import { expect, test } from "@playwright/test";

test("открывает /admin с AppShell", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText("Вайбик", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("панель управления")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Сервисы/ })).toBeVisible();
});
