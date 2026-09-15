// api/auth/callback/github.js
// Reçoit le `code` de GitHub, l'échange contre un access_token GitHub,
// vérifie l'identité, puis émet un token de session MCP interne.

const { createSession } = require("../../../lib/oauth");

module.exports = async function handler(req, res) {
  const { code } = req.query;
  if (!code) {
    res.status(400).json({ error: "missing_code" });
    return;
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.OAUTH_CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      res.status(400).json({ error: "token_exchange_failed", details: tokenData });
      return;
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    const mcpSessionToken = createSession(user.login);

    res.status(200).json({
      message: "Authentification GitHub réussie.",
      github_user: user.login,
      mcp_bearer_token: mcpSessionToken,
      expires_in_hours: 8,
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: err.message });
  }
};
