// lib/oauth.js
// Vérification du Bearer token pour protéger le serveur MCP.
// Compatible avec le pattern withMcpAuth de mcp-handler.
//
// Deux modes supportés :
// 1. MCP_STATIC_TOKEN (simple, pour usage perso / connecteur unique)
// 2. Introspection auprès d'un Authorization Server externe (OAuth complet,
//    ex: Auth0, Clerk, ou GitHub OAuth App) via OAUTH_INTROSPECTION_URL.

async function verifyBearerToken(req, bearerToken) {
  if (!bearerToken) return undefined;

  // Mode simple : token statique défini en variable d'environnement.
  if (process.env.MCP_STATIC_TOKEN) {
    if (bearerToken === process.env.MCP_STATIC_TOKEN) {
      return {
        token: bearerToken,
        scopes: ["lyria:generate"],
        clientId: "static-client",
      };
    }
    return undefined;
  }

  // Mode OAuth complet : introspection auprès d'un serveur d'autorisation externe.
  if (process.env.OAUTH_INTROSPECTION_URL) {
    const res = await fetch(process.env.OAUTH_INTROSPECTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.OAUTH_CLIENT_ID}:${process.env.OAUTH_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({ token: bearerToken }),
    });

    if (!res.ok) return undefined;
    const data = await res.json();
    if (!data.active) return undefined;

    return {
      token: bearerToken,
      scopes: data.scope ? data.scope.split(" ") : [],
      clientId: data.client_id,
    };
  }

  return undefined;
}

module.exports = { verifyBearerToken };
