import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

const styles = readFileSync("app/k/[token]/progress.css", "utf8");
for(const width of [320, 360, 390, 768, 1440]) {
 test(`QR progress styling remains legible at ${width}px`, async ({page}) => {
   await page.setViewportSize({width,height:820});
   // Style-only fixture: no bearer token, member data, or live Supabase credentials.
   await page.setContent(`<main class="member-public"><div class="member-public-shell">
     <p class="admin-kicker">MAS JAWA LAUNDRY</p>
     <h1>Progress Member</h1>
     <p class="member-public-id">MJL-000005</p>
     <div class="member-count"><span>Transaksi tercatat</span><strong>0</strong>
       <small>Checklist dicatat oleh pemilik laundry, bukan saat kartu di-scan.</small></div>
     <h2>Promo untuk Anda</h2>
     <p class="member-note">Belum ada promo khusus untuk kartu ini.</p>
     <p class="member-note">Halaman ini hanya menampilkan informasi.</p>
     <small class="member-public-foot">Mas Jawa Laundry · Tanpa login pelanggan</small>
   </div></main>`);
   await page.addStyleTag({content:styles});
   await expect(page.getByRole("heading", {name:"Progress Member"})).toBeVisible();
   await expect(page.locator(".member-count strong")).toHaveText("0");
   await expect(page.locator(".member-public-shell")).toBeVisible();
   const values=await page.evaluate(()=>{
      const root=document.querySelector(".member-public");
      const label=document.querySelector(".member-count span");
      const number=document.querySelector(".member-count strong");
      const small=document.querySelector(".member-count small");
      return {
       overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
       flex:getComputedStyle(document.querySelector(".member-count")).display,
       labelBottom:label.getBoundingClientRect().bottom,
       numberTop:number.getBoundingClientRect().top,
       numberBottom:number.getBoundingClientRect().bottom,
       explanationTop:small.getBoundingClientRect().top,
       rootPadding:getComputedStyle(root).paddingLeft
      };
   });
   expect(values.overflow).toBeLessThanOrEqual(1);
   expect(values.flex).toBe("flex");
   expect(values.numberTop).toBeGreaterThan(values.labelBottom);
   expect(values.explanationTop).toBeGreaterThan(values.numberBottom);
   mkdirSync("artifacts/stage4", {recursive:true});
   await page.screenshot({path:`artifacts/stage4/customer-progress-${width}.png`,fullPage:true});
 });
}
