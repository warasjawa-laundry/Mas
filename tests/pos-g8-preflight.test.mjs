import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluatePosG8} from "../scripts/pos-g8-preflight.mjs";
const receipt=JSON.parse(readFileSync(new URL("../docs/pos/g8-readiness.json",import.meta.url),"utf8"));
test("current G8 receipt fails closed; no invented sign-off",()=>{
 const result=evaluatePosG8(receipt);
 assert.equal(result.ready,false);
 assert.equal(receipt.productionPosTables,22);
 assert.equal(receipt.productionWriteEnabledOutlets,1);
 assert.equal(receipt.productionFinanceEnabledOutlets,1);
 assert.equal(receipt.financePostingEnabled,true);
 assert.ok(result.blockers.some(x=>x.includes("financial writes")));
 assert.ok(result.blockers.some(x=>x.includes("restoreRehearsal")));
 assert.ok(result.blockers.some(x=>x.includes("physicalQrUat")));
});
test("unverified false cannot be replaced by a name-only record",()=>{
 const forged=candidate();
 forged.productionPosTables=22;forged.productionOutletCount=1;
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
 const r=candidate();r.financePostingEnabled=true;
 assert.ok(evaluatePosG8(r).blockers.some(x=>x.includes("financial writes")));
});
test("G8 never passes without owner-actor writes, service-duration policy and cashier ID risk review",()=>{
 const blockers=evaluatePosG8(receipt).blockers;
 for(const x of ["ownerPosWriteUat","durationPolicySignOff","cashierIdentityRiskApproval"]){
  assert.ok(blockers.some(y=>y.includes(x)),x);
 }
 const r=structuredClone(receipt);
 r.status="GO";r.productionPosTables=22;r.productionOutletCount=1;
 assert.ok(evaluatePosG8(r).blockers.some(x=>x.includes("GO_CANDIDATE")));
});
test("matching Production and QA schemas cannot substitute for financial UAT",()=>{
 assert.equal(receipt.productionPosTables,22);
 assert.equal(receipt.qaReadOnlyReceipt.posTables,22);
 assert.equal(receipt.qaReadOnlyReceipt.writeEnabledOutlets,0);
 assert.equal(receipt.evidence.ownerPosWriteUat.verified,false);
});

function candidate(){
 const r=structuredClone(receipt);
 r.status="GO_CANDIDATE";r.productionPosTables=22;r.productionOutletCount=1;
 r.productionWriteEnabledOutlets=0;r.productionFinanceEnabledOutlets=0;
 r.financePostingEnabled=false;r.importBackfillEnabled=false;
 r.productionPilotTestOnly=false;r.productionTestOrderCount=0;
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

// Package and family tables are required by the current application schema.
test("package schema readiness requires 22 tables and rejects the old 20-table contract",()=>{
 const current=candidate();current.productionPosTables=22;
 assert.equal(evaluatePosG8(current).ready,true);
 current.productionPosTables=20;
 assert.equal(evaluatePosG8(current).ready,false);
});

test("real go-live rejects an active or unverified dummy pilot and any remaining test orders",()=>{
 const clean=candidate();clean.productionPilotTestOnly=false;clean.productionTestOrderCount=0;
 assert.equal(evaluatePosG8(clean).ready,true);
 for(const value of [true,undefined,null,0,'false']){
  const bad=structuredClone(clean);bad.productionPilotTestOnly=value;
  assert.equal(evaluatePosG8(bad).ready,false,String(value));
 }
 for(const value of [1,-1,undefined,null,'0']){
  const bad=structuredClone(clean);bad.productionTestOrderCount=value;
  assert.equal(evaluatePosG8(bad).ready,false,String(value));
 }
});
