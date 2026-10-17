import { test, expect } from "@playwright/test";

test("mobile menu opens member page at the top, not at a previous scroll position",async ({page})=>{
  await page.setViewportSize({width:375,height:780});
  await page.goto("/");
  await page.evaluate(()=>window.scrollTo({top:document.body.scrollHeight,behavior:"instant"}));
  await page.locator(".mobile-nav summary").click();
  await page.locator(".mobile-nav-list a").filter({hasText:"Kartu Member"}).click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(page.getByRole("heading",{name:"Simpan kartu, transaksi tercatat."})).toBeVisible();
  await expect(page.locator(".member-entry-actions").getByRole("link",{name:/Scan QR Kartu/})).toBeVisible();
  await expect(page.locator(".member-entry-actions").getByRole("link",{name:/Masuk Admin/})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThanOrEqual(5);
  await expect(page.locator(".mobile-nav")).not.toHaveAttribute("open","");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("customer scan shortcut scrolls to scan; admin shortcut routes to password login",async ({page})=>{
  await page.setViewportSize({width:375,height:780});
  await page.goto("/membership");
  const entries=page.locator(".member-entry-actions");
  await entries.getByRole("link",{name:/Scan QR Kartu/}).click();
  await expect(page).toHaveURL(/\/membership#scan-kartu$/);
  await expect(page.getByRole("heading",{name:"Sudah punya kartu member?"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Buka Kamera"})).toBeVisible();
  await page.goto("/membership");
  await entries.getByRole("link",{name:/Masuk Admin/}).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByLabel("ID Pengguna")).toHaveValue("masjawalaundry");
  await expect(page.locator('input[name="password"]')).toBeEmpty();
});
