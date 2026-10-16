import {test,expect} from "@playwright/test";
for(const route of ["/admin/scan","/admin/members/00000000-0000-4000-8000-000000000000"]) {
 test(`owner visit route ${route} denies unauthenticated visitor`,async ({page})=>{
  await page.goto(route);
  await expect(page).toHaveURL(/\/admin\/login/);
 });
}
test("public malformed QR token does not open owner or count a visit",async ({page})=>{
 const r=await page.goto("/k/invalid");
 expect(r?.status()).toBe(404);
 await expect(page.locator(".owner-record-button")).toHaveCount(0);
});
