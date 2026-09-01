// Réglages indépendants par site : chaque clé de stockage est préfixée par
// le nom d'hôte de l'onglet actif (voir keyFor). Le popup n'affiche/ne
// modifie donc que les réglages du site actuellement ouvert.
const CANONICAL_HOSTS = {
  "skidrowreloaded.com": "www.skidrowreloaded.com",
  "www.skidrowreloaded.com": "www.skidrowreloaded.com",
  "igg-games.com": "igg-games.com",
  "www.igg-games.com": "igg-games.com",
  "pcgamestorrents.com": "pcgamestorrents.com",
  "www.pcgamestorrents.com": "pcgamestorrents.com",
};

const SUPPORTED_HOSTS = [
  "www.skidrowreloaded.com",
  "igg-games.com",
  "pcgamestorrents.com",
];

function normalizeHost(host) {
  if (!host) return null;
  const clean = host.toLowerCase().trim();
  return CANONICAL_HOSTS[clean] || null;
}

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
  textScale: 100, // pourcentage d'échelle de taille de texte
};

const RANGE_FIELDS = ["galleryColumns", "galleryRows", "maxTotalScreenshots", "maxContentWidth", "textScale"];

let currentHost = null;

function keyFor(field) {
  const host = normalizeHost(currentHost) || currentHost;
  const storageField = field === "maxContentWidth" ? "maxContentWidthPct" : field;
  return `${host}:${storageField}`;
}

function labelFor(field, value) {
  if (field === "galleryColumns" || field === "galleryRows" || field === "maxTotalScreenshots") return `${value}`;
  if (field === "textScale") return `${Math.round(value)}%`;
  return `${Number(value).toFixed(1)}%`;
}

function updateLabel(field, value) {
  const el = document.getElementById(`${field}Value`);
  if (el) el.textContent = labelFor(field, value);
}

const BG_DEFAULTS = {
  overlayOpacity: 40,
  blur: 0,
  glassmorphism: 70,
};

function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;
  const str = urlOrId.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsText(file);
  });
}

