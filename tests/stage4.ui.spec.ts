import {test,expect} from "@playwright/test";

test("member management, registration and card routes require owner session",async ({page})=>{
 for(const route of ["/admin/members","/admin/members/new","/admin/members/00000000-0000-4000-8000-000000000000/card"]){
   await page.goto(route);
   await expect(page).toHaveURL(/\/admin\/login/);
 }
});

test("public card rejects malformed and revoked-looking tokens",async ({page})=>{
 for(const path of ["/k/123","/k/not-a-token","/k/this_does_not_have_enough_entropy"]){
   const r=await page.goto(path);
   expect(r?.status()).toBe(404);
 }
});

test("public page renders without horizontal overflow at narrow viewport when token invalid",async ({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.goto("/k/123");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
