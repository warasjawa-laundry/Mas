import {test,expect} from "@playwright/test";
import {createRequire} from "node:module";
const requireFixture=createRequire(process.cwd()+"/package.json");
const qr=requireFixture("qrcode");
const sharp=requireFixture("sharp");
const token="A".repeat(43); // Synthetic, never a real member credential.
const cardUrl="https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app/k/"+token;
async function screenshot(width:number,height:number,size:number,left:number,top:number,jpeg=false){
 const code=await qr.toBuffer(cardUrl,{width:size,margin:4,errorCorrectionLevel:"M"});
 let picture=sharp({create:{width,height,channels:3,background:"#f4f5f9"}}).composite([
  {input:Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="90" fill="#15181e"/><rect x="28" y="130" width="${width-56}" height="${height-180}" rx="18" fill="white"/><text x="55" y="180" font-size="23" fill="#242c38">MAS JAWA LAUNDRY</text><text x="55" y="230" font-size="20" fill="#51278b">Kartu member</text></svg>`),left:0,top:0},
  {input:code,left,top}]);
 return jpeg?picture.jpeg({quality:85}).toBuffer():picture.png().toBuffer();
}
for(const fixture of [
 {label:"full phone screenshot",width:750,height:1536,size:190,left:440,top:710,jpeg:false},
 {label:"long screenshot with a small QR near the bottom",width:750,height:2800,size:180,left:435,top:2140,jpeg:false},
 {label:"JPEG screenshot",width:1080,height:2400,size:250,left:640,top:1650,jpeg:true},
])test(`gallery reads ${fixture.label} without manual cropping`,async({page})=>{
 test.setTimeout(45000);
 await page.goto("/membership");
 // The invalid synthetic card page is enough: navigation proves local extraction.
 await page.locator(".customer-image-input").setInputFiles({name:fixture.jpeg?"screen.jpg":"screen.png",mimeType:fixture.jpeg?"image/jpeg":"image/png",buffer:await screenshot(fixture.width,fixture.height,fixture.size,fixture.left,fixture.top,fixture.jpeg)});
 await expect(page).toHaveURL(new RegExp(`/k/${token}$`),{timeout:20000});
});
test("gallery refuses a foreign QR and can retry with a valid cropped card",async({page})=>{
 test.setTimeout(45000);await page.goto("/membership");
 await page.locator(".customer-image-input").setInputFiles({name:"foreign.png",mimeType:"image/png",buffer:await qr.toBuffer("https://example.org/k/"+token,{width:280})});
 await expect(page.locator(".customer-card-scanner").getByRole("alert")).toContainText("QR belum terbaca",{timeout:20000});
 await expect(page).toHaveURL(/\/membership$/);
 await page.locator(".customer-image-input").setInputFiles({name:"card.png",mimeType:"image/png",buffer:await qr.toBuffer(cardUrl,{width:320,margin:4})});
 await expect(page).toHaveURL(new RegExp(`/k/${token}$`),{timeout:20000});
});
