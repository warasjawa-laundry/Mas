import "server-only";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { decryptCardWithKeys } from "@/lib/laundry/card-crypto";
import { cardOriginForEnvironment } from "@/lib/laundry/card-origins";
import { assertQaPreviewIsolation } from "@/lib/supabase/qa-preview-isolation";

function getCardKey() {
  assertQaPreviewIsolation();
  const key = process.env.LAUNDRY_CARD_ENCRYPTION_KEY_OPERATIONAL || process.env.LAUNDRY_CARD_ENCRYPTION_KEY;
  if (!key) throw new Error("Card encryption is not configured");
  const material = Buffer.from(key, "base64");
  if (material.length !== 32 || material.toString("base64") !== key)
    throw new Error("Invalid card key material");
  return material;
}
export function cardIssuanceReady() {
  try { getCardKey(); return true; } catch { return false; }
}
export function newCardToken() { return randomBytes(32).toString("base64url"); }
export function validCardToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token) &&
    Buffer.from(token, "base64url").length === 32 &&
    Buffer.from(token, "base64url").toString("base64url") === token;
}
export function tokenDigest(token: string) {
  if (!validCardToken(token)) throw new Error("Bad card token");
  return createHash("sha256").update(token, "utf8").digest("hex");
}
export function encryptCardToken(token: string) {
  if (!validCardToken(token)) throw new Error("Bad card token");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getCardKey(), iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("hex");
}
export function decryptCardToken(hex: string) {
  const primary=getCardKey();
  const legacyValue=process.env.LAUNDRY_CARD_ENCRYPTION_KEY_OPERATIONAL
    ?process.env.LAUNDRY_CARD_ENCRYPTION_KEY:undefined;
  const legacy=legacyValue?Buffer.from(legacyValue,"base64"):undefined;
  if(legacy&&(legacy.length!==32||legacy.toString("base64")!==legacyValue))
    throw new Error("Invalid legacy card key material");
  return decryptCardWithKeys(hex,primary,legacy);
}
export function memberNumber(value: number | string) {
  return "MJL-" + String(value).padStart(6, "0");
}
export function publicCardOrigin() {
  // Preview cards always point to a stable, reviewed test alias. Never encode
  // the immutable VERCEL_URL deployment host in a physical card.
  return cardOriginForEnvironment(process.env.VERCEL_ENV, process.env.NODE_ENV, process.env.VERCEL_GIT_COMMIT_REF);
}
