(() => {
  const PROCESSED_ATTR = "data-lgsp-done";
  const BLACKLIST_SUBSTR = [
    "secure.gravatar.com",
    "social-twitter.gif",
    "social-digg.gif",
    "social-facebook.gif",
    "backgroundpic.jpg",
    "logoo.png",
    "/wp-content/themes/",
    "icon-rss.gif",
    "icon-twitter.gif",
    "icon-facebook.gif",
  ];

  // Neutralisation des fausses alertes anti-adblock et popups parasites du site
  function neutralizeAnnoyingPopups() {
    const closeBtn = document.querySelector("#closeNoticeBtn");
    if (closeBtn) {
      const modal = closeBtn.closest("div[style*='position: fixed'], div[style*='position:fixed'], div[style*='z-index']");
      if (modal) modal.remove();
      else closeBtn.remove();
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    document.querySelectorAll("div[style*='position: fixed'], div[style*='position:fixed']").forEach((el) => {
      if (el.classList.contains("lgsp-lightbox-overlay") || el.id === "lgsp-steam-sync-notif") return;
      const text = (el.textContent || "").toLowerCase();
      if (
        text.includes("preventing download links") ||
        text.includes("allow pop-ups") ||
        text.includes("disable any ad filtering") ||
        text.includes("disable adblock") ||
        text.includes("disable your ad blocker")
      ) {
        el.remove();
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    });
  }

  neutralizeAnnoyingPopups();

  // Config par domaine : sélecteurs de carte/titre/images, repris du scraper
  // Rust du projet quand disponibles.
  const SITE_CONFIGS = {
    "www.skidrowreloaded.com": {
      cardSelector: "div.post",
      titleSelector: "h2 a",
      detailImageSelector: "img",
      layout: "sidebar-flex",
      wrapSelector: "#overall-container",
      mainSelector: "#main-content",
      sidebarSelector: "#sidebar",
      pageWrapSelector: "#page-wrap",
      enhanceCard: true,
    },
    "pcgamestorrents.com": {
      cardSelector: "article.uk-article",
      titleSelector: "h2.uk-article-title a",
      detailImageSelector: "img.igg-image-content",
      layout: "uikit-container",
      pageSelector: ".tm-page",
      containerSelector: ".uk-container",
      mainSelector: ".container-main-post",
    },
    "igg-games.com": {
      cardSelector: "article.uk-article, article.post, div.post",
      titleSelector: "h2.uk-article-title a, h2.entry-title a, h2 a",
      detailImageSelector: "img.igg-image-content, .entry-content img, article img",
      layout: "uikit-container",
      pageSelector: ".tm-page",
      containerSelector: ".uk-container",
      mainSelector: ".container-main-post",
    },
  };

  const config = SITE_CONFIGS[location.hostname];
  if (!config) return;

  // SkidrowReloaded : activation sur les pages de liste et résultats de recherche
  if (config.layout === "sidebar-flex") {
    const path = location.pathname;
    const isListingPage =
      path === "/" ||
      /^\/page\/\d+\/?$/.test(path) ||
      path.startsWith("/category/") ||
      path.startsWith("/tag/") ||
      location.search.includes("s=");
    document.documentElement.classList.toggle("lgsp-skidrow-listing", isListingPage);
    if (!isListingPage) return;
  }

  const cardSel = config.cardSelector;
  const titleSel = config.titleSelector;
  const imgSel = config.detailImageSelector;

  const STORAGE_PREFIX = `${location.hostname}:`;
  const DEFAULTS = {
    galleryColumns: 3,
    galleryRows: 2,
    maxTotalScreenshots: 30,
    maxContentWidthPct: 66.7,
  };
  const CARD_PADDING = 44;
  const SCREENSHOT_RATIO = 9 / 16;
  const RESIZE_DEBOUNCE_MS = 120;

  function storageKey(field) {
    return `${STORAGE_PREFIX}${field}`;
  }

  function defaultsWithPrefix() {
    return {
      [storageKey("galleryColumns")]: DEFAULTS.galleryColumns,
      [storageKey("galleryRows")]: DEFAULTS.galleryRows,
      [storageKey("maxTotalScreenshots")]: DEFAULTS.maxTotalScreenshots,
      [storageKey("maxContentWidthPct")]: DEFAULTS.maxContentWidthPct,
    };
  }

  function normalizeSettings(raw) {
    return {
      galleryColumns: raw[storageKey("galleryColumns")] ?? DEFAULTS.galleryColumns,
      galleryRows: raw[storageKey("galleryRows")] ?? DEFAULTS.galleryRows,
      maxTotalScreenshots: raw[storageKey("maxTotalScreenshots")] ?? DEFAULTS.maxTotalScreenshots,
      maxContentWidthPct: raw[storageKey("maxContentWidthPct")] ?? DEFAULTS.maxContentWidthPct,
    };
  }

  function widthValueFor(settings) {
    const px = Math.round(
      (document.documentElement.clientWidth * settings.maxContentWidthPct) / 100
    );
    return `${px}px`;
  }

  function computeGalleryHeight(settings) {
    const ref = config.mainSelector ? document.querySelector(config.mainSelector) : null;
    let totalWidth = ref ? ref.getBoundingClientRect().width : document.documentElement.clientWidth;
    totalWidth -= CARD_PADDING;
    const columns = Math.max(1, settings.galleryColumns);
    const columnWidth = Math.max(80, totalWidth) / columns;
    return Math.round(columnWidth * SCREENSHOT_RATIO);
  }

  let lastSettings = null;

  function applySettings(settings) {
    lastSettings = settings;
    const root = document.documentElement.style;
    root.setProperty("--lgsp-gallery-columns", `${settings.galleryColumns}`);
    root.setProperty("--lgsp-gallery-rows", `${settings.galleryRows || 2}`);
    root.setProperty("--lgsp-gallery-gap", "6px");
    enforceMaxWidth(settings);
    requestAnimationFrame(() => {
      root.setProperty("--lgsp-gallery-height", `${computeGalleryHeight(settings)}px`);
      document.querySelectorAll(".lgsp-gallery-track").forEach((track) => {
        const container = track.closest(".lgsp-gallery-container");
        if (!container) return;
        const prev = container.querySelector(".lgsp-arrow-prev");
        const next = container.querySelector(".lgsp-arrow-next");
        const maxScroll = track.scrollWidth - track.clientWidth;
        if (prev && next) {
          if (maxScroll <= 4) {
            prev.classList.add("lgsp-hidden");
            next.classList.add("lgsp-hidden");
          } else {
            prev.classList.toggle("lgsp-hidden", track.scrollLeft <= 4);
            next.classList.toggle("lgsp-hidden", track.scrollLeft >= maxScroll - 4);
          }
        }
      });
    });
  }

  function enforceMaxWidth(settings) {
    const widthValue = widthValueFor(settings);
    if (config.layout === "sidebar-flex") {
      applySidebarFlexLayout(widthValue);
      return;
    }
    if (config.layout === "uikit-container") {
      applyUikitContainerLayout(widthValue);
      return;
    }
  }

  function applyUikitContainerLayout(widthValue) {
    if (config.pageSelector) {
      document.querySelectorAll(config.pageSelector).forEach((el) => {
        el.style.setProperty("max-width", widthValue, "important");
        el.style.setProperty("width", "100%", "important");
        el.style.setProperty("margin-left", "auto", "important");
        el.style.setProperty("margin-right", "auto", "important");
        el.style.setProperty("box-sizing", "border-box", "important");
      });
    }
    if (config.containerSelector) {
      document.querySelectorAll(config.containerSelector).forEach((el) => {
        el.style.setProperty("max-width", "none", "important");
        el.style.setProperty("width", "100%", "important");
        el.style.setProperty("margin-left", "auto", "important");
        el.style.setProperty("margin-right", "auto", "important");
        el.style.setProperty("box-sizing", "border-box", "important");
      });
    }
    if (config.mainSelector) {
      document.querySelectorAll(config.mainSelector).forEach((el) => {
        el.style.setProperty("max-width", "none", "important");
      });
    }
  }

  const SEARCH_HISTORY_KEY = "lgsp_skidrow_search_history";
  const LAST_SEARCH_KEY = "lgsp_skidrow_last_search";

  function getSearchHistory() {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveSearchQuery(query) {
    const trimmed = (query || "").trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(LAST_SEARCH_KEY, trimmed);
      const history = getSearchHistory().filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      history.unshift(trimmed);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch {}
  }

  function adjustSkidrowElements() {
    if (config.layout !== "sidebar-flex") return;

    const nav = document.querySelector("#nav");
    if (nav) {
      let search = document.querySelector("#search-1");
      if (!search) {
        search = document.createElement("div");
        search.id = "search-1";
        search.className = "widget";
        nav.insertAdjacentElement("afterend", search);
      } else if (nav.nextElementSibling !== search) {
        nav.insertAdjacentElement("afterend", search);
      }

      let form = search.querySelector("form");
      if (!form) {
        form = document.createElement("form");
        form.method = "get";
        form.id = "searchform";
        form.action = "https://www.skidrowreloaded.com/";
        search.appendChild(form);
      }

      if (!form.getAttribute("data-lgsp-styled")) {
        form.setAttribute("data-lgsp-styled", "1");

        // Récupération de la recherche en cours (depuis l'URL ?s=...), ou du champ, ou du dernier terme mémorisé
        const urlParams = new URLSearchParams(location.search);
        const urlQuery = urlParams.get("s");
        const existingInput = form.querySelector("#searchbar");
        const initialVal = urlQuery ?? (existingInput && existingInput.value ? existingInput.value : (localStorage.getItem(LAST_SEARCH_KEY) || ""));

        if (urlQuery) {
          saveSearchQuery(urlQuery);
        }

        const history = getSearchHistory();
        const datalistOptions = history.map((term) => `<option value="${term.replace(/"/g, '&quot;')}"></option>`).join("");

        form.innerHTML = `
          <input type="text" name="s" id="searchbar" list="lgsp-search-history" value="${initialVal.replace(/"/g, '&quot;')}" placeholder="Rechercher un jeu..." autocomplete="on">
          <datalist id="lgsp-search-history">
            ${datalistOptions}
          </datalist>
          <button type="submit" id="lgsp-search-btn" aria-label="Rechercher">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Rechercher</span>
          </button>
        `;

        form.addEventListener("submit", () => {
          const input = form.querySelector("#searchbar");
          if (input && input.value) {
            saveSearchQuery(input.value);
          }
        });
      }
    }

    // Suppression des widgets et de la sidebar
    const text33 = document.querySelector("#text-33");
    if (text33) text33.remove();

    const text3 = document.querySelector("#text-3");
    if (text3) text3.remove();

    const sidebar = document.querySelector("#sidebar");
    if (sidebar) sidebar.remove();
  }

  function applySidebarFlexLayout(widthValue) {
    if (config.pageWrapSelector) {
      document.querySelectorAll(config.pageWrapSelector).forEach((el) => {
        el.style.setProperty("max-width", widthValue, "important");
        el.style.setProperty("width", "100%", "important");
        el.style.setProperty("margin-left", "auto", "important");
        el.style.setProperty("margin-right", "auto", "important");
        el.style.setProperty("box-sizing", "border-box", "important");
      });
    }

    adjustSkidrowElements();

    const wrap = document.querySelector(config.wrapSelector);
    const main = document.querySelector(config.mainSelector);
    if (!wrap || !main) return;

    wrap.style.setProperty("max-width", widthValue, "important");
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("margin-left", "auto", "important");
    wrap.style.setProperty("margin-right", "auto", "important");
    wrap.style.setProperty("display", "block", "important");
    wrap.style.setProperty("box-sizing", "border-box", "important");

    main.style.setProperty("float", "none", "important");
    main.style.setProperty("width", "100%", "important");
    main.style.setProperty("max-width", "none", "important");
    main.style.setProperty("box-sizing", "border-box", "important");
  }

  chrome.storage.local.get(defaultsWithPrefix(), (settings) =>
    applySettings(normalizeSettings(settings))
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const relevant = Object.keys(changes).some((key) => key.startsWith(STORAGE_PREFIX));
    if (!relevant) return;
    chrome.storage.local.get(defaultsWithPrefix(), (settings) =>
      applySettings(normalizeSettings(settings))
    );
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (!lastSettings) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applySettings(lastSettings), RESIZE_DEBOUNCE_MS);
  });

  const detailCache = new Map();

  function findCardLink(card) {
    const titleLink = card.querySelector(titleSel);
    return titleLink ? titleLink.getAttribute("href") : null;
  }

  // Extrait les captures d'écran depuis la page détail
  function extractScreenshots(doc, coverSrc) {
    const nodes = doc.querySelectorAll(imgSel);
    const urls = [];
    nodes.forEach((el) => {
      const src =
        el.getAttribute("href") ||
        el.getAttribute("src") ||
        el.getAttribute("data-src") ||
        "";
      if (!src.startsWith("http")) return;
      if (BLACKLIST_SUBSTR.some((b) => src.includes(b))) return;
      // Ne pas ajouter l'image si elle correspond à la jaquette
      if (coverSrc && isSameImageUrl(src, coverSrc)) return;
      if (!urls.includes(src)) urls.push(src);
    });
    return urls;
  }

  // Vérifie si 2 URLs pointent vers la même ressource image
  function isSameImageUrl(url1, url2) {
    if (!url1 || !url2) return false;
    if (url1 === url2) return true;
    const clean1 = url1.split("?")[0].toLowerCase();
    const clean2 = url2.split("?")[0].toLowerCase();
    return clean1 === clean2;
  }

  // Extrait les vidéos YouTube depuis la page détail
  function extractYouTubeVideos(doc) {
    const videos = [];
    const iframes = doc.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
    iframes.forEach((iframe) => {
      const src = iframe.getAttribute("src") || "";
      const m = src.match(/(?:embed\/|v=|vi\/|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
      if (m && m[1]) {
        const videoId = m[1];
        if (!videos.some((v) => v.id === videoId)) {
          videos.push({
            type: "youtube",
            id: videoId,
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            title: "Bande-annonce YouTube",
          });
        }
      }
    });
    return videos;
  }

  const STEAM_APP_RE = /https?:\/\/store\.steampowered\.com\/app\/(\d+)/i;

  function extractSteamInfo(doc, card) {
    const roots = [doc, card].filter(Boolean);
    for (const root of roots) {
      const links = root.querySelectorAll('a[href*="store.steampowered.com/app/"]');
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        const m = href.match(STEAM_APP_RE);
        if (m) return { steamUrl: href, appId: m[1] };
      }
    }
    return null;
  }

  function requestSteamGameInfo(appId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "STEAM_GAME_INFO", appId },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("[Game Sites Screenshots] Steam info error:",
              chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          resolve(response || null);
        }
      );
    });
  }

  const STEAM_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a10 10 0 0 0-9.96 9.04l5.35 2.21a2.83 2.83 0 0 1 1.6-.5l.01 0 2.39-3.46v-.05a3.78 3.78 0 1 1 3.78 3.78h-.09l-3.4 2.43a2.84 2.84 0 0 1-5.65.31L1.7 13.6A10 10 0 1 0 12 2zm-4.99 15.17l-1.71-.71a2.12 2.12 0 0 0 3.82.8 2.13 2.13 0 0 0-1.01-2.84l1.77.73a1.56 1.56 0 1 1-2.87 2.02zM15.17 9.24a2.52 2.52 0 1 0-2.52 2.52 2.52 2.52 0 0 0 2.52-2.52zm-4.28 0a1.76 1.76 0 1 1 1.76 1.76 1.76 1.76 0 0 1-1.76-1.76z"/></svg>`;

  const SVG_CHECK = `<svg class="lgsp-svg-check" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3.5 8.5 6.5 11.5 12.5 4.5"/></svg>`;
  const SVG_CROSS = `<svg class="lgsp-svg-cross" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>`;

  // Données utilisateur Steam (Wishlist et Bibliothèque)
  let userSteamWishlist = new Set();
  let userSteamOwned = new Set();

  function updateSteamBadges(card, appId) {
    if (!card || !appId) return;
    const appIdStr = String(appId);

    // Suppression des anciennes bannières
    card.querySelectorAll(".lgsp-wishlist-banner, .lgsp-owned-banner").forEach((el) => el.remove());

    const titleEl = card.querySelector(titleSel);
    const titleParent = titleEl ? titleEl.closest("h2") : null;
    const insertRef = titleParent || card.firstChild;

    if (userSteamWishlist.has(appIdStr)) {
      const banner = document.createElement("div");
      banner.className = "lgsp-wishlist-banner";
      banner.innerHTML = `<span class="lgsp-wishlist-badge">⭐ DANS VOTRE WISHLIST</span>`;
      banner.title = "Ce jeu fait partie de votre liste de souhaits Steam";
      card.insertBefore(banner, insertRef);
    }
    if (userSteamOwned.has(appIdStr)) {
      const banner = document.createElement("div");
      banner.className = "lgsp-owned-banner";
      banner.innerHTML = `<span class="lgsp-owned-badge">📦 DÉJÀ DANS VOTRE BIBLIOTHÈQUE</span>`;
      banner.title = "Vous possédez déjà ce jeu sur Steam";
      card.insertBefore(banner, insertRef);
    }
  }

  function updateAllSteamBadges() {
    document.querySelectorAll(".lgsp-card, .post, article, " + (config.cardSelector || ".post")).forEach((card) => {
      const appId = card.getAttribute("data-steam-appid");
      if (appId) {
        updateSteamBadges(card, appId);
      }
    });
  }

  function loadUserSteamData() {
    chrome.storage.local.get(["steamWishlist", "steamOwned"], (res) => {
      if (Array.isArray(res.steamWishlist)) {
        userSteamWishlist = new Set(res.steamWishlist.map(String));
      }
      if (Array.isArray(res.steamOwned)) {
        userSteamOwned = new Set(res.steamOwned.map(String));
      }
      updateAllSteamBadges();
    });
  }
  loadUserSteamData();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.steamWishlist || changes.steamOwned)) {
      loadUserSteamData();
    }
  });

  // Construit le bandeau complet d'informations Steam
  function renderSteamInfo(card, steamUrl, steamData) {
    let wrap = card.querySelector(".lgsp-steam-info");
    const appIdMatch = (steamUrl || "").match(STEAM_APP_RE);
    const currentAppId = steamData?.appId || (appIdMatch ? appIdMatch[1] : null);

    if (currentAppId) {
      card.setAttribute("data-steam-appid", currentAppId);
      updateSteamBadges(card, currentAppId);
    }

    if (wrap) {
      if (currentAppId) {
        wrap.setAttribute("data-steam-appid", currentAppId);
      }
      return;
    }

    wrap = document.createElement("div");
    wrap.className = "lgsp-steam-info";
    if (currentAppId) {
      wrap.setAttribute("data-steam-appid", currentAppId);
    }

    // 1. Bouton Steam
    const btn = document.createElement("a");
    btn.className = "lgsp-steam-btn";
    btn.href = steamUrl;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.innerHTML = `${STEAM_SVG}<span>Steam</span>`;
    btn.addEventListener("click", (e) => e.stopPropagation());
    wrap.appendChild(btn);

    if (steamData) {
      // 2. Évaluation des joueurs
      if (steamData.reviews) {
        const rev = steamData.reviews;
        const revBadge = document.createElement("span");
        revBadge.className = `lgsp-steam-badge lgsp-rev-${rev.scoreClass}`;
        const icon = rev.scoreClass === "negative" ? "👎" : "👍";
        const formattedTotal = typeof rev.total === "number" ? rev.total.toLocaleString() : rev.total;
        revBadge.innerHTML = `${icon} ${rev.desc} (${rev.percent}% · ${formattedTotal} avis)`;
        revBadge.title = `${rev.totalPositive.toLocaleString()} avis positifs sur ${formattedTotal} (${rev.percent}%)`;
        wrap.appendChild(revBadge);
      }

      // 3. Prix
      if (steamData.price) {
        const priceBadge = document.createElement("span");
        if (steamData.price.isFree) {
          priceBadge.className = "lgsp-steam-badge lgsp-price-free";
          priceBadge.textContent = "💰 Gratuit";
        } else if (steamData.price.discountPercent > 0) {
          priceBadge.className = "lgsp-steam-badge lgsp-price-discount";
          const initial = steamData.price.initialFormatted ? `<s>${steamData.price.initialFormatted}</s> ` : "";
          priceBadge.innerHTML = `💰 ${initial}-${steamData.price.discountPercent}% ${steamData.price.formatted}`;
        } else if (steamData.price.formatted) {
          priceBadge.className = "lgsp-steam-badge lgsp-price-normal";
          priceBadge.textContent = `💰 ${steamData.price.formatted}`;
        }
        if (priceBadge.innerHTML) wrap.appendChild(priceBadge);
      }

      // 4. Badge Langue Français détaillé (3 éléments : Interface, Audio, Sous-titres)
      const french = steamData.french;
      if (french) {
        const badge = document.createElement("span");
        const check = `<span class="lgsp-check">${SVG_CHECK}</span>`;
        const cross = `<span class="lgsp-cross">${SVG_CROSS}</span>`;
        if (french.status === "full") {
          badge.className = "lgsp-lang-badge lgsp-lang-full";
          badge.innerHTML = `🇫🇷 FR: Interface ${check} · Audio ${check} · Sous-titres ${check}`;
          badge.title = "Français intégralement supporté (Interface, Audio et Sous-titres)";
        } else if (french.status === "subtitles") {
          badge.className = "lgsp-lang-badge lgsp-lang-text";
          badge.innerHTML = `🇫🇷 FR: Interface ${check} · Audio ${cross} · Sous-titres ${check}`;
          badge.title = "Français avec Interface et Sous-titres (sans doublage audio)";
        } else if (french.status === "none") {
          badge.className = "lgsp-lang-badge lgsp-lang-none";
          badge.innerHTML = `${cross} Pas de FR: Interface ${cross} · Audio ${cross} · Sous-titres ${cross}`;
          badge.title = "Le français n'est pas supporté";
        } else {
          badge.className = "lgsp-lang-badge lgsp-lang-unknown";
          badge.innerHTML = `❓ FR inconnu`;
        }
        wrap.appendChild(badge);
      }

      // 5. Modes de jeu (Solo, Multijoueur, Coop, MMO) - Saut à la ligne
      if (Array.isArray(steamData.modes) && steamData.modes.length > 0) {
        const modeIcons = {
          Solo: "🎮",
          Multijoueur: "👥",
          Coop: "🤝",
          MMO: "🌐",
        };
        const modesRow = document.createElement("div");
        modesRow.className = "lgsp-steam-modes-row";
        steamData.modes.forEach((mode) => {
          const modeBadge = document.createElement("span");
          modeBadge.className = "lgsp-steam-badge lgsp-mode-badge";
          modeBadge.textContent = `${modeIcons[mode] || "🕹️"} ${mode}`;
          if (steamData.modeDetails) {
            modeBadge.title = steamData.modeDetails;
          }
          modesRow.appendChild(modeBadge);
        });
        wrap.appendChild(modesRow);
      }

      // 6. Description courte du jeu (game_description_snippet)
      if (steamData.shortDescription) {
        const descEl = document.createElement("p");
        descEl.className = "lgsp-game-desc";
        descEl.textContent = steamData.shortDescription;
        wrap.appendChild(descEl);
      }
    }

    // Insertion sous le titre (h2)
    const title = card.querySelector(titleSel);
    const titleParent = title ? title.closest("h2") : null;
    if (titleParent && titleParent.nextSibling) {
      card.insertBefore(wrap, titleParent.nextSibling);
    } else {
      card.insertBefore(wrap, card.firstChild);
    }
  }

  // --- Lightbox multimédia (Images et Vidéos) --------------------------------

  // Attache la source vidéo (Flux HLS via Hls.js ou vidéo MP4)
  function attachVideoSource(video, item) {
    if (item.hls) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = item.hls;
        video.play().catch(() => {});
      } else if (typeof Hls !== "undefined" && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false });
        hls.loadSource(item.hls);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        video._hls = hls;
      } else if (item.mp4) {
        video.src = item.mp4;
        video.play().catch(() => {});
      }
    } else if (item.mp4) {
      video.src = item.mp4;
      video.play().catch(() => {});
    }
  }

  const SAVED_VOLUME_STORAGE_KEY = "lgsp_saved_media_volume";
  let currentMediaVolume = 0.25; // 25% par défaut lors de la toute première utilisation

  try {
    const stored = localStorage.getItem(SAVED_VOLUME_STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        currentMediaVolume = parsed;
      }
    }
  } catch {}

  function saveNewVolume(volume) {
    if (typeof volume !== "number" || isNaN(volume)) return;
    const clamped = Math.max(0, Math.min(1, volume));
    currentMediaVolume = clamped;
    try {
      localStorage.setItem(SAVED_VOLUME_STORAGE_KEY, `${clamped}`);
    } catch {}
  }

  // Écoute des mises à jour de volume depuis l'iframe YouTube
  window.addEventListener("message", (e) => {
    try {
      let data = e.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch {}
      }
      if (data && typeof data === "object") {
        if (data.event === "infoDelivery" && data.info && typeof data.info.volume === "number") {
          saveNewVolume(data.info.volume / 100);
        }
      }
    } catch {}
  });

  function openLightbox(item) {
    const box = document.createElement("div");
    box.className = "lgsp-lightbox";

    const closeBtn = document.createElement("button");
    closeBtn.className = "lgsp-lightbox-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Fermer");
    box.appendChild(closeBtn);

    const container = document.createElement("div");
    container.className = "lgsp-lightbox-content";

    if (typeof item === "string" || item.type === "image") {
      const src = typeof item === "string" ? item : item.src;
      const img = document.createElement("img");
      img.src = src;
      container.appendChild(img);
    } else if (item.type === "youtube") {
      const iframe = document.createElement("iframe");
      const url = item.embedUrl.includes("enablejsapi=1")
        ? item.embedUrl
        : `${item.embedUrl}${item.embedUrl.includes("?") ? "&" : "?"}enablejsapi=1`;
      iframe.src = url;
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "true");
      iframe.className = "lgsp-lightbox-video";

      const applyYoutubeVolume = () => {
        try {
          const volPercent = Math.round(currentMediaVolume * 100);
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "setVolume", args: [volPercent] }),
            "*"
          );
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "listening" }),
            "*"
          );
        } catch {}
      };

      iframe.addEventListener("load", () => {
        applyYoutubeVolume();
        setTimeout(applyYoutubeVolume, 300);
        setTimeout(applyYoutubeVolume, 800);
      });

      container.appendChild(iframe);
    } else if (item.type === "steam_movie") {
      const video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.volume = currentMediaVolume;
      video.className = "lgsp-lightbox-video";

      let isReadyForUserChanges = false;

      video.addEventListener("loadedmetadata", () => {
        video.volume = currentMediaVolume;
        setTimeout(() => {
          isReadyForUserChanges = true;
        }, 150);
      });

      video.addEventListener("volumechange", () => {
        if (isReadyForUserChanges && !video.muted) {
          saveNewVolume(video.volume);
        }
      });

      attachVideoSource(video, item);
      container.appendChild(video);
    }

    box.appendChild(container);

    function close() {
      const v = container.querySelector("video");
      if (v) {
        if (!v.muted) {
          saveNewVolume(v.volume);
        }
        if (v._hls) {
          v._hls.destroy();
        }
      }
      box.remove();
      document.removeEventListener("keydown", onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") close();
    }

    box.addEventListener("click", (e) => {
      if (e.target === box || e.target === closeBtn) close();
    });
    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(box);
  }

  function getVolumeIcon(vol) {
    if (vol <= 0) {
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
    }
    if (vol < 0.5) {
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  }

  function createHoverVolumeControl(onVolumeChange) {
    const wrap = document.createElement("div");
    wrap.className = "lgsp-hover-vol-control";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lgsp-hover-vol-btn";
    btn.innerHTML = getVolumeIcon(currentMediaVolume);
    btn.setAttribute("aria-label", "Activer / Couper le son");

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = `${Math.round(currentMediaVolume * 100)}`;
    slider.className = "lgsp-hover-vol-slider";

    let lastNonZeroVol = currentMediaVolume > 0 ? currentMediaVolume : 0.25;

    const updateVol = (newVal) => {
      slider.value = `${Math.round(newVal * 100)}`;
      btn.innerHTML = getVolumeIcon(newVal);
      saveNewVolume(newVal);
      if (onVolumeChange) onVolumeChange(newVal);
    };

    slider.addEventListener("input", (e) => {
      e.stopPropagation();
      const val = parseFloat(slider.value) / 100;
      if (val > 0) lastNonZeroVol = val;
      btn.innerHTML = getVolumeIcon(val);
      saveNewVolume(val);
      if (onVolumeChange) onVolumeChange(val);
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentMediaVolume > 0) {
        lastNonZeroVol = currentMediaVolume;
        updateVol(0);
      } else {
        updateVol(lastNonZeroVol);
      }
    });

    wrap.addEventListener("click", (e) => e.stopPropagation());
    wrap.addEventListener("mousedown", (e) => e.stopPropagation());

    wrap.appendChild(btn);
    wrap.appendChild(slider);
    return wrap;
  }

  function createHoverProgressBar(target, type) {
    const wrap = document.createElement("div");
    wrap.className = "lgsp-hover-progress-wrap";

    const track = document.createElement("div");
    track.className = "lgsp-hover-progress-track";

    const fill = document.createElement("div");
    fill.className = "lgsp-hover-progress-fill";

    const handle = document.createElement("div");
    handle.className = "lgsp-hover-progress-handle";

    track.appendChild(fill);
    track.appendChild(handle);
    wrap.appendChild(track);

    let isScrubbing = false;
    let ytDuration = 0;

    const setPosition = (pos) => {
      const pct = Math.max(0, Math.min(100, pos * 100));
      fill.style.width = `${pct}%`;
      handle.style.left = `${pct}%`;
    };

    const seekFromEvent = (e) => {
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setPosition(pos);

      if (type === "steam_movie" && target && target.duration) {
        target.currentTime = pos * target.duration;
      } else if (type === "youtube" && target) {
        const seekSeconds = pos * (ytDuration || 60);
        try {
          target.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [seekSeconds, true] }),
            "*"
          );
        } catch {}
      }
    };

    const onPointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      isScrubbing = true;
      wrap.classList.add("lgsp-scrubbing");
      seekFromEvent(e);

      const onPointerMove = (moveEvent) => {
        if (!isScrubbing) return;
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        seekFromEvent(moveEvent);
      };

      const onPointerUp = (upEvent) => {
        if (!isScrubbing) return;
        isScrubbing = false;
        wrap.classList.remove("lgsp-scrubbing");
        seekFromEvent(upEvent);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("click", (e) => e.stopPropagation());
    wrap.addEventListener("mousedown", (e) => e.stopPropagation());

    if (type === "steam_movie" && target) {
      target.addEventListener("timeupdate", () => {
        if (!isScrubbing && target.duration > 0) {
          setPosition(target.currentTime / target.duration);
        }
      });
    } else if (type === "youtube") {
      const onYtMessage = (e) => {
        try {
          let data = e.data;
          if (typeof data === "string") {
            try { data = JSON.parse(data); } catch {}
          }
          if (data && data.event === "infoDelivery" && data.info) {
            if (typeof data.info.duration === "number" && data.info.duration > 0) {
              ytDuration = data.info.duration;
            }
            if (typeof data.info.currentTime === "number" && ytDuration > 0 && !isScrubbing) {
              setPosition(data.info.currentTime / ytDuration);
            }
          }
        } catch {}
      };
      window.addEventListener("message", onYtMessage);
      wrap._cleanYt = () => window.removeEventListener("message", onYtMessage);
    }

    return wrap;
  }

  // --- Rendu de la galerie multimédia (Jaquette + Vidéos + Screenshots) -------

  function renderGallery(card, mediaItems, coverData) {
    const existingStatus = card.querySelector(".lgsp-status");
    if (existingStatus) existingStatus.remove();

    const existingGallery = card.querySelector(".lgsp-gallery");
    if (existingGallery) existingGallery.remove();

    const gallery = document.createElement("div");
    gallery.className = "lgsp-gallery";

    // 1. Jaquette originale en 1ère vignette (avec son lien <a> préservé)
    if (coverData && coverData.src) {
      const coverWrap = document.createElement("a");
      coverWrap.className = "lgsp-gallery-item lgsp-gallery-cover";
      coverWrap.href = coverData.href || findCardLink(card) || "#";
      coverWrap.title = coverData.alt || "Ouvrir la fiche du jeu";

      const coverImg = document.createElement("img");
      coverImg.src = coverData.src;
      coverImg.alt = coverData.alt || "Jaquette";
      coverImg.loading = "lazy";
      coverWrap.appendChild(coverImg);

      const coverTag = document.createElement("span");
      coverTag.className = "lgsp-item-tag lgsp-tag-cover";
      coverTag.textContent = "Jaquette";
      coverWrap.appendChild(coverTag);

      gallery.appendChild(coverWrap);
    }

    // 2. Vidéos et captures d'écran
    mediaItems.forEach((item) => {
      const itemWrap = document.createElement("div");
      itemWrap.className = "lgsp-gallery-item";

      const renderInitialContent = () => {
        itemWrap.innerHTML = "";
        itemWrap.classList.remove("lgsp-playing-inline");

        const img = document.createElement("img");
        img.src = item.thumbnail || item.src;
        img.loading = "lazy";
        img.alt = item.title || "Capture";
        itemWrap.appendChild(img);

        if (item.type === "youtube" || item.type === "steam_movie") {
          itemWrap.classList.add("lgsp-gallery-video");
          const playBtn = document.createElement("span");
          playBtn.className = "lgsp-play-badge";
          playBtn.innerHTML = `▶ ${item.type === "youtube" ? "YouTube" : "Trailer"}`;
          itemWrap.appendChild(playBtn);
        }
      };

      renderInitialContent();

      if (item.type === "youtube" || item.type === "steam_movie") {
        let hoverTimer = null;
        let isPlayingPreview = false;
        let activeProgressWrap = null;

        const startPreview = () => {
          if (isPlayingPreview) return;
          isPlayingPreview = true;
          itemWrap.innerHTML = "";
          itemWrap.classList.add("lgsp-playing-inline");

          if (item.type === "youtube") {
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&controls=0&modestbranding=1&loop=1&enablejsapi=1`;
            iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
            iframe.setAttribute("allowfullscreen", "true");
            iframe.className = "lgsp-gallery-embed";

            const applyHoverVolume = () => {
              try {
                const volPercent = Math.round(currentMediaVolume * 100);
                iframe.contentWindow.postMessage(
                  JSON.stringify({ event: "command", func: "unMute" }),
                  "*"
                );
                iframe.contentWindow.postMessage(
                  JSON.stringify({ event: "command", func: "setVolume", args: [volPercent] }),
                  "*"
                );
                iframe.contentWindow.postMessage(
                  JSON.stringify({ event: "listening" }),
                  "*"
                );
              } catch {}
            };

            iframe.addEventListener("load", () => {
              applyHoverVolume();
              setTimeout(applyHoverVolume, 300);
            });

            const volControl = createHoverVolumeControl((vol) => {
              try {
                const volPercent = Math.round(vol * 100);
                iframe.contentWindow.postMessage(
                  JSON.stringify({ event: "command", func: vol === 0 ? "mute" : "unMute" }),
                  "*"
                );
                iframe.contentWindow.postMessage(
                  JSON.stringify({ event: "command", func: "setVolume", args: [volPercent] }),
                  "*"
                );
              } catch {}
            });

            const progressBar = createHoverProgressBar(iframe, "youtube");
            activeProgressWrap = progressBar;

            itemWrap.appendChild(iframe);
            itemWrap.appendChild(volControl);
            itemWrap.appendChild(progressBar);
          } else if (item.type === "steam_movie") {
            const video = document.createElement("video");
            video.controls = false;
            video.autoplay = true;
            video.muted = false;
            video.volume = currentMediaVolume;
            video.playsInline = true;
            video.className = "lgsp-gallery-embed";

            video.addEventListener("play", () => {
              video.volume = currentMediaVolume;
            });

            const volControl = createHoverVolumeControl((vol) => {
              video.volume = vol;
              video.muted = (vol === 0);
            });

            const progressBar = createHoverProgressBar(video, "steam_movie");
            activeProgressWrap = progressBar;

            attachVideoSource(video, item);
            itemWrap.appendChild(video);
            itemWrap.appendChild(volControl);
            itemWrap.appendChild(progressBar);
          }

          // Overlay transparent pour capter le clic utilisateur et ouvrir la Lightbox
          const clickOverlay = document.createElement("div");
          clickOverlay.className = "lgsp-video-click-overlay";
          itemWrap.appendChild(clickOverlay);
        };

        const stopPreview = () => {
          if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
          }
          if (activeProgressWrap && activeProgressWrap._cleanYt) {
            activeProgressWrap._cleanYt();
            activeProgressWrap = null;
          }
          if (isPlayingPreview) {
            isPlayingPreview = false;
            const v = itemWrap.querySelector("video");
            if (v) {
              if (v._hls) v._hls.destroy();
              v.pause();
              v.removeAttribute("src");
              v.load();
            }
            renderInitialContent();
          }
        };

        itemWrap.addEventListener("mouseenter", () => {
          hoverTimer = setTimeout(() => {
            startPreview();
          }, 300);
        });

        itemWrap.addEventListener("mouseleave", () => {
          stopPreview();
        });

        // Clic gauche sur la vignette ouvre le lecteur en grand dans la Lightbox
        itemWrap.addEventListener("click", (e) => {
          if (e.button === 1 || e.which === 2) return;
          e.preventDefault();
          e.stopPropagation();
          stopPreview();
          openLightbox(item);
        });

        // Clic molette (clic milieu) ouvre la page du jeu dans un nouvel onglet
        itemWrap.addEventListener("auxclick", (e) => {
          if (e.button === 1 || e.which === 2) {
            e.preventDefault();
            e.stopPropagation();
            const cardLink = findCardLink(card);
            if (cardLink) window.open(cardLink, "_blank", "noopener,noreferrer");
          }
        });
      } else {
        // Clic gauche sur la vignette ouvre l'image en grand dans la Lightbox
        itemWrap.addEventListener("click", (e) => {
          if (e.button === 1 || e.which === 2) return;
          e.preventDefault();
          e.stopPropagation();
          openLightbox(item);
        });

        // Clic molette (clic milieu) ouvre la page du jeu dans un nouvel onglet
        itemWrap.addEventListener("auxclick", (e) => {
          if (e.button === 1 || e.which === 2) {
            e.preventDefault();
            e.stopPropagation();
            const cardLink = findCardLink(card);
            if (cardLink) window.open(cardLink, "_blank", "noopener,noreferrer");
          }
        });
      }

      gallery.appendChild(itemWrap);
    });

    if (gallery.children.length === 0) {
      const empty = document.createElement("div");
      empty.className = "lgsp-status";
      empty.textContent = "Aucun média trouvé";
      card.appendChild(empty);
      return;
    }

    const container = document.createElement("div");
    container.className = "lgsp-gallery-container";

    const prevBtn = document.createElement("button");
    prevBtn.className = "lgsp-carousel-arrow lgsp-arrow-prev lgsp-hidden";
    prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    prevBtn.setAttribute("aria-label", "Précédent");

    const nextBtn = document.createElement("button");
    nextBtn.className = "lgsp-carousel-arrow lgsp-arrow-next lgsp-hidden";
    nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    nextBtn.setAttribute("aria-label", "Suivant");

    const track = document.createElement("div");
    track.className = "lgsp-gallery-track";

    track.appendChild(gallery);
    container.appendChild(prevBtn);
    container.appendChild(track);
    container.appendChild(nextBtn);

    let currentIndex = 0;

    function getColumns() {
      return Math.max(1, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--lgsp-gallery-columns") || "3", 10));
    }

    function getRows() {
      return Math.max(1, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--lgsp-gallery-rows") || "2", 10));
    }

    function updateArrows() {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 2) {
        prevBtn.classList.add("lgsp-hidden");
        nextBtn.classList.add("lgsp-hidden");
      } else {
        prevBtn.classList.toggle("lgsp-hidden", track.scrollLeft <= 2);
        nextBtn.classList.toggle("lgsp-hidden", track.scrollLeft >= maxScroll - 4);
      }
    }

    track.addEventListener("scroll", () => {
      updateArrows();
      const firstItem = gallery.children[0];
      if (firstItem && firstItem.offsetWidth > 0) {
        const itemWidth = firstItem.offsetWidth + 6;
        const colsScrolled = Math.round(track.scrollLeft / itemWidth);
        const rows = getRows();
        currentIndex = colsScrolled * rows;
      }
    }, { passive: true });

    prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cols = getColumns();
      const rows = getRows();
      const batch = cols * rows;
      currentIndex = Math.max(0, currentIndex - batch);
      const targetItem = gallery.children[currentIndex];
      if (targetItem) {
        track.scrollTo({ left: targetItem.offsetLeft, behavior: "smooth" });
      } else {
        track.scrollBy({ left: -track.clientWidth, behavior: "smooth" });
      }
      setTimeout(updateArrows, 80);
      setTimeout(updateArrows, 350);
    });

    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cols = getColumns();
      const rows = getRows();
      const batch = cols * rows;
      const total = gallery.children.length;
      currentIndex = Math.min(total - 1, currentIndex + batch);
      const targetItem = gallery.children[currentIndex];
      if (targetItem) {
        track.scrollTo({ left: targetItem.offsetLeft, behavior: "smooth" });
      } else {
        track.scrollBy({ left: track.clientWidth, behavior: "smooth" });
      }
      setTimeout(updateArrows, 80);
      setTimeout(updateArrows, 350);
    });

    card.appendChild(container);

    requestAnimationFrame(() => {
      updateArrows();
    });
  }

  // --- Chargement et orchestration par carte ---------------------------------

  async function loadMediaForCard(card) {
    const link = findCardLink(card);
    if (!link) return;

    card.setAttribute(PROCESSED_ATTR, "1");

    const status = document.createElement("div");
    status.className = "lgsp-status";
    status.textContent = "Chargement des médias...";
    card.appendChild(status);

    try {
      // Récupération de la jaquette mémorisée lors du nettoyage de la carte
      let coverData = card._lgspCoverData || null;

      let cached = detailCache.get(link);
      let pageScreenshots = [];
      let pageVideos = [];
      let steamInfo = null;

      if (cached) {
        pageScreenshots = cached.pageScreenshots;
        pageVideos = cached.pageVideos;
        steamInfo = cached.steamInfo;
      } else {
        const res = await fetch(link, { credentials: "include" });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        // Si la jaquette n'a pas été trouvée sur la liste, on la cherche sur la page détail
        if (!coverData) {
          const coverImgEl = doc.querySelector("img.aligncenter");
          if (coverImgEl) {
            coverData = {
              src: coverImgEl.getAttribute("src") || "",
              alt: coverImgEl.getAttribute("alt") || "",
              href: link,
            };
          }
        }

        const coverSrc = coverData ? coverData.src : null;
        pageScreenshots = extractScreenshots(doc, coverSrc);
        pageVideos = extractYouTubeVideos(doc);
        steamInfo = extractSteamInfo(doc, card);

        detailCache.set(link, { pageScreenshots, pageVideos, steamInfo });
      }

      // Récupération des données Steam enrichies
      let steamData = null;
      if (steamInfo && steamInfo.appId) {
        steamData = await requestSteamGameInfo(steamInfo.appId);
      }

      // Construction de la liste multimédia combinée (Vidéos + Captures)
      const combinedMedia = [];

      // A. Vidéos YouTube trouvées sur la page
      pageVideos.forEach((v) => combinedMedia.push(v));

      // B. Trailers Steam si disponibles
      if (steamData && Array.isArray(steamData.movies)) {
        steamData.movies.forEach((m) => {
          if (m.hls || m.mp4 || m.webm || m.thumbnail) {
            combinedMedia.push({
              type: "steam_movie",
              thumbnail: m.thumbnail,
              hls: m.hls,
              mp4: m.mp4,
              webm: m.webm,
              title: m.name || "Bande-annonce Steam",
            });
          }
        });
      }

      // C. Captures d'écran de la page détail
      pageScreenshots.forEach((src) => {
        combinedMedia.push({ type: "image", src, thumbnail: src });
      });

      // D. Captures d'écran HD supplémentaires de Steam
      if (steamData && Array.isArray(steamData.screenshots)) {
        steamData.screenshots.forEach((s) => {
          // Évite d'ajouter si déjà présent
          if (!combinedMedia.some((m) => isSameImageUrl(m.thumbnail || m.src, s.thumbnail) || isSameImageUrl(m.src, s.full))) {
            combinedMedia.push({
              type: "image",
              src: s.full,
              thumbnail: s.thumbnail,
              title: "Capture Steam",
            });
          }
        });
      }

      // Limitation selon le réglage de la popup et rendu
      const maxAllowed = (lastSettings && lastSettings.maxTotalScreenshots) || DEFAULTS.maxTotalScreenshots;
      const finalMedia = combinedMedia.slice(0, maxAllowed);
      renderGallery(card, finalMedia, coverData);

      if (steamInfo && steamInfo.steamUrl) {
        renderSteamInfo(card, steamInfo.steamUrl, steamData);
      }
    } catch (err) {
      status.textContent = "Erreur de chargement";
      console.warn("[Game Sites Screenshots]", link, err);
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        observer.unobserve(card);
        loadMediaForCard(card);
      });
    },
    { rootMargin: "200px" }
  );

  function enforceSingleColumnLayout(card) {
    card.style.setProperty("display", "block", "important");
    card.style.setProperty("width", "100%", "important");
    card.style.setProperty("max-width", "none", "important");
    card.style.setProperty("float", "none", "important");
    card.style.setProperty("margin-bottom", "24px", "important");
    card.classList.add("lgsp-card");
  }

  // --- Nettoyage spécifique SkidrowReloaded (Réduction verticale & Jaquette) ---

  function extractAndCleanCover(card) {
    const excerpt = card.querySelector(".post-excerpt");
    if (!excerpt) return;

    // Récupérer la jaquette originale <a href="..."><img class="aligncenter" ...></a>
    const linkEl = excerpt.querySelector("a:has(img), p > a, a");
    const imgEl = excerpt.querySelector("img.aligncenter, img");

    if (imgEl) {
      const src = imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || "";
      const alt = imgEl.getAttribute("alt") || "";
      const href = linkEl ? linkEl.getAttribute("href") : findCardLink(card);

      if (src && !BLACKLIST_SUBSTR.some((b) => src.includes(b))) {
        card._lgspCoverData = { src, alt, href };
      }
    }

    // Supprimer .post-excerpt du DOM pour éliminer toute la hauteur superflue
    excerpt.remove();
  }

  function removeFooterMeta(card) {
    const footer = card.querySelector(".meta.right");
    if (footer) footer.remove();
  }

  function enhanceCard(card) {
    extractAndCleanCover(card);
    removeFooterMeta(card);
  }

  function scanForCards() {
    neutralizeAnnoyingPopups();
    adjustSkidrowElements();
    document.querySelectorAll(`${cardSel}`).forEach((card) => {
      if (!card.hasAttribute(PROCESSED_ATTR)) {
        enforceSingleColumnLayout(card);
        if (config.enhanceCard) enhanceCard(card);
        observer.observe(card);
      }
    });
  }

  scanForCards();

  const mutationObserver = new MutationObserver(() => scanForCards());
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();