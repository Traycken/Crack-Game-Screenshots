// Réglages indépendants par site : chaque clé de stockage est préfixée par
// le nom d'hôte de l'onglet actif (voir keyFor). Le popup n'affiche/ne
// modifie donc que les réglages du site actuellement ouvert.
const SUPPORTED_HOSTS = [
  "www.skidrowreloaded.com",
  "igg-games.com",
  "pcgamestorrents.com",
];

const SITE_LABELS = {
  "www.skidrowreloaded.com": "SkidrowReloaded",
  "igg-games.com": "IGG-Games",
  "pcgamestorrents.com": "PCGamesTorrents",
};

// Libellés courts pour les 3 petits boutons "ouvrir dans un nouvel onglet"
// (le popup ne fait que 280px de large, pas la place pour le nom complet).
const SITE_SHORT_LABELS = {
  "www.skidrowreloaded.com": "Skidrow",
  "igg-games.com": "IGG",
  "pcgamestorrents.com": "PCGT",
};

function siteUrl(host) {
  return `https://${host}/`;
}

function renderSiteLinks(activeHost) {
  const container = document.getElementById("siteLinks");
  container.innerHTML = "";
  SUPPORTED_HOSTS.forEach((host) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "site-link";
    if (host === activeHost) btn.classList.add("active");
    btn.textContent = SITE_SHORT_LABELS[host] || host;
    btn.title = `Ouvrir ${SITE_LABELS[host] || host} dans un nouvel onglet`;
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: siteUrl(host) });
    });
    container.appendChild(btn);
  });
}

const DEFAULTS = {
  galleryColumns: 3,
  galleryRows: 2,
  maxTotalScreenshots: 30,
  maxContentWidth: 66.7, // pourcentage de la largeur de la fenêtre
};

const RANGE_FIELDS = ["galleryColumns", "galleryRows", "maxTotalScreenshots", "maxContentWidth"];

let currentHost = null;

function keyFor(field) {
  const storageField = field === "maxContentWidth" ? "maxContentWidthPct" : field;
  return `${currentHost}:${storageField}`;
}

function labelFor(field, value) {
  if (field === "galleryColumns" || field === "galleryRows" || field === "maxTotalScreenshots") return `${value}`;
  return `${Number(value).toFixed(1)}%`;
}

function updateLabel(field, value) {
  const el = document.getElementById(`${field}Value`);
  if (el) el.textContent = labelFor(field, value);
}

function loadSettings() {
  const defaults = {
    [keyFor("galleryColumns")]: DEFAULTS.galleryColumns,
    [keyFor("galleryRows")]: DEFAULTS.galleryRows,
    [keyFor("maxTotalScreenshots")]: DEFAULTS.maxTotalScreenshots,
    [keyFor("maxContentWidth")]: DEFAULTS.maxContentWidth,
  };
  chrome.storage.local.get(defaults, (settings) => {
    RANGE_FIELDS.forEach((field) => {
      const input = document.getElementById(field);
      const value = settings[keyFor(field)];
      input.value = value;
      updateLabel(field, value);
    });
  });
}

function saveField(field, value) {
  chrome.storage.local.set({ [keyFor(field)]: value });
}

function attachListeners() {
  RANGE_FIELDS.forEach((field) => {
    const input = document.getElementById(field);
    input.addEventListener("input", () => {
      const value = Number(input.value);
      updateLabel(field, value);
      saveField(field, value);
    });
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    chrome.storage.local.remove(
      RANGE_FIELDS.map((field) => keyFor(field)),
      loadSettings
    );
  });
}

function showUnsupported() {
  document.getElementById("unsupported").hidden = false;
  document.getElementById("fields").hidden = true;
  document.getElementById("siteLabel").textContent = "";
}

function showSite(host) {
  currentHost = host;
  document.getElementById("unsupported").hidden = true;
  document.getElementById("fields").hidden = false;
  document.getElementById("siteLabel").textContent = SITE_LABELS[host] || host;
  attachListeners();
  loadSettings();
}

