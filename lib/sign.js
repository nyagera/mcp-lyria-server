// lib/sign.js
// Jetons opaques auto-signés (HMAC) pour rester 100% stateless sur Vercel
// (évite le problème de mémoire non partagée entre instances serverless).

const crypto = require("crypto");

function sign(payload) {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [b64, sig] = token.split(".");
  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(b64)
    .digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

module.exports = { sign, verify };
