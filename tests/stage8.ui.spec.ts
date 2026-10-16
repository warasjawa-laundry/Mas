import {test,expect} from "@playwright/test";
test("editing contact details requires authenticated owner",async ({page})=>{
 await page.goto("/admin/members/00000000-0000-4000-8000-000000000000/edit");
 await expect(page).toHaveURL(/\/admin\/login/);
 await expect(page.locator('input[name="customerConfirmed"]')).toHaveCount(0);
});
test("unauthenticated visitor cannot see owner phone or edit menu",async ({page})=>{
 await page.goto("/admin/members");
 await expect(page).toHaveURL(/\/admin\/login/);
 await expect(page.getByText("Ubah Data & WhatsApp")).toHaveCount(0);
});