function renderCustomBgUi(bg) {
  const badge = document.getElementById("bgStatusBadge");
  const activeCard = document.getElementById("bgActiveCard");
  const thumb = document.getElementById("bgPreviewThumb");
  const typeEl = document.getElementById("bgPreviewType");
  const nameEl = document.getElementById("bgPreviewName");
  const glassInput = document.getElementById("bgGlassmorphism");
  const glassVal = document.getElementById("bgGlassmorphismValue");
  const opacityInput = document.getElementById("bgOverlayOpacity");
  const opacityVal = document.getElementById("bgOverlayOpacityValue");
  const blurInput = document.getElementById("bgBlur");
  const blurVal = document.getElementById("bgBlurValue");

  const glassmorphism = bg && typeof bg.glassmorphism === "number" ? bg.glassmorphism : BG_DEFAULTS.glassmorphism;
  const overlayOpacity = bg && typeof bg.overlayOpacity === "number" ? bg.overlayOpacity : BG_DEFAULTS.overlayOpacity;
  const blur = bg && typeof bg.blur === "number" ? bg.blur : BG_DEFAULTS.blur;

  if (glassInput) glassInput.value = glassmorphism;
  if (glassVal) glassVal.textContent = `${glassmorphism}%`;
  if (opacityInput) opacityInput.value = overlayOpacity;
  if (opacityVal) opacityVal.textContent = `${overlayOpacity}%`;
  if (blurInput) blurInput.value = blur;
  if (blurVal) blurVal.textContent = `${blur}px`;

  if (!bg || !bg.type) {
    if (badge) {
      badge.textContent = "Par défaut";
      badge.classList.remove("active");
    }
    if (activeCard) activeCard.hidden = true;
    return;
  }

  if (badge) {
    badge.textContent = "Actif";
    badge.classList.add("active");
  }
  if (activeCard) activeCard.hidden = false;

  if (typeEl) {
    const typeNames = {
      image: "Image",
      url: "URL",
      youtube: "YouTube",
      video: "Vidéo",
      html: "HTML",
      color: "Couleur",
    };
    typeEl.textContent = typeNames[bg.type] || bg.type;
  }

  if (nameEl) {
    nameEl.textContent = bg.rawName || "Fond personnalisé";
  }

  if (thumb) {
    thumb.textContent = "";
    thumb.style.backgroundColor = "transparent";
    if (bg.type === "image" || bg.type === "url") {
      thumb.style.backgroundImage = `url("${bg.url}")`;
    } else if (bg.type === "youtube" && bg.videoId) {
      thumb.style.backgroundImage = `url("https://img.youtube.com/vi/${bg.videoId}/mqdefault.jpg")`;
    } else if (bg.type === "video") {
      thumb.style.backgroundImage = "none";
      thumb.textContent = "🎬";
    } else if (bg.type === "html") {
      thumb.style.backgroundImage = "none";
      thumb.textContent = "💻";
    } else if (bg.type === "color") {
      thumb.style.backgroundImage = "none";
      thumb.style.backgroundColor = bg.color || "#121316";
    } else {
      thumb.style.backgroundImage = "none";
      thumb.textContent = "🎨";
    }
  }

  if (bg && bg.type === "color" && bg.color) {
    const picker = document.getElementById("bgColorPicker");
    const textIn = document.getElementById("bgColorTextInput");
    if (textIn) textIn.value = bg.color;
    if (picker && /^#[0-9A-Fa-f]{6}$/.test(bg.color)) picker.value = bg.color;
  }
}

function showBgStatusMsg(msg, isError = false) {
  const el = document.getElementById("bgStatusMsg");
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? "bg-status-msg error" : "bg-status-msg";
  el.hidden = false;
  setTimeout(() => {
    if (el.textContent === msg) el.hidden = true;
  }, 3500);
}

function saveCustomBg(bgData) {
  if (!currentHost) return;
  chrome.storage.local.get([keyFor("customBg")], (res) => {
    const current = res[keyFor("customBg")] || {};
    const updated = {
      ...current,
      ...bgData,
      glassmorphism: typeof bgData.glassmorphism === "number" ? bgData.glassmorphism : (typeof current.glassmorphism === "number" ? current.glassmorphism : BG_DEFAULTS.glassmorphism),
      overlayOpacity: typeof bgData.overlayOpacity === "number" ? bgData.overlayOpacity : (typeof current.overlayOpacity === "number" ? current.overlayOpacity : BG_DEFAULTS.overlayOpacity),
      blur: typeof bgData.blur === "number" ? bgData.blur : (typeof current.blur === "number" ? current.blur : BG_DEFAULTS.blur),
      updatedAt: Date.now(),
    };
    chrome.storage.local.set({ [keyFor("customBg")]: updated }, () => {
      renderCustomBgUi(updated);
      showBgStatusMsg("✅ Fond d'écran appliqué !");
    });
  });
}

function updateBgControls(field, val) {
  if (!currentHost) return;
  chrome.storage.local.get([keyFor("customBg")], (res) => {
    const current = res[keyFor("customBg")] || { overlayOpacity: BG_DEFAULTS.overlayOpacity, blur: BG_DEFAULTS.blur, glassmorphism: BG_DEFAULTS.glassmorphism };
    current[field] = val;
    chrome.storage.local.set({ [keyFor("customBg")]: current });
  });
}

function loadSettings() {
  const defaults = {
    [keyFor("galleryColumns")]: DEFAULTS.galleryColumns,
    [keyFor("galleryRows")]: DEFAULTS.galleryRows,
    [keyFor("maxTotalScreenshots")]: DEFAULTS.maxTotalScreenshots,
    [keyFor("maxContentWidth")]: DEFAULTS.maxContentWidth,
    [keyFor("textScale")]: DEFAULTS.textScale,
    [keyFor("customBg")]: null,
  };
  chrome.storage.local.get(defaults, (settings) => {
    RANGE_FIELDS.forEach((field) => {
      const input = document.getElementById(field);
      const value = settings[keyFor(field)];
      input.value = value;
      updateLabel(field, value);
    });
    renderCustomBgUi(settings[keyFor("customBg")]);
  });
}

function saveField(field, value) {
  chrome.storage.local.set({ [keyFor(field)]: value });
}

let customBgInitialized = false;

function initCustomBackground() {
  if (customBgInitialized) return;
  customBgInitialized = true;

  // Tabs
  const tabBtns = document.querySelectorAll(".bg-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.querySelectorAll(".bg-tab-pane").forEach((pane) => {
        pane.hidden = pane.id !== `bgTabPane-${tab}`;
      });
    });
  });

  // 1. Image upload
  const fileInput = document.getElementById("bgFileInput");
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        saveCustomBg({
          type: "image",
          url: dataUrl,
          rawName: file.name,
        });
      } catch (err) {
        showBgStatusMsg("❌ Erreur lors de la lecture de l'image", true);
      }
      fileInput.value = "";
    });
  }

  // 2. URL
  const urlInput = document.getElementById("bgUrlInput");
  const applyUrlBtn = document.getElementById("applyBgUrlBtn");
  const handleApplyUrl = () => {
    const raw = urlInput.value.trim();
    if (!raw) {
      showBgStatusMsg("Veuillez saisir une URL valide", true);
      return;
    }
    const ytId = extractYouTubeId(raw);
    if (ytId) {
      saveCustomBg({
        type: "youtube",
        videoId: ytId,
        url: `https://www.youtube.com/watch?v=${ytId}`,
        rawName: `YouTube (${ytId})`,
      });
      urlInput.value = "";
      return;
    }
    const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(raw);
    saveCustomBg({
      type: isVideo ? "video" : "image",
      url: raw,
      rawName: raw.length > 30 ? `${raw.slice(0, 27)}...` : raw,
    });
    urlInput.value = "";
  };
  if (applyUrlBtn) applyUrlBtn.addEventListener("click", handleApplyUrl);
  if (urlInput) {
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleApplyUrl();
    });
  }

  // 3. YouTube
  const ytInput = document.getElementById("bgYoutubeInput");
  const applyYtBtn = document.getElementById("applyBgYoutubeBtn");
  const handleApplyYt = () => {
    const raw = ytInput.value.trim();
    const ytId = extractYouTubeId(raw);
    if (!ytId) {
      showBgStatusMsg("Lien ou identifiant YouTube invalide", true);
      return;
    }
    saveCustomBg({
      type: "youtube",
      videoId: ytId,
      url: `https://www.youtube.com/watch?v=${ytId}`,
      rawName: `YouTube (${ytId})`,
    });
    ytInput.value = "";
  };
  if (applyYtBtn) applyYtBtn.addEventListener("click", handleApplyYt);
  if (ytInput) {
    ytInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleApplyYt();
    });
  }

  // 4. Video file upload
  const videoFileInput = document.getElementById("bgVideoFileInput");
  if (videoFileInput) {
    videoFileInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        saveCustomBg({
          type: "video",
          url: dataUrl,
          rawName: file.name,
        });
      } catch (err) {
        showBgStatusMsg("❌ Erreur lors de la lecture de la vidéo", true);
      }
      videoFileInput.value = "";
    });
  }

  // 5. HTML code & file
  const htmlFileInput = document.getElementById("bgHtmlFileInput");
  const htmlInput = document.getElementById("bgHtmlInput");
  const applyHtmlBtn = document.getElementById("applyBgHtmlBtn");

  if (htmlFileInput) {
    htmlFileInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        if (htmlInput) htmlInput.value = text;
        saveCustomBg({
          type: "html",
          htmlContent: text,
          rawName: file.name,
        });
      } catch (err) {
        showBgStatusMsg("❌ Erreur lors de la lecture du fichier HTML", true);
      }
      htmlFileInput.value = "";
    });
  }

  if (applyHtmlBtn) {
    applyHtmlBtn.addEventListener("click", () => {
      const text = htmlInput ? htmlInput.value.trim() : "";
      if (!text) {
        showBgStatusMsg("Veuillez saisir du code HTML", true);
        return;
      }
      saveCustomBg({
        type: "html",
        htmlContent: text,
        rawName: "Code HTML personnalisé",
      });
    });
  }

  // 6. Solid Color
  const colorPicker = document.getElementById("bgColorPicker");
  const colorTextInput = document.getElementById("bgColorTextInput");
  const applyColorBtn = document.getElementById("applyBgColorBtn");

  if (colorPicker && colorTextInput) {
    colorPicker.addEventListener("input", () => {
      colorTextInput.value = colorPicker.value;
    });
    colorTextInput.addEventListener("input", () => {
      const val = colorTextInput.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        colorPicker.value = val;
      }
    });
  }

  if (applyColorBtn) {
    applyColorBtn.addEventListener("click", () => {
      const colorVal = (colorTextInput ? colorTextInput.value.trim() : "") || (colorPicker ? colorPicker.value : "#121316");
      saveCustomBg({
        type: "color",
        color: colorVal,
        rawName: `Couleur (${colorVal})`,
      });
    });
  }

  document.querySelectorAll(".bg-color-preset-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const presetColor = dot.getAttribute("data-color");
      if (!presetColor) return;
      if (colorTextInput) colorTextInput.value = presetColor;
      if (colorPicker && /^#[0-9A-Fa-f]{6}$/.test(presetColor)) colorPicker.value = presetColor;
      saveCustomBg({
        type: "color",
        color: presetColor,
        rawName: `Couleur (${presetColor})`,
      });
    });
  });

  // Glassmorphism, overlay opacity & blur sliders
  const glassInput = document.getElementById("bgGlassmorphism");
  const glassVal = document.getElementById("bgGlassmorphismValue");
  if (glassInput) {
    glassInput.addEventListener("input", () => {
      const val = Number(glassInput.value);
      if (glassVal) glassVal.textContent = `${val}%`;
      updateBgControls("glassmorphism", val);
    });
  }

  const opacityInput = document.getElementById("bgOverlayOpacity");
  const opacityVal = document.getElementById("bgOverlayOpacityValue");
  if (opacityInput) {
    opacityInput.addEventListener("input", () => {
      const val = Number(opacityInput.value);
      if (opacityVal) opacityVal.textContent = `${val}%`;
      updateBgControls("overlayOpacity", val);
    });
  }

  const blurInput = document.getElementById("bgBlur");
  const blurVal = document.getElementById("bgBlurValue");
  if (blurInput) {
    blurInput.addEventListener("input", () => {
      const val = Number(blurInput.value);
      if (blurVal) blurVal.textContent = `${val}px`;
      updateBgControls("blur", val);
    });
  }

  // Remove background button
  const removeBtn = document.getElementById("removeBgBtn");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      if (!currentHost) return;
      chrome.storage.local.remove([keyFor("customBg")], () => {
        renderCustomBgUi(null);
        showBgStatusMsg("Fond d'écran supprimé.");
      });
    });
  }
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
      [...RANGE_FIELDS.map((field) => keyFor(field)), keyFor("customBg"), getSiteDisabledKey(currentHost)],
      () => {
        loadSettings();
        loadSiteEnabledState();
      }
    );
  });
}

