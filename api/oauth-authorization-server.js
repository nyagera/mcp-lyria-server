// api/oauth-authorization-server.js
// Monté sur /.well-known/oauth-authorization-server via vercel.json.

module.exports = function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${req.headers.host}`;
  res.status(200).json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
};
