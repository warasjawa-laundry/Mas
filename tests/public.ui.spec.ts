import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const widths = [320, 360, 390, 768, 1024, 1440];
const routes = ["/", "/membership"];

// Visuals are captured in a real Chromium engine at simulated viewports.
// This is not a substitute for physical Android testing or owner content approval.
for (const route of routes) {
  for (const width of widths) {
    test(`layout ${route} at ${width}px does not overflow or go blank`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      const headline = page.locator("h1");
      await expect(headline).toHaveCount(1);
      await expect(headline).toBeVisible();

      // Make sure the page remains usable in a narrow Android browser.
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `Horizontal overflow on ${route} at ${width}px`).toBeLessThanOrEqual(1);

      mkdirSync("artifacts/screenshots", { recursive: true });
      const slug = route === "/" ? "homepage" : "membership";
      await page.screenshot({ path: `artifacts/screenshots/${slug}-${width}.png`, fullPage: true });
    });
  }
}

test("mobile menu reveals relevant navigation without requiring JS-only disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const menu = page.locator(".mobile-nav");
  await menu.locator("summary").click();
  await expect(menu.getByRole("link", { name: "Kartu Member" })).toBeVisible();
  await menu.getByRole("link", { name: "Kartu Member" }).click();
  await expect(page).toHaveURL(/\/membership\/?$/);
  await expect(page.getByRole("heading", { name: "Sudah punya kartu member?" })).toBeVisible();
});

test("approved membership page shows final copy and preserves metadata", async ({ page }) => {
  await page.goto("/membership", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/program sedang disiapkan|kartu uji coba|preview/i)).toHaveCount(0);
  await expect(page.getByText("Scan QR untuk melihat poin, riwayat transaksi, dan promo member.", {exact:false})).toBeVisible();
  await expect(page.locator("meta[property='og:url']")).toHaveAttribute(
    "content", "https://masjawalaundry.web.id/membership"
  );
  await expect(page.locator("meta[property='og:title']")).toHaveAttribute(
    "content", "Kartu Member | Mas Jawa Laundry"
  );
});

test("reduced-motion preference removes smooth scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior))
    .toBe("auto");
});

test("mobile homepage does not duplicate or overlay the primary WhatsApp CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".mobile-cta")).toHaveCount(0);
  await expect(page.locator(".hero-actions").getByRole("link", { name: /Hubungi lewat WhatsApp/ })).toBeVisible();
});