function getSiteDisabledKey(host) {
  const norm = normalizeHost(host) || host;
  return `${norm}:disabled`;
}

function updateCurrentSiteEnabledUi(enabled) {
  const toggle = document.getElementById("siteEnabledToggle");
  const fields = document.getElementById("fields");
  const badge = document.getElementById("siteStatusBadge");
  const toggleDesc = document.getElementById("siteToggleDesc");

  if (toggle) toggle.checked = enabled;
  if (fields) fields.hidden = !enabled;
  if (badge) {
    badge.textContent = enabled ? "Actif" : "Désactivé";
    badge.classList.toggle("disabled", !enabled);
  }
  if (toggleDesc) {
    toggleDesc.textContent = enabled ? "Aperçu, filtres et captures actifs" : "Extension en pause sur ce site";
  }
}

function loadSiteEnabledState() {
  if (!currentHost) return;
  chrome.storage.local.get([getSiteDisabledKey(currentHost)], (res) => {
    const isDisabled = Boolean(res[getSiteDisabledKey(currentHost)]);
    updateCurrentSiteEnabledUi(!isDisabled);
  });
}

function renderAllSiteToggles(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const keys = SUPPORTED_HOSTS.map(getSiteDisabledKey);
  chrome.storage.local.get(keys, (res) => {
    SUPPORTED_HOSTS.forEach((host) => {
      const isDisabled = Boolean(res[getSiteDisabledKey(host)]);
      const item = document.createElement("div");
      item.className = "site-toggle-item";

      const toggleId = `${containerId}_toggle_${host.replace(/[^a-z0-9]/gi, "_")}`;

      item.innerHTML = `
        <div class="site-item-info">
          <span class="site-item-name">${SITE_LABELS[host] || host}</span>
          <span class="site-item-host">${host}</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="${toggleId}" ${isDisabled ? "" : "checked"}>
          <span class="slider"></span>
        </label>
      `;

      const input = item.querySelector("input");
      input.addEventListener("change", () => {
        const disabled = !input.checked;
        chrome.storage.local.set({ [getSiteDisabledKey(host)]: disabled }, () => {
          if (currentHost === host) {
            updateCurrentSiteEnabledUi(!disabled);
          }
          const otherContainerId = containerId === "settingsSiteToggles" ? "unsupportedSiteToggles" : "settingsSiteToggles";
          const otherInput = document.getElementById(`${otherContainerId}_toggle_${host.replace(/[^a-z0-9]/gi, "_")}`);
          if (otherInput) otherInput.checked = !disabled;
        });
      });

      container.appendChild(item);
    });
  });
}

