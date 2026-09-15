// api/authorize.js  (monté sur /authorize via vercel.json)
// Point d'entrée OAuth vu par le client MCP (ex: Perplexity). Redélègue
// la vraie authentification à GitHub, en conservant les paramètres du
// client (redirect_uri, PKCE, state) dans un state signé.

const { sign } = require("../lib/sign");

module.exports = async function handler(req, res) {
  const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.query;

  if (!redirect_uri) {
    res.status(400).json({ error: "invalid_request", error_description: "redirect_uri manquant" });
    return;
  }

  const relayState = sign({
    client_id: client_id || null,
    redirect_uri,
    state: state || null,
    code_challenge: code_challenge || null,
    code_challenge_method: code_challenge_method || null,
    exp: Date.now() + 10 * 60 * 1000,
  });

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  const githubCallback = `${proto}://${host}/api/auth/callback/github`;

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", process.env.OAUTH_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", githubCallback);
  githubUrl.searchParams.set("scope", "read:user");
  githubUrl.searchParams.set("state", relayState);

  res.writeHead(302, { Location: githubUrl.toString() });
  res.end();
};
