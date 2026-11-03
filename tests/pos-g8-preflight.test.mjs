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
test("G8 never passes without owner-actor writes, service-duration policy and cashier ID risk review",()=>{
 const blockers=evaluatePosG8(receipt).blockers;
 for(const x of ["ownerPosWriteUat","durationPolicySignOff","cashierIdentityRiskApproval"]){
  assert.ok(blockers.some(y=>y.includes(x)),x);
 }
 const r=structuredClone(receipt);
 r.status="GO";r.productionPosTables=20;r.productionOutletCount=1;
 assert.ok(evaluatePosG8(r).blockers.some(x=>x.includes("GO_CANDIDATE")));
});
test("QA audit receipt cannot be misinterpreted as Production readiness",()=>{
 assert.equal(receipt.productionPosTables,0);
 assert.equal(receipt.qaReadOnlyReceipt.posTables,20);
 assert.equal(receipt.qaReadOnlyReceipt.writeEnabledOutlets,0);
 assert.equal(receipt.evidence.ownerPosWriteUat.verified,false);
});

function candidate(){
 const r=structuredClone(receipt);
 r.status="GO_CANDIDATE";r.productionPosTables=20;r.productionOutletCount=1;
 r.reviewedMainSha="a".repeat(40);r.deployedProductionSha=r.reviewedMainSha;
 r.evidence=Object.fromEntries(Object.keys(r.evidence).map(name=>[name,{
  verified:true,reference:"evidence/actual-reviewed-receipt",reviewer:"Reviewer",
  reviewedMainSha:r.reviewedMainSha,
 }]));
 return r;
}
test("preflight requires explicit false for every posting switch",()=>{
 const r=candidate();assert.equal(evaluatePosG8(r).ready,true);
 for(const key of ['financePostingEnabled','importBackfillEnabled']){
  for(const value of [undefined,null,0,'false']){
   const bad=structuredClone(r);bad[key]=value;
   assert.equal(evaluatePosG8(bad).ready,false,key+': '+String(value));
  }
 }
});
test("evidence from a different code revision cannot authorize this release",()=>{
 const r=candidate();
 r.evidence.ownerPosWriteUat.reviewedMainSha="b".repeat(40);
 assert.equal(evaluatePosG8(r).ready,false);
 delete r.evidence.ownerPosWriteUat.reviewedMainSha;
 assert.equal(evaluatePosG8(r).ready,false);
});
test("database finance gate is independently verified off",()=>{
 const r=candidate();r.productionFinanceEnabledOutlets=1;
 assert.equal(evaluatePosG8(r).ready,false);
 delete r.productionFinanceEnabledOutlets;
 assert.equal(evaluatePosG8(r).ready,false);
});
