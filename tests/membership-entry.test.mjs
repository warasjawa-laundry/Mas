import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
test("every public membership entry uses fresh document navigation, not reused Link scroll state",()=>{
  const header=read("components/site-header.tsx");
  const home=read("app/page.tsx");
  const footer=read("components/site-footer.tsx");
  assert.match(header,/item\.href === "\/membership"[\s\S]*?<a key=\{item\.href\} href=\{siteHref\(item\.href\)\}/);
  assert.match(home,/<a className="button button-white" href=\{siteHref\("\/membership"\)\}/);
  assert.match(footer,/<a href=\{siteHref\("\/membership"\)\}>Kartu Member<\/a>/);
});
test("the first member screen visibly offers scanner and admin entry",()=>{
 const content=read("app/membership/page.tsx");
 const styles=read("app/globals.css");
 assert.match(content,/className="member-entry-actions"/);
 assert.match(content,/href="#scan-kartu"/);
 assert.match(content,/id="scan-kartu"/);
 assert.match(content,/href=\{siteHref\("\/admin\/login"\)\}/);
 assert.match(styles,/\.member-scan-target\{scroll-margin-top:102px\}/);
 assert.doesNotMatch(content,/member-owner-entry/);
 assert.match(content,/<MembershipScrollEntry \/>/);
 const scroll=read("components/membership-scroll-entry.tsx");
 assert.match(scroll,/window\.scrollTo\(\{ top: 0, behavior: "instant" \}\)/);
 assert.match(scroll,/window\.location\.hash/);
 assert.match(scroll,/pageshow/);
});
