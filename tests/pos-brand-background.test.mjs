import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("new Mas Jawa banner and transparent motifs are actual independent SVG assets",()=>{
 const banner=src("public/pos/masjawa-login-banner.svg");
 const motif=src("public/pos/masjawa-laundry-pattern.svg");
 assert.match(banner,/<svg[^>]*viewBox="0 0 714 205"/);
 assert.match(motif,/<svg[^>]*viewBox="0 0 480 165"/);
 for(const drawing of [banner,motif]){
  assert.match(drawing,/stroke="#78D6F0"/);
  assert.match(drawing,/stroke="#EEE7FA"/);
  assert.match(drawing,/stroke="#E58BD7"/);
  assert.match(drawing,/rect x="34" y="27"/);
  assert.match(drawing,/M203 47/);
  assert.match(drawing,/M379 62/);
 }
 assert.doesNotMatch(motif,/<rect width="480" height="165" fill=/);
});
test("both unified login and cashier login use the new brand banner; old yellow background retired",()=>{
 const css=src("app/pos-ui.css");
 assert.match(css,/\.binatu-pattern\{[^}]*masjawa-laundry-pattern\.svg/);
 assert.match(css,/\.binatu-login-banner\.binatu-pattern\{[^}]*masjawa-login-banner\.svg/);
 assert.match(css,/\.mj-login-banner\{[^}]*masjawa-login-banner\.svg/);
 assert.doesNotMatch(css,/url\("\/pos\/laundry-pattern\.svg"\)/);
 assert.match(src("app/admin/login/page.tsx"),/binatu-login-banner binatu-pattern/);
 assert.match(src("app/kasir/page.tsx"),/className="mj-login-banner"/);
});
test("owner/cashier board, workspaces and sidebar retain the shared brand background and real logo",()=>{
 for(const path of [
  "app/admin/login/page.tsx","app/kasir/page.tsx",
  "components/pos/pos-board.tsx","components/pos/pos-workspace.tsx",
  "components/admin/admin-navigation.tsx"
 ]){
  const code=src(path);
  assert.match(code,/src=\{assets\.logo\}/,path);
 }
 for(const path of [
  "components/pos/pos-board.tsx",
  "components/pos/pos-workspace.tsx","components/admin/admin-navigation.tsx",
  "app/admin/pos/kasir/page.tsx"
 ]){
  assert.match(src(path),/binatu-pattern/,path);
 }
});
