// api/oauth-protected-resource.js
// Monté sur /.well-known/oauth-protected-resource via vercel.json.

module.exports = function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${req.headers.host}`;
  res.status(200).json({
    resource: `${base}/api`,
    authorization_servers: [base],
  });
};