let siteToggleInitialized = false;
function initSiteToggle() {
  if (siteToggleInitialized) return;
  siteToggleInitialized = true;

  const toggle = document.getElementById("siteEnabledToggle");
  if (toggle) {
    toggle.addEventListener("change", () => {
      if (!currentHost) return;
      const disabled = !toggle.checked;
      chrome.storage.local.set({ [getSiteDisabledKey(currentHost)]: disabled }, () => {
        updateCurrentSiteEnabledUi(!disabled);
        renderAllSiteToggles("settingsSiteToggles");
        renderAllSiteToggles("unsupportedSiteToggles");
      });
    });
  }
}

function showUnsupported() {
  document.getElementById("unsupported").hidden = false;
  document.getElementById("fields").hidden = true;
  document.getElementById("siteLabel").textContent = "";

  const siteCard = document.getElementById("siteToggleCard");
  if (siteCard) siteCard.hidden = true;
  const badge = document.getElementById("siteStatusBadge");
  if (badge) badge.hidden = true;

  renderAllSiteToggles("unsupportedSiteToggles");
  renderAllSiteToggles("settingsSiteToggles");
}

function showSite(host) {
  currentHost = host;
  document.getElementById("unsupported").hidden = true;
  const siteCard = document.getElementById("siteToggleCard");
  if (siteCard) siteCard.hidden = false;
  const badge = document.getElementById("siteStatusBadge");
  if (badge) badge.hidden = false;

  document.getElementById("siteLabel").textContent = SITE_LABELS[host] || host;
  loadSiteEnabledState();
  renderAllSiteToggles("settingsSiteToggles");
  attachListeners();
  initCustomBackground();
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

const GITHUB_REPO_URL = "https://github.com/Traycken/Crack-Game-Screenshots";
const GITHUB_RAW_MANIFEST_URL = "https://raw.githubusercontent.com/Traycken/Crack-Game-Screenshots/main/manifest.json";

function compareVersions(v1, v2) {
  const p1 = (v1 || "").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = (v2 || "").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(p1.length, p2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function initVersionChecker() {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version_name || manifest.version || "1.0.0";

  const versionEl = document.getElementById("extensionVersion");
  const checkBtn = document.getElementById("checkUpdateBtn");
  const statusEl = document.getElementById("updateCheckStatus");
  const bannerEl = document.getElementById("updateBanner");
  const bannerDesc = document.getElementById("updateBannerDesc");
  const badgeEl = document.getElementById("updateVersionBadge");
  const downloadBtn = document.getElementById("updateDownloadBtn");

  if (versionEl) {
    versionEl.textContent = `v${currentVersion}`;
  }

  // Affichage immédiat si déjà détecté en arrière-plan
  chrome.storage.local.get(["updateAvailable", "latestVersion"], (data) => {
    if (data.updateAvailable && data.latestVersion) {
      showUpdateBanner(data.latestVersion);
    }
  });

  function showUpdateBanner(remoteVersion) {
    if (badgeEl) badgeEl.textContent = `v${remoteVersion}`;
    if (bannerDesc) {
      bannerDesc.textContent = `Une nouvelle version (v${remoteVersion}) est disponible ! Vous utilisez actuellement la v${currentVersion}.`;
    }
    if (bannerEl) bannerEl.hidden = false;
  }

  function hideUpdateBanner() {
    if (bannerEl) bannerEl.hidden = true;
  }

  let isChecking = false;

  function check(isManual = false) {
    if (isChecking) return;
    isChecking = true;

    if (isManual && statusEl) {
      statusEl.className = "update-check-status loading";
      statusEl.textContent = "Vérification...";
    }

    chrome.runtime.sendMessage({ type: "CHECK_EXTENSION_UPDATES" }, (res) => {
      isChecking = false;

      if (chrome.runtime.lastError || !res || !res.success) {
        if (isManual && statusEl) {
          statusEl.className = "update-check-status error";
          statusEl.textContent = "❌ Échec";
          setTimeout(() => {
            if (statusEl.textContent === "❌ Échec") statusEl.textContent = "";
          }, 3500);
        }
        return;
      }

      if (res.hasUpdate && res.latestVersion) {
        showUpdateBanner(res.latestVersion);
        if (isManual && statusEl) {
          statusEl.className = "update-check-status";
          statusEl.textContent = `🎉 v${res.latestVersion} dispo !`;
        }
      } else {
        hideUpdateBanner();
        if (isManual && statusEl) {
          statusEl.className = "update-check-status up-to-date";
          statusEl.textContent = "✅ À jour";
          setTimeout(() => {
            if (statusEl.textContent === "✅ À jour") statusEl.textContent = "";
          }, 3500);
        }
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: `${GITHUB_REPO_URL}/releases/latest` });
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener("click", (e) => {
      e.preventDefault();
      check(true);
    });
  }

  // Vérification automatique en arrière-plan à l'ouverture du popup
  check(false);
}

function initCacheManager() {
  const countStat = document.getElementById("cacheCountStat");
  const sizeStat = document.getElementById("cacheSizeStat");
  const usageBadge = document.getElementById("cacheUsageBadge");
  const maxMbInput = document.getElementById("cacheMaxMb");
  const maxMbValue = document.getElementById("cacheMaxMbValue");
  const ttlDaysInput = document.getElementById("cacheTtlDays");
  const ttlDaysValue = document.getElementById("cacheTtlDaysValue");
  const clearBtn = document.getElementById("clearCacheBtn");
  const statusMsg = document.getElementById("cacheStatusMsg");

  if (!maxMbInput || !ttlDaysInput || !clearBtn) return;

  function updateUiStats(stats) {
    if (!stats) return;
    if (countStat) countStat.textContent = `${stats.count || 0}`;
    if (sizeStat) sizeStat.textContent = stats.formattedSize || "0 Ko";
    if (usageBadge) {
      usageBadge.textContent = `${stats.formattedSize || "0 Ko"} / ${stats.maxMb || 25} Mo`;
    }
    if (maxMbInput) maxMbInput.value = stats.maxMb || 25;
    if (maxMbValue) maxMbValue.textContent = `${stats.maxMb || 25} Mo`;
    if (ttlDaysInput) ttlDaysInput.value = stats.ttlDays || 7;
    if (ttlDaysValue) ttlDaysValue.textContent = `${stats.ttlDays || 7} j`;
  }

  function fetchStats() {
    chrome.runtime.sendMessage({ type: "GET_CACHE_STATS" }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res && res.success) {
        updateUiStats(res);
      }
    });
  }

  // Chargement initial des stats
  fetchStats();

  maxMbInput.addEventListener("input", () => {
    const val = Number(maxMbInput.value);
    if (maxMbValue) maxMbValue.textContent = `${val} Mo`;
    chrome.runtime.sendMessage({ type: "UPDATE_CACHE_CONFIG", maxMb: val }, (res) => {
      if (res && res.success) updateUiStats(res);
    });
  });

  ttlDaysInput.addEventListener("input", () => {
    const val = Number(ttlDaysInput.value);
    if (ttlDaysValue) ttlDaysValue.textContent = `${val} j`;
    chrome.runtime.sendMessage({ type: "UPDATE_CACHE_CONFIG", ttlDays: val }, (res) => {
      if (res && res.success) updateUiStats(res);
    });
  });

  clearBtn.addEventListener("click", () => {
    clearBtn.disabled = true;
    clearBtn.textContent = "⏳ Vidage en cours...";
    chrome.runtime.sendMessage({ type: "CLEAR_ALL_CACHE" }, (res) => {
      clearBtn.disabled = false;
      clearBtn.textContent = "🗑️ Vider tout le cache";
      if (statusMsg) {
        statusMsg.textContent = `✅ Cache vidé (${res?.count || 0} entrées supprimées)`;
        statusMsg.hidden = false;
        setTimeout(() => {
          statusMsg.hidden = true;
        }, 3000);
      }
      fetchStats();
    });
  });
}

function initNavigation() {
  const settingsBtn = document.getElementById("settingsToggleBtn");
  const viewMain = document.getElementById("viewMain");
  const viewSettings = document.getElementById("viewSettings");
  const headerTitle = document.getElementById("headerTitle");
  const creatorLink = document.getElementById("creatorLink");
  const githubRepoLink = document.getElementById("githubRepoLink");

  let inSettings = false;

  if (settingsBtn && viewMain && viewSettings && headerTitle) {
    settingsBtn.addEventListener("click", () => {
      inSettings = !inSettings;
      if (inSettings) {
        viewMain.hidden = true;
        viewSettings.hidden = false;
        headerTitle.textContent = "Paramètres";
        settingsBtn.classList.add("active");
        settingsBtn.title = "Retour aux réglages";
        renderAllSiteToggles("settingsSiteToggles");
      } else {
        viewMain.hidden = false;
        viewSettings.hidden = true;
        headerTitle.textContent = "Tailles des éléments";
        settingsBtn.classList.remove("active");
        settingsBtn.title = "Paramètres";
        if (currentHost) loadSiteEnabledState();
      }
    });
  }

  // Gestion des liens externes
  if (creatorLink) {
    creatorLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "https://github.com/Traycken" });
    });
  }
  if (githubRepoLink) {
    githubRepoLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: GITHUB_REPO_URL });
    });
  }
}

