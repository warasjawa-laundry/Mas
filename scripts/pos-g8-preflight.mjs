/** POS G8 release evidence gate. Read-only: no network, no secrets, no database writes. */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const required=[
 "qaSqlMigration","qaTwoConnectionRace","restoreRehearsal","realOwnerAuthUat",
 "realCashierDeviceUat","physicalQrUat","financialReconciliation",
 "legacyMemberParity","uiOwnerSignOff","cutoverOwnerApproval",
 "ownerPosWriteUat","durationPolicySignOff","cashierIdentityRiskApproval"
];
export function evaluatePosG8(receipt){
 const blockers=[];
 if(!receipt||typeof receipt!=="object"||Array.isArray(receipt))return {ready:false,blockers:["invalid receipt"]};
 if(receipt.schemaVersion!==1)blockers.push("unknown receipt version");
 if(receipt.status!=="GO_CANDIDATE")blockers.push("release status is not GO_CANDIDATE");
 if(receipt.sourceRepository!=="warasjawa-laundry/Mas"||receipt.vercelProject!=="mas")
  blockers.push("wrong source repository or existing Vercel project");
 if(receipt.vercelGitConnection!=="unyilhm1-hue/mas")blockers.push("Vercel Git connection changed");
 if(!/^[0-9a-f]{40}$/.test(receipt.reviewedMainSha||""))blockers.push("missing pinned reviewed main SHA");
 if(!/^[0-9a-f]{40}$/.test(receipt.deployedProductionSha||"")||
   receipt.reviewedMainSha!==receipt.deployedProductionSha)blockers.push("deployed SHA not equal reviewed main");
 if(receipt.productionPosTables!==22||receipt.productionWriteEnabledOutlets!==0)
  blockers.push("production POS schema not verified as 22 tables with zero writes enabled");
 if(receipt.productionOutletCount!==1)blockers.push("exactly one production outlet required");
 if(receipt.productionFinanceEnabledOutlets!==0)blockers.push("production finance gate not independently verified off");
 if(receipt.productionPilotTestOnly!==false)blockers.push("dummy pilot must be explicitly verified off before real go-live");
 if(receipt.productionTestOrderCount!==0)blockers.push("test orders must be reconciled and archived before real go-live");
 for(const name of required){
  const entry=receipt.evidence?.[name];
  if(entry?.verified!==true||typeof entry?.reference!=="string"||entry.reference.length<12||
    typeof entry?.reviewer!=="string"||entry.reviewer.trim().length<2||
    entry.reviewedMainSha!==receipt.reviewedMainSha)
   blockers.push("missing independently reviewed evidence: "+name);
 }
 if(receipt.financePostingEnabled!==false||receipt.importBackfillEnabled!==false)
  blockers.push("financial writes/import posting must remain disabled during preflight");
 return {ready:blockers.length===0,blockers};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.argv[2]||"docs/pos/g8-readiness.json";
 let r;
 try{r=JSON.parse(readFileSync(path,"utf8"))}catch{process.stderr.write("NO-GO: missing/invalid readiness receipt\n");process.exitCode=2}
 if(r){
  const result=evaluatePosG8(r);
  process.stdout.write(result.ready?"GO: reviewed receipt complete\n":"NO-GO:\n"+result.blockers.join("\n")+"\n");
  if(!result.ready)process.exitCode=1;
 }
}
