// lib/replicate.js
// Appel générique à un modèle Replicate avec polling jusqu'à complétion.
// IMPORTANT : toujours épingler une version précise du modèle (leçon tirée
// du bug -32603 sur flux-dev-realism : ne jamais laisser Replicate résoudre
// dynamiquement la "latest version").

const REPLICATE_API = "https://api.replicate.com/v1";

// À mettre à jour avec les vrais hash de version au moment du déploiement
// (récupérables via `replicate.com/google/lyria-3/versions` ou l'API models.get).
const MODEL_VERSIONS = {
  "google/lyria-3": process.env.LYRIA3_VERSION_ID,
  "google/lyria-3-pro": process.env.LYRIA3_PRO_VERSION_ID,
};

async function runReplicateModel(modelSlug, input) {
  const versionId = MODEL_VERSIONS[modelSlug];
  if (!versionId) {
    throw new Error(
      `Aucune version épinglée pour ${modelSlug}. Définis la variable d'environnement correspondante.`
    );
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN manquant.");

  const createRes = await fetch(`${REPLICATE_API}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait", // tente d'attendre la fin synchrone si possible
    },
    body: JSON.stringify({ version: versionId, input }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Erreur Replicate (${createRes.status}) : ${errBody}`);
  }

  let prediction = await createRes.json();

  // Polling si la prédiction n'est pas terminée immédiatement
  while (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== "succeeded") {
    throw new Error(
      `Génération échouée (${prediction.status}) : ${prediction.error || "raison inconnue, possiblement filtre de sécurité"}`
    );
  }

  const outputUrl = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;

  return { url: outputUrl, raw: prediction };
}

module.exports = { runReplicateModel };
