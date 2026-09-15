// lib/oauth.js
// Vérification du Bearer token : accepte soit MCP_STATIC_TOKEN (test perso),
// soit un access_token MCP auto-signé (émis par /token après le flow GitHub).
// Stateless : aucune dépendance à une mémoire partagée entre instances.

const { sign, verify } = require("./sign");

async function verifyBearerToken(req, bearerToken) {
  if (!bearerToken) return undefined;

  if (process.env.MCP_STATIC_TOKEN && bearerToken === process.env.MCP_STATIC_TOKEN) {
    return { token: bearerToken, scopes: ["lyria:generate"], clientId: "static-client" };
  }

  const payload = verify(bearerToken);
  if (payload && payload.type === "access_token") {
    return { token: bearerToken, scopes: ["lyria:generate"], clientId: payload.github_login };
  }

  return undefined;
}

function createAccessToken(githubLogin, ttlMs = 8 * 60 * 60 * 1000) {
  return sign({ github_login: githubLogin, type: "access_token", exp: Date.now() + ttlMs });
}

module.exports = { verifyBearerToken, createAccessToken };