function initScrollIndicators() {
  const topIndicator = document.getElementById("scrollIndicatorTop");
  const bottomIndicator = document.getElementById("scrollIndicatorBottom");

  if (!topIndicator || !bottomIndicator) return;

  function updateIndicators() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const clientHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    const canScrollUp = scrollTop > 12;
    const canScrollDown = (scrollTop + clientHeight) < (scrollHeight - 16);

    topIndicator.classList.toggle("visible", canScrollUp);
    bottomIndicator.classList.toggle("visible", canScrollDown);
  }

  window.addEventListener("scroll", updateIndicators, { passive: true });
  window.addEventListener("resize", updateIndicators, { passive: true });

  const observer = new MutationObserver(() => {
    setTimeout(updateIndicators, 60);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  topIndicator.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  bottomIndicator.addEventListener("click", () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });

  setTimeout(updateIndicators, 120);
}

function detectBrowserHardware() {
  let gpu = "Carte graphique standard";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
      }
      if (!gpu || gpu === "WebKit WebGL") {
        gpu = gl.getParameter(gl.RENDERER) || "";
      }
    }
  } catch {}

  let cleanGpu = gpu
    .replace(/^ANGLE\s*\(([^,]+),\s*/i, "")
    .replace(/\s*Direct3D.*$/i, "")
    .replace(/\s*vs_\d+_\d+.*$/i, "")
    .replace(/\s*\(0x[0-9a-fA-F]+\)$/, "")
    .replace(/\s*OpenGL.*$/i, "")
    .trim();

  const ram = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;

  let estimatedVram = 8;
  const upperGpu = (cleanGpu || gpu).toUpperCase();
  if (upperGpu.includes("4090") || upperGpu.includes("3090")) estimatedVram = 24;
  else if (upperGpu.includes("4080") || upperGpu.includes("7900")) estimatedVram = 16;
  else if (upperGpu.includes("4070") || upperGpu.includes("3060") || upperGpu.includes("6700")) estimatedVram = 12;
  else if (upperGpu.includes("3080")) estimatedVram = 10;
  else if (upperGpu.includes("1080 TI")) estimatedVram = 11;
  else if (upperGpu.includes("1080") || upperGpu.includes("1070") || upperGpu.includes("2070") || upperGpu.includes("2080") || upperGpu.includes("3070") || upperGpu.includes("5700") || upperGpu.includes("6600")) estimatedVram = 8;
  else if (upperGpu.includes("1060") || upperGpu.includes("1660") || upperGpu.includes("5600")) estimatedVram = 6;
  else if (upperGpu.includes("1050") || upperGpu.includes("1650") || upperGpu.includes("580") || upperGpu.includes("570")) estimatedVram = 4;
  else if (upperGpu.includes("INTEL") || upperGpu.includes("UHD") || upperGpu.includes("HD GRAPHICS")) estimatedVram = 2;

  return {
    gpu: cleanGpu || gpu || "NVIDIA GeForce GTX 1070",
    vram: estimatedVram,
    ram,
    cores,
    cpuGhz: 3.6,
  };
}

