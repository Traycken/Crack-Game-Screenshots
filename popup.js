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
  maxContentWidth: 66.7, // pourcentage de la largeur de la fenêtre
};

const RANGE_FIELDS = ["galleryColumns", "maxContentWidth"];

let currentHost = null;

function keyFor(field) {
  const storageField = field === "maxContentWidth" ? "maxContentWidthPct" : field;
  return `${currentHost}:${storageField}`;
}

function labelFor(field, value) {
  if (field === "galleryColumns") return `${value}`;
  return `${Number(value).toFixed(1)}%`;
}

function updateLabel(field, value) {
  const el = document.getElementById(`${field}Value`);
  if (el) el.textContent = labelFor(field, value);
}

function loadSettings() {
  const defaults = {
    [keyFor("galleryColumns")]: DEFAULTS.galleryColumns,
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

function init() {
  // Les 3 boutons doivent être utilisables immédiatement, indépendamment du
  // site actuellement ouvert (voire même si l'onglet actif n'est pas l'un
  // des 3 sites gérés) ; pas besoin d'attendre la résolution de l'onglet.
  renderSiteLinks(null);

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
