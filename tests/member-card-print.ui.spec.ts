import {test, expect} from "@playwright/test";
import {readFileSync, mkdirSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {renderToStaticMarkup} from "react-dom/server";
import type {ReactNode} from "react";
import ts from "typescript";
import QRCode from "qrcode";

// Exact production presentation component; only identity and QR are synthetic.
// No member records, bearer tokens or signed-in session are used in artifacts.
test.use({deviceScaleFactor:3});

const compiled=ts.transpileModule(readFileSync("components/admin/member-print-card.tsx","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
const output={exports:{} as {default:(props:Record<string,string>)=>ReactNode}};
runInNewContext(compiled,{require:createRequire(process.cwd()+"/package.json"),exports:output.exports,module:output});
const css=readFileSync("app/admin/admin.css","utf8");
const logo="https://raw.githubusercontent.com/warasjawa-laundry/Web-asset/f259a9e48d3a52552e97d5540546f359ca16631f/IMG-20251228-WA0010.jpg";

for(const width of [320,1440]){
 test(`final member card stays readable and prints at physical size from ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const qrSvg=await QRCode.toString("https://example.invalid/member-design-sample",{type:"svg",errorCorrectionLevel:"M",margin:4,width:512});
  const card=renderToStaticMarkup(output.exports.default({name:"Nama Contoh",number:"MJL-000001",qrSvg,logoUrl:logo}));
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}${css}</style><div class="admin-root"><aside class="admin-shell-sidebar">Menu admin</aside><header class="admin-mobile-header">Admin</header><nav class="admin-shell-mobile">Navigasi HP</nav><main class="admin-workspace"><section class="admin-content print-card-page"><h1 class="no-print">Kartu Siap Cetak</h1>${card}<button class="no-print">Cetak Kartu</button></section></main></div>`);
  await expect(page.locator(".mj-card")).toContainText("KARTU MEMBER");
  await expect(page.locator(".mj-card")).not.toContainText(/UJI COBA|PREVIEW|REVIEW/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);
  mkdirSync("artifacts/screenshots",{recursive:true});
  await page.screenshot({path:`artifacts/screenshots/member-card-screen-${width}.png`,fullPage:true});
  await page.emulateMedia({media:"print"});
  await page.setViewportSize({width:794,height:1123});
  for(const selector of [".admin-shell-sidebar",".admin-shell-mobile",".admin-mobile-header",".no-print"]){
   await expect(page.locator(selector).first()).toBeHidden();
  }
  const bounds=await page.locator(".mj-card").boundingBox();
  expect(bounds!.width).toBeCloseTo(85.6*96/25.4,0);
  expect(bounds!.height).toBeCloseTo(53.98*96/25.4,0);
  await page.screenshot({path:`artifacts/screenshots/member-card-print-${width}.png`,fullPage:true});
  await page.locator(".mj-card").screenshot({path:`artifacts/screenshots/member-card-final-${width}.png`});
  // 100-character names must remain inside the identity area without clipping.
  await page.locator(".mj-card-bottom>strong").evaluate(el=>{el.textContent="W".repeat(100);el.setAttribute("class","mj-card-name-small");});
  expect(await page.locator(".mj-card").evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
  const identity=await page.locator(".mj-card-info").boundingBox();
  const code=await page.locator(".mj-card-code").boundingBox();
  expect(identity!.x+identity!.width).toBeLessThan(code!.x);
 });
}
