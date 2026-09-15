// api/index.js
// Serveur MCP (Streamable HTTP) exposant Lyria 3 et Lyria 3 Pro via Replicate.
// mcp-handler attend des objets Request/Response Fetch API (Web standard),
// mais Vercel invoque cette fonction Node.js avec la signature classique
// (req, res). On convertit donc manuellement dans les deux sens.

const { createMcpHandler, withMcpAuth } = require("mcp-handler");
const { z } = require("zod");
const { runReplicateModel } = require("../lib/replicate");
const { verifyBearerToken } = require("../lib/oauth");

const mcpHandler = createMcpHandler(
  (server) => {
    server.tool(
      "generate_music_clip",
      "Génère un clip musical de 30 secondes avec Google Lyria 3 (rapide, idéal pour itérer avant Lyria 3 Pro).",
      {
        prompt: z.string().describe("Description du morceau : genre, instruments, tempo (BPM), tonalité, ambiance."),
        images: z.array(z.string().url()).max(10).optional()
          .describe("Jusqu'à 10 URLs d'images servant d'inspiration visuelle."),
        instrumental: z.boolean().optional()
          .describe("Si true, force un morceau instrumental sans voix."),
      },
      async ({ prompt, images, instrumental }) => {
        const finalPrompt = instrumental
          ? `${prompt}. Instrumental only, no vocals.`
          : prompt;

        const output = await runReplicateModel("google/lyria-3", {
          prompt: finalPrompt,
          ...(images ? { images } : {}),
        });

        return {
          content: [
            { type: "text", text: `Clip généré (30s) : ${output.url}` },
            { type: "resource", resource: { uri: output.url, mimeType: "audio/mpeg" } },
          ],
        };
      }
    );

    server.tool(
      "generate_song",
      "Génère un morceau complet (jusqu'à ~3 minutes) avec Google Lyria 3 Pro : structure couplets/refrains/ponts, paroles personnalisées, timestamps.",
      {
        prompt: z.string().describe("Direction musicale : instruments, tempo, tonalité, ambiance, style, longueur souhaitée."),
        lyrics: z.string().optional()
          .describe("Paroles avec tags de section, ex: [Verse]...[Chorus]...[Bridge]..."),
        timestamps: z.string().optional()
          .describe("Timestamps de structure, ex: [0:00-0:30] Intro: piano doux."),
        images: z.array(z.string().url()).max(10).optional(),
        target_duration_seconds: z.number().min(30).max(180).optional()
          .describe("Durée cible approximative en secondes (influence le prompt, pas garanti)."),
      },
      async ({ prompt, lyrics, timestamps, images, target_duration_seconds }) => {
        let finalPrompt = prompt;
        if (target_duration_seconds) {
          finalPrompt += `. Create approximately a ${Math.round(target_duration_seconds / 60 * 10) / 10}-minute song.`;
        }
        if (timestamps) finalPrompt += `\n${timestamps}`;
        if (lyrics) finalPrompt += `\nLyrics:\n${lyrics}`;

        const output = await runReplicateModel("google/lyria-3-pro", {
          prompt: finalPrompt,
          ...(images ? { images } : {}),
        });

        return {
          content: [
            { type: "text", text: `Morceau généré : ${output.url}` },
            { type: "resource", resource: { uri: output.url, mimeType: "audio/mpeg" } },
          ],
        };
      }
    );
  },
  {},
  { streamableHttpEndpoint: "/mcp" }
);

const authHandler = withMcpAuth(mcpHandler, verifyBearerToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

async function nodeRequestToFetchRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${req.headers.host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) body = Buffer.concat(chunks);
  }

  return new Request(url, { method: req.method, headers, body, duplex: "half" });
}

async function sendFetchResponse(fetchRes, res) {
  res.statusCode = fetchRes.status;
  fetchRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await fetchRes.arrayBuffer());
  res.end(buf);
}

module.exports = async function handler(req, res) {
  try {
    const fetchReq = await nodeRequestToFetchRequest(req);
    const fetchRes = await authHandler(fetchReq);
    await sendFetchResponse(fetchRes, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "internal_error", message: err.message, stack: err.stack }));
  }
};

module.exports.config = { api: { bodyParser: false } };
