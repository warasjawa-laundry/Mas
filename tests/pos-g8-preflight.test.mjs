import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluatePosG8} from "../scripts/pos-g8-preflight.mjs";
const receipt=JSON.parse(readFileSync(new URL("../docs/pos/g8-readiness.json",import.meta.url),"utf8"));
test("current G8 receipt fails closed; no invented sign-off",()=>{
 const result=evaluatePosG8(receipt);
 assert.equal(result.ready,false);
 assert.ok(result.blockers.some(x=>x.includes("production POS schema")));
 assert.ok(result.blockers.some(x=>x.includes("restoreRehearsal")));
 assert.ok(result.blockers.some(x=>x.includes("physicalQrUat")));
});
test("unverified false cannot be replaced by a name-only record",()=>{
 const forged=structuredClone(receipt);
 forged.productionPosTables=20;forged.productionOutletCount=1;
 forged.reviewedMainSha="a".repeat(40);forged.deployedProductionSha="a".repeat(40);
 forged.evidence=Object.fromEntries(Object.keys(receipt.evidence).map(name=>[name,{verified:true,reference:"",reviewer:"Owner"}]));
 assert.equal(evaluatePosG8(forged).ready,false);
});
test("different deploy commit or Vercel connection always blocks",()=>{
 const r=structuredClone(receipt);
 r.vercelGitConnection="another-owner/another-repo";
 r.reviewedMainSha="a".repeat(40);r.deployedProductionSha="b".repeat(40);
 assert.ok(evaluatePosG8(r).blockers.some(x=>x.includes("SHA")));
 assert.ok(evaluatePosG8(r).blockers.some(x=>x.includes("Vercel")));
});
test("no auto-enable switch: any live write during preflight is NO-GO",()=>{
 const r=structuredClone(receipt);r.financePostingEnabled=true;
 assert.ok(evaluatePosG8(r).blockers.some(x=>x.includes("financial writes")));
});