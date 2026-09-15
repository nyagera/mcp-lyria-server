// lib/oauth.js
// Vérification du Bearer token : accepte soit le MCP_STATIC_TOKEN (test perso),
// soit un token de session émis après un flow OAuth GitHub réussi.

const sessions = globalThis.__mcpSessions || (globalThis.__mcpSessions = new Map());

async function verifyBearerToken(req, bearerToken) {
  if (!bearerToken) return undefined;

  // Mode 1 : token statique (bypass rapide pour tests personnels).
  if (process.env.MCP_STATIC_TOKEN && bearerToken === process.env.MCP_STATIC_TOKEN) {
    return { token: bearerToken, scopes: ["lyria:generate"], clientId: "static-client" };
  }

  // Mode 2 : token de session émis par notre callback GitHub (voir api/auth/callback/github.js).
  const session = sessions.get(bearerToken);
  if (session && session.expiresAt > Date.now()) {
    return { token: bearerToken, scopes: ["lyria:generate"], clientId: session.githubLogin };
  }

  return undefined;
}

function createSession(githubLogin, ttlMs = 8 * 60 * 60 * 1000) {
  const token = require("crypto").randomBytes(32).toString("hex");
  sessions.set(token, { githubLogin, expiresAt: Date.now() + ttlMs });
  return token;
}

module.exports = { verifyBearerToken, createSession, sessions };