function initSteamSync() {
  const input = document.getElementById("steamUserInput");
  const btn = document.getElementById("steamSyncBtn");
  const status = document.getElementById("steamStatus");

  if (!input || !btn || !status) return;

  const showStatus = (type, html) => {
    status.className = `steam-status ${type}`;
    status.innerHTML = html;
    status.hidden = false;
  };

  // Chargement des données déjà enregistrées
  chrome.storage.local.get(
    ["steamUserQuery", "steamUsername", "steamWishlist", "steamOwned", "steamLastSync"],
    (data) => {
      if (data.steamUserQuery) {
        input.value = data.steamUserQuery;
      }
      if (Array.isArray(data.steamWishlist) || Array.isArray(data.steamOwned)) {
        const wCount = data.steamWishlist?.length || 0;
        const oCount = data.steamOwned?.length || 0;
        const dateStr = data.steamLastSync
          ? new Date(data.steamLastSync).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })
          : "";
        showStatus(
          "success",
          `✅ <strong>${data.steamUsername || "Profil"}</strong> synchronisé :<br>` +
          `⭐ <strong>${wCount}</strong> dans la Wishlist<br>` +
          `🎮 <strong>${oCount}</strong> dans la Bibliothèque` +
          (dateStr ? `<br><small style="opacity:0.75">Dernière sync: ${dateStr}</small>` : "")
        );
      }
    }
  );

  const doSync = () => {
    const val = input.value.trim();
    if (!val) {
      showStatus("error", "Veuillez entrer votre pseudo Steam ou l'URL de votre profil.");
      return;
    }

    btn.disabled = true;
    showStatus("loading", "⏳ Synchronisation de la Wishlist et des jeux possédés...");

    chrome.runtime.sendMessage({ type: "SYNC_STEAM_DATA", input: val }, (res) => {
      btn.disabled = false;
      if (chrome.runtime.lastError) {
        showStatus("error", `Erreur : ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!res || !res.success) {
        showStatus("error", `❌ ${res?.error || "Échec de la synchronisation."}`);
        return;
      }

      const tipOwned = res.ownedCount === 0
        ? `<br><small style="display:block;margin-top:6px;opacity:0.85;color:#fcd34d">💡 Pour synchroniser votre bibliothèque : cliquez ci-dessous sur <strong>« Ouvrir ma page de jeux Steam »</strong>.</small>`
        : "";

      showStatus(
        "success",
        `✅ <strong>${res.username}</strong> synchronisé !<br>` +
        `⭐ <strong>${res.wishlistCount}</strong> dans la Wishlist<br>` +
        `🎮 <strong>${res.ownedCount}</strong> dans la Bibliothèque` +
        tipOwned
      );
    });
  };

  btn.addEventListener("click", doSync);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSync();
  });

  const openGamesBtn = document.getElementById("steamOpenGamesBtn");
  if (openGamesBtn) {
    openGamesBtn.addEventListener("click", () => {
      const val = input.value.trim();
      let targetUrl = "https://steamcommunity.com/my/games/?tab=all";
      if (val) {
        if (val.startsWith("http")) {
          targetUrl = val.includes("/games") ? val : `${val.replace(/\/+$/, "")}/games/?tab=all`;
        } else if (/^\d{17}$/.test(val)) {
          targetUrl = `https://steamcommunity.com/profiles/${val}/games/?tab=all`;
        } else {
          targetUrl = `https://steamcommunity.com/id/${val}/games/?tab=all`;
        }
      }
      // Autoriser la synchronisation pour cette ouverture explicite
      chrome.storage.local.set({ steamSyncAuthorizedAt: Date.now() }, () => {
        const separator = targetUrl.includes("#") ? "&" : "#";
        chrome.tabs.create({ url: `${targetUrl}${separator}lgsp_sync=1` });
      });
    });
  }
}

function init() {
  // Les 3 boutons doivent être utilisables immédiatement, indépendamment du
  // site actuellement ouvert (voire même si l'onglet actif n'est pas l'un
  // des 3 sites gérés) ; pas besoin d'attendre la résolution de l'onglet.
  renderSiteLinks(null);
  initSteamSync();

  if (!chrome.tabs || !chrome.tabs.query) {
    showUnsupported();
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    let host = null;
    try {
      host = tab && tab.url ? new URL(tab.url).hostname : null;
    } catch (err) {
      host = null;
    }
    const supportedHost = host && SUPPORTED_HOSTS.includes(host) ? host : null;
    renderSiteLinks(supportedHost);
    if (supportedHost) {
      showSite(supportedHost);
    } else {
      showUnsupported();
    }
  });
}

init();
