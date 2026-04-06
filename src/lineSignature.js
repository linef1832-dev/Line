import crypto from "node:crypto";

export function verifyLineSignature(rawBodyBuffer, channelSecret, signatureHeader) {
  if (!signatureHeader || !channelSecret) return false;
  const mac = crypto.createHmac("sha256", channelSecret).update(rawBodyBuffer).digest("base64");
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
