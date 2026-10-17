import {test,expect} from "@playwright/test";
test("point-rule editor is unavailable even via its former direct URL",async ({page})=>{
 const response=await page.goto("/admin/points/rules?year=2027");
 expect(response?.status()).toBe(404);
 await expect(page.getByRole("button",{name:/Simpan Aturan Poin/})).toHaveCount(0);
});
test("unauthenticated member route never exposes amounts or point history",async ({page})=>{
 await page.goto("/admin/members/00000000-0000-4000-8000-000000000000");
 await expect(page).toHaveURL(/\/admin\/login/);
 await expect(page.locator('[name="amountIdr"]')).toHaveCount(0);
});
