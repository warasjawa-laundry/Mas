import test from "node:test";
import assert from "node:assert/strict";
import {createCipheriv} from "node:crypto";
import {decryptCardWithKeys} from "../lib/laundry/card-crypto.ts";

const primary=Buffer.alloc(32,1),legacy=Buffer.alloc(32,2);
const token=Buffer.alloc(32,3).toString("base64url");
function encrypted(key){
 const iv=Buffer.alloc(12,4),cipher=createCipheriv("aes-256-gcm",key,iv);
 const body=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
 return Buffer.concat([iv,body,cipher.getAuthTag()]).toString("hex");
}
test("cards from both databases keep their original token after consolidation",()=>{
 assert.equal(decryptCardWithKeys(encrypted(primary),primary,legacy),token);
 assert.equal(decryptCardWithKeys(encrypted(legacy),primary,legacy),token);
 assert.equal(decryptCardWithKeys(encrypted(primary),primary),token);
});
test("unknown keys and tampered or malformed card material remain rejected",()=>{
 for(const material of [encrypted(Buffer.alloc(32,9)),encrypted(legacy).slice(0,-2)+"00","zz","a".repeat(143)]){
  assert.throws(()=>decryptCardWithKeys(material,primary,legacy));
 }
 assert.throws(()=>decryptCardWithKeys(encrypted(legacy),primary));
});
