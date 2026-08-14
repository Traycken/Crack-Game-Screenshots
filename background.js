// Service worker (MV3) : contourne CORS pour appeler l'API Steam storefront
// et parser le champ `supported_languages`.
//
// Le content script ne peut pas fetch `store.steampowered.com` directement
// (pas d'en-têtes CORS). Le service worker, lui, n'est pas soumis à CORS.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "STEAM_LANG_CHECK") return false;

  const appId = msg.appId;
  if (!appId) {
    sendResponse({ error: "missing appId" });
    return false;
  }

  fetchSteamLanguages(appId)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ error: err.message }));

  // Renvoie true pour indiquer qu'on répondra de façon asynchrone.
  return true;
});

async function fetchSteamLanguages(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API HTTP ${res.status}`);

  const json = await res.json();
  const entry = json[appId];
  if (!entry || !entry.success || !entry.data) {
    return { frenchStatus: "unknown" };
  }

  const langHtml = entry.data.supported_languages || "";
  const frenchStatus = parseFrenchStatus(langHtml);

  return { frenchStatus };
}

// Parse le champ `supported_languages` (chaîne HTML) pour déterminer si le
// français est supporté et si l'audio complète est incluse.
//
// Format observé :
//   "English<strong>*</strong>, French<strong>*</strong>, Italian, ..."
//   suivi de "<br><strong>*</strong>languages with full audio support"
//
// - Langue suivie de <strong>*</strong> → texte + voix ("full")
// - Langue présente sans astérisque   → texte uniquement ("subtitles")
// - Langue absente                    → "none"
function parseFrenchStatus(html) {
  if (!html) return "none";

  // Retire la légende finale pour ne garder que la liste de langues.
  const legend = html.indexOf("<br>");
  const langList = legend !== -1 ? html.substring(0, legend) : html;

  // Sépare chaque entrée par la virgule.
  const entries = langList.split(",").map((s) => s.trim());

  for (const entry of entries) {
    // Retire toutes les balises HTML pour obtenir le nom brut + éventuel "*".
    const clean = entry.replace(/<[^>]+>/g, "").trim();

    // Vérifie si c'est "French" (peut être "French*" si audio complète).
    if (/^French\b/i.test(clean)) {
      return clean.includes("*") ? "full" : "subtitles";
    }
  }

  return "none";
}
