import {test,expect} from "@playwright/test";

test("mobile header Kartu Member opens usable access page",async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator(".mobile-nav summary").click();
  await page.locator(".mobile-nav-list").getByRole("link",{name:"Kartu Member"}).click();
  await expect(page).toHaveURL(/\/membership\/?$/);
  await expect(page.getByRole("heading",{name:"Sudah punya kartu member?"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Buka Kamera"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Pilih Foto QR"})).toBeVisible();
  await expect(page.locator(".member-entry-actions").getByRole("link",{name:/Masuk Admin/})).toHaveAttribute("href","/admin/login");
});

test("customer QR entry needs no owner session and renders without horizontal overflow",async ({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto("/membership");
  await expect(page.getByRole("heading",{name:"Sudah punya kartu member?"})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".customer-image-input")).toHaveAttribute("accept",/image\/png/);
});

test("desktop navigation Kartu Member goes to membership route",async ({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto("/");
  await page.locator(".desktop-nav").getByRole("link",{name:"Kartu Member"}).click();
  await expect(page).toHaveURL(/\/membership\/?$/);
});
