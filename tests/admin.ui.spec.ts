import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

test("owner login asks for ID and password, never an email", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  const response = await page.goto("/admin/login");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Masuk Pemilik" })).toBeVisible();
  await expect(page.getByLabel("ID Pengguna")).toHaveValue("masjawalaundry");
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "password");
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  mkdirSync("artifacts/stage3", { recursive: true });
  await page.screenshot({ path: "artifacts/stage3/login-360.png", fullPage: true });
});

test("owner can show and hide password without changing its value", async ({ page }) => {
  await page.goto("/admin/login");
  const password = page.locator('input[name="password"]');
  await password.fill("OnlyADemoSecret2026!");
  await page.getByRole("button", { name: "Lihat password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("OnlyADemoSecret2026!");
  await page.getByRole("button", { name: "Sembunyikan password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("admin scan and password settings are inaccessible without verified owner", async ({ page }) => {
  await page.goto("/admin/scan");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("no configured Auth identity means password cannot be accepted in demo preview", async ({ page }) => {
  // CI deliberately has no owner account or Supabase credentials.
  await page.goto("/admin/login");
  await page.getByLabel("ID Pengguna").fill("masjawalaundry");
  await page.locator('input[name="password"]').fill("NotARealLivePassword!");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.locator(".admin-error[role='alert']")).toContainText("belum diaktifkan");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("login page remains clean and readable on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Masuk Pemilik" })).toBeVisible();
  mkdirSync("artifacts/stage3", { recursive: true });
  await page.screenshot({ path: "artifacts/stage3/login-1440.png", fullPage: true });
});
