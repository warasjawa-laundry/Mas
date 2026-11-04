import {test,expect} from '@playwright/test';
test('homepage navigation and external actions have real destinations without sending a message',async({page,context})=>{
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/html',body:'<h1>External destination intercepted by test</h1>'}));
 await context.route('https://www.google.com/maps/**',route=>route.fulfill({contentType:'text/html',body:'<h1>External destination intercepted by test</h1>'}));
 await page.goto('/');
 for(const name of ['Layanan & Harga','Cara Laundry','Lokasi']){
  const link=page.getByRole('navigation',{name:'Navigasi utama',exact:true}).getByRole('link',{name,exact:true});
  const href=(await link.getAttribute('href'))!;await link.click();
  await expect(page).toHaveURL(new RegExp(href.substring(href.indexOf('#'))+'$'));
 }
 await page.getByRole('link',{name:'Lihat daftar harga',exact:true}).click();await expect(page).toHaveURL(/#layanan$/);
 for(const link of await page.locator('a[href^="https://wa.me/"]').all()){
  if(!await link.isVisible())continue;
  const popup=context.waitForEvent('page');await link.click();const target=await popup;
  await expect(target).toHaveURL(/^https:\/\/wa.me\/6282313359989/);await target.close();
 }
 const popup=context.waitForEvent('page');await page.getByRole('link',{name:/Buka Google Maps/}).click();const maps=await popup;
 await expect(maps).toHaveURL(/google\.com\/maps\/search\/\?api=1/);await maps.close();
 await page.getByRole('navigation',{name:'Navigasi footer'}).getByRole('link',{name:'Harga',exact:true}).click();await expect(page).toHaveURL(/#layanan$/);
 await page.getByRole('link',{name:'Mas Jawa Laundry, kembali ke beranda',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:3000/');
});
