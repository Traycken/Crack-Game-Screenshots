const STATIC_DEFAULTS = {
  galleryColumns: 3,
  noLimit: false,
};

const MIN_MAX_WIDTH = 800;
const MAX_MAX_WIDTH = 3840;
const FALLBACK_MAX_WIDTH = 1600; // si on ne peut pas interroger la page active

const RANGE_FIELDS = ["galleryColumns", "maxContentWidth"];

function labelFor(field, value) {
  if (field === "galleryColumns") return `${value}`;
  return `${value}px`;
}

function updateLabel(field, value) {
  const el = document.getElementById(`${field}Value`);
  if (el) el.textContent = labelFor(field, value);
}

function refreshMaxWidthState(noLimit) {
  document.getElementById("maxContentWidth").disabled = noLimit;
}

// La largeur max. par défaut n'est pas une valeur fixe : elle vaut 4/6 de
// la largeur réelle de la page active, comme dans content.js. On l'obtient
// en interrogeant l'onglet actif.
function getAutoMaxWidth(callback) {
  if (!chrome.tabs || !chrome.tabs.query) {
    callback(FALLBACK_MAX_WIDTH);
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return callback(FALLBACK_MAX_WIDTH);
    chrome.tabs.sendMessage(tab.id, { type: "lgsp-get-page-width" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.width) {
        callback(FALLBACK_MAX_WIDTH);
        return;
      }
      const auto = Math.round((response.width * 4) / 6);
      callback(Math.min(MAX_MAX_WIDTH, Math.max(MIN_MAX_WIDTH, auto)));
    });
  });
}

function loadSettings() {
  getAutoMaxWidth((autoMaxWidth) => {
    const defaults = { ...STATIC_DEFAULTS, maxContentWidth: autoMaxWidth };
    chrome.storage.local.get(defaults, (settings) => {
      RANGE_FIELDS.forEach((field) => {
        const input = document.getElementById(field);
        input.value = settings[field];
        updateLabel(field, settings[field]);
      });
      document.getElementById("noLimit").checked = settings.noLimit;
      refreshMaxWidthState(settings.noLimit);
    });
  });
}

function saveField(field, value) {
  chrome.storage.local.set({ [field]: value });
}

RANGE_FIELDS.forEach((field) => {
  const input = document.getElementById(field);
  input.addEventListener("input", () => {
    const value = Number(input.value);
    updateLabel(field, value);
    saveField(field, value);
  });
});

document.getElementById("noLimit").addEventListener("change", (e) => {
  const noLimit = e.target.checked;
  refreshMaxWidthState(noLimit);
  saveField("noLimit", noLimit);
});

// Réinitialiser : on efface les réglages enregistrés plutôt que d'écrire
// une valeur figée, pour que la largeur max. redevienne automatique
// (4/6 de la page) au lieu de retomber sur un chiffre fixe.
document.getElementById("resetBtn").addEventListener("click", () => {
  chrome.storage.local.remove(
    RANGE_FIELDS.concat(["noLimit"]),
    loadSettings
  );
});

loadSettings();