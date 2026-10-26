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
 await expect(password).toHaveCSS('outline-color','rgb(109, 40, 217)');
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
  await expect(page.getByRole("heading",{name:"Kartu member",exact:true})).toBeVisible();
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