function initHardwareSettings() {
  const toggle = document.getElementById("customHwToggle");
  const customFields = document.getElementById("hwCustomFields");
  const badge = document.getElementById("hwStatusBadge");
  const desc = document.getElementById("hwToggleDesc");
  const gpuInput = document.getElementById("hwGpuInput");
  const vramSelect = document.getElementById("hwVramSelect");
  const vramValue = document.getElementById("hwVramValue");
  const ramSelect = document.getElementById("hwRamSelect");
  const ramValue = document.getElementById("hwRamValue");
  const coresSelect = document.getElementById("hwCoresSelect");
  const coresValue = document.getElementById("hwCoresValue");
  const ghzSelect = document.getElementById("hwGhzSelect");
  const ghzValue = document.getElementById("hwGhzValue");
  const saveBtn = document.getElementById("saveHwBtn");
  const detectBtn = document.getElementById("detectHwBtn");
  const statusMsg = document.getElementById("hwStatusMsg");

  if (!toggle || !customFields) return;

  function showHwMsg(msg, isError = false) {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.className = isError ? "hw-status-msg error" : "hw-status-msg";
    statusMsg.hidden = false;
    setTimeout(() => {
      if (statusMsg.textContent === msg) statusMsg.hidden = true;
    }, 3500);
  }

  function updateUi(hw) {
    const isCustom = !!hw?.enabled;
    toggle.checked = isCustom;
    customFields.hidden = !isCustom;
    if (badge) {
      badge.textContent = isCustom ? "Manuel" : "Auto";
      badge.classList.toggle("custom", isCustom);
    }
    if (desc) {
      desc.textContent = isCustom ? "Configuration manuelle active" : "Détection automatique par le navigateur";
    }

    const detected = detectBrowserHardware();
    if (gpuInput) {
      gpuInput.value = hw?.gpu || detected.gpu || "";
    }
    if (vramSelect) {
      vramSelect.value = String(hw?.vram || detected.vram || 8);
      if (vramValue) vramValue.textContent = `${vramSelect.value} Go`;
    }
    if (ramSelect) {
      ramSelect.value = String(hw?.ram || detected.ram || 16);
      if (ramValue) ramValue.textContent = `${ramSelect.value} Go`;
    }
    if (coresSelect) {
      coresSelect.value = String(hw?.cores || detected.cores || 8);
      if (coresValue) coresValue.textContent = `${coresSelect.value} cœurs`;
    }
    if (ghzSelect) {
      ghzSelect.value = String(hw?.cpuGhz || detected.cpuGhz || 3.6);
      if (ghzValue) ghzValue.textContent = `${ghzSelect.value} GHz`;
    }
  }

  // Chargement depuis chrome.storage.local
  chrome.storage.local.get(["customHardware"], (res) => {
    const hw = res.customHardware || { enabled: false };
    updateUi(hw);
  });

  if (vramSelect && vramValue) {
    vramSelect.addEventListener("change", () => {
      vramValue.textContent = `${vramSelect.value} Go`;
    });
  }

  if (ramSelect && ramValue) {
    ramSelect.addEventListener("change", () => {
      ramValue.textContent = `${ramSelect.value} Go`;
    });
  }

  if (coresSelect && coresValue) {
    coresSelect.addEventListener("change", () => {
      coresValue.textContent = `${coresSelect.value} cœurs`;
    });
  }

  if (ghzSelect && ghzValue) {
    ghzSelect.addEventListener("change", () => {
      ghzValue.textContent = `${ghzSelect.value} GHz`;
    });
  }

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    customFields.hidden = !enabled;
    if (badge) {
      badge.textContent = enabled ? "Manuel" : "Auto";
      badge.classList.toggle("custom", enabled);
    }
    if (desc) {
      desc.textContent = enabled ? "Configuration manuelle active" : "Détection automatique par le navigateur";
    }

    const gpu = (gpuInput?.value || "").trim();
    const vram = Number(vramSelect?.value) || 8;
    const ram = Number(ramSelect?.value) || 16;
    const cores = Number(coresSelect?.value) || 8;
    const cpuGhz = Number(ghzSelect?.value) || 3.6;

    const hwData = { enabled, gpu, vram, ram, cores, cpuGhz };
    chrome.storage.local.set({ customHardware: hwData }, () => {
      showHwMsg(enabled ? "✅ Mode manuel activé !" : "✅ Mode détection automatique rétabli !");
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const gpu = (gpuInput?.value || "").trim();
      const vram = Number(vramSelect?.value) || 8;
      const ram = Number(ramSelect?.value) || 16;
      const cores = Number(coresSelect?.value) || 8;
      const cpuGhz = Number(ghzSelect?.value) || 3.6;

      const hwData = { enabled: true, gpu, vram, ram, cores, cpuGhz };
      toggle.checked = true;
      customFields.hidden = false;
      if (badge) {
        badge.textContent = "Manuel";
        badge.classList.add("custom");
      }
      if (desc) desc.textContent = "Configuration manuelle active";

      chrome.storage.local.set({ customHardware: hwData }, () => {
        showHwMsg("✅ Configuration matérielle enregistrée !");
      });
    });
  }

  if (detectBtn) {
    detectBtn.addEventListener("click", () => {
      const detected = detectBrowserHardware();
      if (gpuInput) gpuInput.value = detected.gpu;
      if (vramSelect) {
        vramSelect.value = String(detected.vram);
        if (vramValue) vramValue.textContent = `${detected.vram} Go`;
      }
      if (ramSelect) {
        ramSelect.value = String(detected.ram);
        if (ramValue) ramValue.textContent = `${detected.ram} Go`;
      }
      if (coresSelect) {
        coresSelect.value = String(detected.cores);
        if (coresValue) coresValue.textContent = `${detected.cores} cœurs`;
      }
      if (ghzSelect) {
        ghzSelect.value = String(detected.cpuGhz);
        if (ghzValue) ghzValue.textContent = `${detected.cpuGhz} GHz`;
      }
      showHwMsg("🔍 Matériel détecté prérempli !");
    });
  }
}

function init() {
  // Les 3 boutons doivent être utilisables immédiatement, indépendamment du
  // site actuellement ouvert (voire même si l'onglet actif n'est pas l'un
  // des 3 sites gérés) ; pas besoin d'attendre la résolution de l'onglet.
  initNavigation();
  initSiteToggle();
  initScrollIndicators();
  renderSiteLinks(null);
  initSteamSync();
  initHardwareSettings();
  initCacheManager();
  initVersionChecker();

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
    const supportedHost = normalizeHost(host);
    renderSiteLinks(supportedHost);
    if (supportedHost) {
      showSite(supportedHost);
    } else {
      showUnsupported();
    }
  });
}

init();
