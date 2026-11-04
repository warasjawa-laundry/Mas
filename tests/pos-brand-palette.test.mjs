import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const pos=read("app/pos-ui.css");
const admin=read("app/admin/admin.css");
const wizard=read("app/kasir/pesanan/baru/wizard.module.css");
const orders=read("app/kasir/pesanan/orders.module.css");
const globalStyles=read("app/globals.css");
const css=[pos,admin,wizard,orders,globalStyles].join("\n");
function luminance(hex){
 const v=hex.slice(1).match(/.{2}/g).map(s=>parseInt(s,16)/255);
 return v.map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4)
  .reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);
}
function contrast(foreground,background){
 const [a,b]=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
 return (a+0.05)/(b+0.05);
}
test("MasJawa palette has readable control, selection, alert and unpaid text",()=>{
 for(const [label,fg,bg] of [
  ["primary CTA","#FFFFFF","#5B3F8C"],
  ["hover CTA","#FFFFFF","#49316F"],
  ["selected navigation","#4B3677","#F3EEFA"],
  ["unpaid status","#7B3258","#F7EAF2"],
  ["information notice","#355D83","#EAF2FB"],
  ["warning message","#79324E","#F9EBF2"],
 ])assert.ok(contrast(fg,bg)>=4.5,label);
});
test("legacy yellow POS palette is gone from current styles, leaving semantic success/destructive colors",()=>{
 assert.doesNotMatch(css,/#(?:f7b801|f5b500|e5aa00|e8ac00|fef5d1|fdf3d0|fff4dc|fff4cd|fff8df|fff3c4|fff6d4|fff8db|fff8e9|fff3e7|f0d8a0|ecdeac|e7c65c|c99e31|aa7b00|b68300|bb8900|956a00|805c00|665000)\b/i);
 assert.doesNotMatch(css,/--(?:mj-gold|admin-yellow)/);
 assert.match(pos,/--mj-primary:#5B3F8C/);
 assert.match(pos,/--mj-info-bg:#EAF2FB/);
 assert.match(pos,/--mj-unpaid-bg:#F7EAF2/);
 assert.match(orders,/\.dangerButton\{background:#a62925/);
 assert.match(pos,/\.binatu-payment-badge\.is-paid\{background:#e6f7ec/);
});
test("owner and cashier primary actions are purple with white foreground; selected tabs and menus stay light",()=>{
 assert.match(admin,/\.admin-primary, \.member-add, \.member-directory-add, \.member-directory-record \{[\s\S]*?color: #fff; background: var\(--admin-primary\)/);
 assert.match(pos,/\.binatu-button\{[^}]*background:var\(--mj-primary\);color:#fff!important/);
 assert.match(pos,/\.mj-login-fields form>button,[^}]*background:var\(--mj-primary\);color:#fff/);
 assert.match(orders,/\.mainLink,\.mainButton\{[^}]*background:#5B3F8C;[^}]*color:#fff!important/);
 assert.match(wizard,/\.primary,\.back\{[^}]*background:#5B3F8C;color:#fff/);
 assert.match(pos,/\.binatu-side-links>a\[aria-current=page\]\{background:var\(--mj-primary-soft\)/);
 assert.match(orders,/\.tabs a\[aria-current=page\]\{background:#F3EEFA/);
 assert.match(wizard,/\.categories button\[aria-pressed=true\]\{background:#E1D5F4/);
});
