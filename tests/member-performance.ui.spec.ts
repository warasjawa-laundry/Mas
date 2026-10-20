import {test,expect} from '@playwright/test';
for(const path of ['/membership','/admin/login'])test(`operational page ${path} has no remote font dependency`,async({page})=>{
 const fonts:string[]=[];page.on('request',request=>{if(/fonts\.(googleapis|gstatic)\.com/.test(request.url()))fonts.push(request.url())});
 await page.goto(path);await page.waitForLoadState('networkidle');
 await expect(page.locator('h1,h2').first()).toBeVisible();expect(fonts).toEqual([]);
});
