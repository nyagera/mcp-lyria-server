// api/index.js
// Serveur MCP (Streamable HTTP) exposant Lyria 3 et Lyria 3 Pro via Replicate.
// Basé sur le pattern mcp-handler + withMcpAuth (Vercel).

const { createMcpHandler, withMcpAuth } = require("mcp-handler");
const { z } = require("zod");
const { runReplicateModel } = require("../lib/replicate");
const { verifyBearerToken } = require("../lib/oauth");

const handler = createMcpHandler(
  (server) => {
    // --- Tool 1 : Lyria 3 (clip 30s) ---
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

    // --- Tool 2 : Lyria 3 Pro (morceau complet jusqu'à 3 min) ---
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
  { basePath: "/api" }
);

// Protection OAuth : valide le Bearer token avant d'exécuter tout outil.
const authHandler = withMcpAuth(handler, verifyBearerToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

module.exports = authHandler;
module.exports.config = { api: { bodyParser: false } };
