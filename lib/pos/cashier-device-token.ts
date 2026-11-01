import { createHash, randomBytes } from "node:crypto";

/** A device credential is 256 random bits, never a worker password or ID. */
export function newCashierDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function validCashierDeviceToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value) &&
    Buffer.from(value, "base64url").length === 32 &&
    Buffer.from(value, "base64url").toString("base64url") === value;
}

export function cashierTokenSha256(token: string): string {
  if (!validCashierDeviceToken(token)) throw new Error("INVALID_DEVICE_TOKEN");
  return createHash("sha256").update(token, "utf8").digest("hex");
}