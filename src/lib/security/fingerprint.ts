import { createHmac } from "node:crypto";

import "server-only";

export function hmacFingerprint(value: string, piiHashSecret: string): string {
  return createHmac("sha256", piiHashSecret).update(value, "utf8").digest("hex");
}

export function fingerprintPhone(phone: string, piiHashSecret: string): string {
  return hmacFingerprint(phone.replace(/\D/g, ""), piiHashSecret);
}

export function fingerprintIp(ip: string, piiHashSecret: string): string {
  return hmacFingerprint(ip, piiHashSecret);
}
