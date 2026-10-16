import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const root=process.cwd();
const config=JSON.parse(readFileSync(join(root,"vercel.json"),"utf8"));

test("Vercel automatic Git deployments remain disabled on all branches",()=>{
  assert.equal(config.framework,"nextjs");
  assert.equal(config.git?.deploymentEnabled,false,
    "Automatic Vercel deployment must stay disabled until explicit owner approval.");
});

test("GitHub CI remains independent of automatic Vercel deployment",()=>{
  const workflow=readFileSync(join(root,".github/workflows/stage7-whatsapp-ci.yml"),"utf8");
  assert.match(workflow,/branches:\s*\[integration\/mas-jawa-laundry\]/);
  for(const command of ["npm run test","npm run typecheck","npm run build","npx playwright test"]){
    assert.ok(workflow.includes(command),"Missing CI gate: "+command);
  }
  assert.doesNotMatch(workflow,/\bvercel\s+(?:deploy|--prod)\b|\bvercel\/action\b|\bdeployments\/create\b/,
    "Do not add an automated Vercel deployment to GitHub Actions.");
});
