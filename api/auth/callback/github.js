// api/auth/callback/github.js
const { verify, sign } = require("../../../lib/sign");

module.exports = async function handler(req, res) {
  try {
    if (!process.env.SESSION_SECRET) {
      res.status(500).json({ error: "config_error", message: "SESSION_SECRET manquant sur Vercel." });
      return;
    }
    if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
      res.status(500).json({ error: "config_error", message: "OAUTH_CLIENT_ID ou OAUTH_CLIENT_SECRET manquant sur Vercel." });
      return;
    }

    const { code, state } = req.query;

    const relay = verify(state);
    if (!relay) {
      res.status(400).json({ error: "invalid_state" });
      return;
    }

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

    const authCode = sign({
      github_login: user.login,
      redirect_uri: relay.redirect_uri,
      code_challenge: relay.code_challenge,
      code_challenge_method: relay.code_challenge_method,
      type: "auth_code",
      exp: Date.now() + 5 * 60 * 1000,
    });

    const redirectTo = new URL(relay.redirect_uri);
    redirectTo.searchParams.set("code", authCode);
    if (relay.state) redirectTo.searchParams.set("state", relay.state);

    res.writeHead(302, { Location: redirectTo.toString() });
    res.end();
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: err.message, stack: err.stack });
  }
};
