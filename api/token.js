// api/token.js  (monté sur /token via vercel.json)
// Échange le code d'autorisation (émis par notre callback GitHub) contre
// un access_token MCP, après vérification PKCE.

const crypto = require("crypto");
const { verify } = require("../lib/sign");
const { createAccessToken } = require("../lib/oauth");

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const raw = await readBody(req);
  const params = new URLSearchParams(raw);
  const grantType = params.get("grant_type");
  const code = params.get("code");
  const codeVerifier = params.get("code_verifier");

  if (grantType !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  const payload = verify(code);
  if (!payload || payload.type !== "auth_code") {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }

  if (payload.code_challenge) {
    const hash = crypto.createHash("sha256").update(codeVerifier || "").digest("base64url");
    if (hash !== payload.code_challenge) {
      res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      return;
    }
  }

  const accessToken = createAccessToken(payload.github_login);

  res.status(200).json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 8 * 60 * 60,
  });
};
