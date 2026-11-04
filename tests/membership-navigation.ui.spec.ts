import { test, expect } from "@playwright/test";

test("mobile menu closes after in-page navigation and Escape returns focus",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const menu=page.locator('.mobile-nav');const toggle=menu.locator('summary');
 await toggle.click();await menu.getByRole('link',{name:'Layanan & Harga',exact:true}).click();
 await expect(page).toHaveURL(/#layanan$/);await expect(menu).not.toHaveAttribute('open','');
 await toggle.click();await menu.getByRole('link',{name:'Kartu Member',exact:true}).focus();
 await page.keyboard.press('Escape');await expect(menu).not.toHaveAttribute('open','');await expect(toggle).toBeFocused();
});

test("invalid member card offers a route back to the scanner",async({page})=>{
 await page.goto('/k/invalid');
 await expect(page.getByRole('heading',{name:'Kartu belum dapat dibuka'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Pindai kartu lagi',exact:true})).toHaveAttribute('href','/membership#scan-kartu');
});

for(const width of [320,390,1440])test(`password visibility control has a usable target and input focus at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/admin/login');
 const toggle=page.getByRole('button',{name:'Lihat password',exact:true});const box=(await toggle.boundingBox())!;
 expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);
 const password=page.getByRole('textbox',{name:'Password',exact:true});await password.focus();
 await expect(password).toHaveCSS('outline-color','rgb(34, 37, 42)');
 await expect(password).toHaveCSS('outline-style','solid');
 await expect(password).toHaveCSS('outline-width','3px');
 await toggle.click();await expect(page.locator('#owner-password')).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Sembunyikan password',exact:true}).click();await expect(page.locator('#owner-password')).toHaveAttribute('type','password');
});

test("mobile menu opens member page at the top, not at a previous scroll position",async ({page})=>{
  await page.setViewportSize({width:375,height:780});
  await page.goto("/");
  await page.evaluate(()=>window.scrollTo({top:document.body.scrollHeight,behavior:"instant"}));
  await page.locator(".mobile-nav summary").click();
  await page.locator(".mobile-nav-list a").filter({hasText:"Kartu Member"}).click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(page.getByRole("heading",{name:"Scan Kartu Member",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Buka Kamera",exact:true})).toBeVisible();
  await expect(page.locator('a[href*="/admin"], a[href*="/kasir"]')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThanOrEqual(5);
  await expect(page.locator(".mobile-nav")).not.toHaveAttribute("open","");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("scanner is immediately available and owner login remains accessible by its own route",async ({page})=>{
  await page.setViewportSize({width:375,height:780});
  await page.goto("/membership");
  await expect(page.getByRole("heading",{name:"Pilih cara memindai"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Buka Kamera"})).toBeVisible();
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByLabel("ID Pengguna")).toHaveValue("masjawalaundry");
  await expect(page.locator('input[name="password"]')).toBeEmpty();
});
