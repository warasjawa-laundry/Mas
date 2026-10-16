import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getCardKey() {
  const key = process.env.LAUNDRY_CARD_ENCRYPTION_KEY;
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
  if (!/^[a-f0-9]+$/.test(hex) || hex.length < 56 || hex.length > 4096)
    throw new Error("Invalid ciphertext");
  const bytes = Buffer.from(hex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", getCardKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(bytes.length - 16));
  const token = Buffer.concat([
    decipher.update(bytes.subarray(12, bytes.length - 16)), decipher.final()
  ]).toString("utf8");
  if (!validCardToken(token)) throw new Error("Invalid decrypted token");
  return token;
}
export function memberNumber(value: number | string) {
  return "MJL-" + String(value).padStart(6, "0");
}
export function publicCardOrigin() {
  // Preview cards are TEST CARDS: never print for real customers before production release.
  const vercelHost = process.env.VERCEL_URL;
  return vercelHost ? "https://" + vercelHost : "http://localhost:3000";
}
