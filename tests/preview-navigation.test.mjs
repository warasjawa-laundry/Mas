import {test} from "node:test";
import assert from "node:assert/strict";
import {siteHref} from "../lib/navigation.ts";

const vars=["VERCEL_ENV","VERCEL_GIT_COMMIT_REF","REVIEW_NAV_ORIGIN"];
const stable="https://mas-git-main-m8traders-projects-081d9dc2.vercel.app";
function withEnvironment(patch, callback){
  const saved=Object.fromEntries(vars.map(key=>[key,process.env[key]]));
  try{
    for(const key of vars){
      if(patch[key] === undefined)delete process.env[key];
      else process.env[key]=patch[key];
    }
    callback();
  }finally{
    for(const key of vars){
      if(saved[key] === undefined)delete process.env[key];
      else process.env[key]=saved[key];
    }
  }
}

test("only main review deploy redirects public navigation to the stable alias",()=>{
  withEnvironment({VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"main",REVIEW_NAV_ORIGIN:stable},()=>{
    assert.equal(siteHref("/admin/login"),stable+"/admin/login");
    assert.equal(siteHref("/membership"),stable+"/membership");
  });
});

test("feature preview, production, and Netlify remain on their own host",()=>{
  for(const cfg of [
    {VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feature/admin-operations-reliability-20261017"},
    {VERCEL_ENV:"production",VERCEL_GIT_COMMIT_REF:"main"},
    {VERCEL_GIT_COMMIT_REF:"main"},
  ]){
    withEnvironment({...cfg,REVIEW_NAV_ORIGIN:stable},()=>{
      assert.equal(siteHref("/admin/login"),"/admin/login");
    });
  }
});

test("untrusted configured review origins cannot change public links",()=>{
  for(const injected of [
    "http://mas-git-main-m8traders-projects-081d9dc2.vercel.app",
    "https://example.org",
    "https://mas-git-main-m8traders-projects-081d9dc2.vercel.app.evil.example",
    "https://mas-git-main-m8traders-projects-081d9dc2.vercel.app/path",
  ])withEnvironment({VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"main",REVIEW_NAV_ORIGIN:injected},()=>{
    assert.equal(siteHref("/admin/login"),"/admin/login");
  });
});
