// Service worker (MV3) : contourne CORS pour appeler l'API Steam storefront
// et récupérer les détails complets du jeu (Langues, Notes, Prix, Modes, Screenshots, Trailers).

const steamGameCache = new Map();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "STEAM_GAME_INFO" || msg.type === "STEAM_LANG_CHECK") {
    const appId = msg.appId;
    if (!appId) {
      sendResponse({ error: "missing appId" });
      return false;
    }

    if (steamGameCache.has(appId)) {
      sendResponse(steamGameCache.get(appId));
      return false;
    }

    fetchSteamFullInfo(appId)
      .then((result) => {
        steamGameCache.set(appId, result);
        sendResponse(result);
      })
      .catch((err) => {
        console.warn("[Background] Steam API Error:", err);
        sendResponse({ error: err.message, french: { interface: false, audio: false, subtitles: false, status: "unknown" } });
      });

    return true; // Réponse asynchrone
  }
});

async function fetchSteamFullInfo(appId) {
  const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=fr&l=french`;
  const reviewsUrl = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&l=french`;

  const [detailsRes, reviewsRes] = await Promise.all([
    fetch(detailsUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(reviewsUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const entry = detailsRes ? detailsRes[appId] : null;
  if (!entry || !entry.success || !entry.data) {
    return {
      appId,
      success: false,
      french: { interface: false, audio: false, subtitles: false, status: "unknown" },
      frenchStatus: "unknown",
      reviews: null,
      price: null,
      modes: [],
      screenshots: [],
      movies: [],
    };
  }

  const data = entry.data;
  const revSummary = reviewsRes?.query_summary || {};

  // 1. Langues (Interface, Audio, Sous-titres)
  const langHtml = data.supported_languages || "";
  const french = parseFrenchDetails(langHtml);

  // 2. Évaluations des joueurs
  let reviews = null;
  if (revSummary.total_reviews > 0) {
    const pct = Math.round((revSummary.total_positive / revSummary.total_reviews) * 100);
    let scoreClass = "positive";
    if (pct < 40 || (revSummary.review_score && revSummary.review_score <= 4)) {
      scoreClass = "negative";
    } else if (pct < 70 || (revSummary.review_score && revSummary.review_score <= 6)) {
      scoreClass = "mixed";
    }

    reviews = {
      desc: capitalize(revSummary.review_score_desc || "Avis"),
      percent: pct,
      total: revSummary.total_reviews,
      totalPositive: revSummary.total_positive,
      scoreClass,
    };
  }

  // 3. Prix
  let price = null;
  if (data.is_free) {
    price = { isFree: true, formatted: "Gratuit", discountPercent: 0 };
  } else if (data.price_overview) {
    price = {
      isFree: false,
      formatted: data.price_overview.final_formatted || "",
      initialFormatted: data.price_overview.initial_formatted || "",
      discountPercent: data.price_overview.discount_percent || 0,
    };
  }

  // 4. Modes de jeu (Solo, Multijoueur, Coop, MMO)
  const { modes, modeDetails } = extractGameModes(data);

  // 5. Screenshots Steam HD
  const screenshots = (data.screenshots || []).map((s) => ({
    thumbnail: s.path_thumbnail,
    full: s.path_full,
  }));

  // 6. Vidéos / Trailers Steam
  const movies = (data.movies || []).map((m) => {
    const mp4Url = m.mp4?.max || m.mp4?.["480"] || `https://cdn.cloudflare.steamstatic.com/steam/apps/${m.id}/movie_max.mp4`;
    const webmUrl = m.webm?.max || m.webm?.["480"] || `https://cdn.cloudflare.steamstatic.com/steam/apps/${m.id}/movie_max_vp9.webm`;
    const embedUrl = `https://store.steampowered.com/video_player/browse/${appId}/${m.id}`;
    return {
      id: m.id,
      name: m.name,
      thumbnail: m.thumbnail,
      embedUrl,
      mp4: mp4Url,
      webm: webmUrl,
      dash: m.dash_h264 || null,
      hls: m.hls_h264 || null,
    };
  });

  return {
    appId,
    success: true,
    name: data.name,
    shortDescription: data.short_description || "",
    description: data.short_description || "",
    french,
    frenchStatus: french.status, // rétro-compatibilité
    reviews,
    price,
    modes,
    modeDetails,
    screenshots,
    movies,
  };
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Analyse le champ `supported_languages` pour déterminer le support du français
// pour l'Interface, l'Audio et les Sous-titres.
function parseFrenchDetails(html) {
  if (!html) {
    return { interface: false, audio: false, subtitles: false, status: "none" };
  }

  const legend = html.indexOf("<br>");
  const langList = legend !== -1 ? html.substring(0, legend) : html;
  const entries = langList.split(",").map((s) => s.trim());

  for (const entry of entries) {
    const clean = entry.replace(/<[^>]+>/g, "").trim();
    if (/^French\b|^Français\b/i.test(clean)) {
      const hasFullAudio = clean.includes("*");
      return {
        interface: true,
        audio: hasFullAudio,
        subtitles: true,
        status: hasFullAudio ? "full" : "subtitles",
      };
    }
  }

  return { interface: false, audio: false, subtitles: false, status: "none" };
}

// Extrait les modes de jeu à partir des catégories et genres Steam
function extractGameModes(data) {
  const modes = [];
  const details = [];

  const categories = data.categories || [];
  const catIds = new Set(categories.map((c) => c.id));
  const catDescs = categories.map((c) => (c.description || "").toLowerCase());
  const genres = (data.genres || []).map((g) => (g.description || "").toLowerCase());

  // Solo
  if (catIds.has(2) || catDescs.some((d) => d.includes("solo") || d.includes("single-player"))) {
    modes.push("Solo");
  }

  // Multijoueur (IDs 1, 49, 36, 37, 47, 27)
  const isMulti =
    catIds.has(1) ||
    catIds.has(49) ||
    catIds.has(36) ||
    catIds.has(37) ||
    catIds.has(47) ||
    catIds.has(27) ||
    catDescs.some((d) => d.includes("multijoueur") || d.includes("multi-player") || d.includes("pvp") || d.includes("jcj"));

  if (isMulti) {
    modes.push("Multijoueur");
  }

  // Coop (IDs 9, 38, 39, 48, 24)
  const isCoop =
    catIds.has(9) ||
    catIds.has(38) ||
    catIds.has(39) ||
    catIds.has(48) ||
    catIds.has(24) ||
    catDescs.some((d) => d.includes("coop") || d.includes("coopération") || d.includes("co-op") || d.includes("écran partagé"));

  if (isCoop) {
    modes.push("Coop");
  }

  // MMO (ID 20 ou genre MMO/Massively Multiplayer)
  const isMmo =
    catIds.has(20) ||
    catDescs.some((d) => d.includes("mmo")) ||
    genres.some((g) => g.includes("mmo") || g.includes("massively multiplayer"));

  if (isMmo) {
    modes.push("MMO");
  }

  // Détails pour infobulle
  categories.forEach((c) => {
    if ([1, 2, 9, 20, 24, 27, 36, 37, 38, 39, 47, 48, 49].includes(c.id)) {
      details.push(c.description);
    }
  });

  return { modes, modeDetails: details.join(", ") };
}
