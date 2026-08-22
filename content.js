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

  // Config par domaine : sélecteurs de carte/titre/images
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
    if (document.documentElement) {
      document.documentElement.classList.toggle("lgsp-skidrow-listing", isListingPage);
    }
    if (!isListingPage) return;
  }

  // --- Écran de chargement / Splash Screen pour masquer le site brut ---
  function showPageLoader(text = "Chargement de la page optimisée...") {
    let loader = document.getElementById("lgsp-page-loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "lgsp-page-loader";
      const target = document.documentElement || document.head || document.body || document;
      if (target && target.appendChild) {
        target.appendChild(loader);
      }
    }
    loader.innerHTML = `
      <div class="lgsp-loader-content">
        <div class="lgsp-loader-spinner"></div>
        <div class="lgsp-loader-text">${text}</div>
      </div>
    `;
    loader.classList.remove("lgsp-fade-out");
    if (document.documentElement) {
      document.documentElement.classList.add("lgsp-loading");
      document.documentElement.classList.remove("lgsp-ready");
    }
  }

  function hidePageLoader() {
    if (document.documentElement) {
      document.documentElement.classList.remove("lgsp-loading");
      document.documentElement.classList.add("lgsp-ready");
    }
    const loader = document.getElementById("lgsp-page-loader");
    if (loader) {
      loader.classList.add("lgsp-fade-out");
      setTimeout(() => {
        try {
          if (loader && loader.classList.contains("lgsp-fade-out")) {
            loader.remove();
          }
        } catch (_) {}
      }, 350);
    }
  }

  showPageLoader();
  // Sécurité anti-blocage : masque le loader au bout de 2.5s max quoi qu'il arrive
  setTimeout(hidePageLoader, 2500);
  window.addEventListener("load", hidePageLoader);

  // Neutralisation des fausses alertes anti-adblock et popups parasites du site
  function neutralizeAnnoyingPopups() {
    const closeBtn = document.querySelector("#closeNoticeBtn");
    if (closeBtn) {
      const modal = closeBtn.closest("div[style*='position: fixed'], div[style*='position:fixed'], div[style*='z-index']");
      if (modal) modal.remove();
      else closeBtn.remove();
      if (document.body) document.body.style.overflow = "";
      if (document.documentElement) document.documentElement.style.overflow = "";
    }

    document.querySelectorAll("div[style*='position: fixed'], div[style*='position:fixed']").forEach((el) => {
      if (el.classList.contains("lgsp-lightbox-overlay") || el.id === "lgsp-steam-sync-notif" || el.id === "lgsp-page-loader") return;
      const text = (el.textContent || "").toLowerCase();
      if (
        text.includes("preventing download links") ||
        text.includes("allow pop-ups") ||
        text.includes("disable any ad filtering") ||
        text.includes("disable adblock") ||
        text.includes("disable your ad blocker")
      ) {
        el.remove();
        if (document.body) document.body.style.overflow = "";
        if (document.documentElement) document.documentElement.style.overflow = "";
      }
    });
  }

  neutralizeAnnoyingPopups();

  const cardSel = config.cardSelector;
  const titleSel = config.titleSelector;
  const imgSel = config.detailImageSelector;

  const STORAGE_PREFIX = `${location.hostname}:`;
  const DEFAULTS = {
    galleryColumns: 3,
    galleryRows: 2,
    maxTotalScreenshots: 30,
    maxContentWidthPct: 66.7,
    textScale: 100,
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
      [storageKey("textScale")]: DEFAULTS.textScale,
    };
  }

  function normalizeSettings(raw) {
    return {
      galleryColumns: raw[storageKey("galleryColumns")] ?? DEFAULTS.galleryColumns,
      galleryRows: raw[storageKey("galleryRows")] ?? DEFAULTS.galleryRows,
      maxTotalScreenshots: raw[storageKey("maxTotalScreenshots")] ?? DEFAULTS.maxTotalScreenshots,
      maxContentWidthPct: raw[storageKey("maxContentWidthPct")] ?? DEFAULTS.maxContentWidthPct,
      textScale: raw[storageKey("textScale")] ?? DEFAULTS.textScale,
    };
  }

  function widthValueFor(settings) {
    const px = Math.round(
      (document.documentElement.clientWidth * settings.maxContentWidthPct) / 100
    );
    return `${px}px`;
  }

  function computeGalleryHeight(settings) {
    const s = settings || lastSettings || DEFAULTS;
    const ref = config.mainSelector ? document.querySelector(config.mainSelector) : null;
    const refRect = ref ? ref.getBoundingClientRect() : null;
    const refWidth = (refRect && refRect.width > 200) ? refRect.width : 0;
    const clientWidth = document.documentElement.clientWidth || window.innerWidth || 1200;
    const pct = s.maxContentWidthPct || DEFAULTS.maxContentWidthPct;
    let totalWidth = refWidth || Math.round((clientWidth * pct) / 100);
    totalWidth -= CARD_PADDING;
    const columns = Math.max(1, s.galleryColumns || DEFAULTS.galleryColumns);
    const columnWidth = Math.max(120, totalWidth) / columns;
    return Math.round(columnWidth * SCREENSHOT_RATIO);
  }

  let lastSettings = null;

  function applySettings(settings) {
    lastSettings = settings;
    const root = document.documentElement.style;
    const scale = Math.max(0.1, Math.min(2.0, (settings.textScale ?? 100) / 100));
    root.setProperty("--lgsp-text-scale", `${scale}`);
    root.setProperty("--lgsp-gallery-columns", `${settings.galleryColumns}`);
    root.setProperty("--lgsp-gallery-rows", `${settings.galleryRows || 2}`);
    root.setProperty("--lgsp-gallery-gap", "6px");
    root.setProperty("--lgsp-gallery-height", `${computeGalleryHeight(settings)}px`);
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
          <div class="lgsp-searchbar-wrapper">
            <input type="text" name="s" id="searchbar" list="lgsp-search-history" value="${initialVal.replace(/"/g, '&quot;')}" placeholder="Rechercher un jeu..." autocomplete="on">
            <button type="button" id="lgsp-search-clear-btn" class="lgsp-search-clear-btn${initialVal ? ' lgsp-visible' : ''}" title="Effacer la recherche" aria-label="Effacer">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <datalist id="lgsp-search-history">
              ${datalistOptions}
            </datalist>
          </div>
          <button type="submit" id="lgsp-search-btn" aria-label="Rechercher">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Rechercher</span>
          </button>
        `;

        const input = form.querySelector("#searchbar");
        const clearBtn = form.querySelector("#lgsp-search-clear-btn");

        function updateClearBtnVisibility() {
          if (!clearBtn || !input) return;
          if (input.value.trim().length > 0) {
            clearBtn.classList.add("lgsp-visible");
          } else {
            clearBtn.classList.remove("lgsp-visible");
          }
        }

        if (input) {
          input.addEventListener("input", updateClearBtnVisibility);
          input.addEventListener("change", updateClearBtnVisibility);
        }

        if (clearBtn && input) {
          clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            input.value = "";
            updateClearBtnVisibility();
            input.focus();
          });
        }

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const query = input ? input.value.trim() : "";
          if (query) {
            saveSearchQuery(query);
            const searchUrl = `https://www.skidrowreloaded.com/?s=${encodeURIComponent(query)}`;
            navigateToUrl(searchUrl);
          }
        });
      }
    }

    // Gestion de la pagination .wp-pagenavi (barre latérale verticale flottante)
    const allPagenavis = document.querySelectorAll(".wp-pagenavi");
    if (allPagenavis.length > 1) {
      for (let i = 1; i < allPagenavis.length; i++) {
        allPagenavis[i].remove();
      }
    }
    const pagenavi = document.querySelector(".wp-pagenavi");
    if (pagenavi) {
      formatPagenavi(pagenavi);
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

  const STORE_PATTERNS = [
    {
      platform: "steam",
      name: "Steam",
      matchUrl: (url) => url.includes("store.steampowered.com/app/"),
      getAppId: (url) => (url.match(/store\.steampowered\.com\/app\/(\d+)/i) || [])[1],
      btnClass: "lgsp-store-steam",
    },
    {
      platform: "gog",
      name: "GOG.com",
      matchUrl: (url) => url.includes("gog.com/"),
      btnClass: "lgsp-store-gog",
    },
    {
      platform: "epic",
      name: "Epic Games",
      matchUrl: (url) => url.includes("epicgames.com/"),
      btnClass: "lgsp-store-epic",
    },
    {
      platform: "itch",
      name: "itch.io",
      matchUrl: (url) => url.includes("itch.io/"),
      btnClass: "lgsp-store-itch",
    },
    {
      platform: "xbox",
      name: "Xbox Store",
      matchUrl: (url) => url.includes("xbox.com/") || url.includes("microsoft.com/"),
      btnClass: "lgsp-store-xbox",
    },
    {
      platform: "ubisoft",
      name: "Ubisoft Store",
      matchUrl: (url) => url.includes("ubisoft.com/"),
      btnClass: "lgsp-store-ubisoft",
    },
    {
      platform: "ea",
      name: "EA App",
      matchUrl: (url) => url.includes("ea.com/games/") || url.includes("origin.com/"),
      btnClass: "lgsp-store-ea",
    },
  ];

  function extractStoreInfo(doc, card) {
    const roots = [doc, card].filter(Boolean);

    // 1. Chercher d'abord un lien Steam
    for (const root of roots) {
      const links = root.querySelectorAll('a[href*="store.steampowered.com/app/"]');
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        const m = href.match(STEAM_APP_RE);
        if (m) {
          return {
            platform: "steam",
            name: "Steam",
            storeUrl: href,
            steamUrl: href,
            appId: m[1],
            btnClass: "lgsp-store-steam",
          };
        }
      }
    }

    // 2. Chercher les autres plateformes officielles (GOG, Epic, Itch, etc.)
    for (const root of roots) {
      const links = root.querySelectorAll("a[href]");
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        for (let i = 1; i < STORE_PATTERNS.length; i++) {
          const sp = STORE_PATTERNS[i];
          if (sp.matchUrl(href)) {
            return {
              platform: sp.platform,
              name: sp.name,
              storeUrl: href,
              steamUrl: null,
              appId: null,
              btnClass: sp.btnClass,
            };
          }
        }
      }
    }

    return null;
  }

  function extractSteamInfo(doc, card) {
    return extractStoreInfo(doc, card);
  }

  // Débarrasse les liens de téléchargement des redirections publicitaires et raccourcisseurs
  function cleanDownloadUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
    let url = rawUrl.trim();

    const extractNestedUrl = (u) => {
      try {
        const parsed = new URL(u);
        const searchParams = parsed.searchParams;
        const paramKeys = ["url", "to", "link", "dest", "target", "redirect", "href", "download", "d", "r", "goto", "out", "src"];

        for (const key of paramKeys) {
          const val = searchParams.get(key);
          if (val) {
            if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("magnet:")) {
              return decodeURIComponent(val);
            }
            try {
              const decodedBase64 = atob(val);
              if (decodedBase64.startsWith("http://") || decodedBase64.startsWith("https://") || decodedBase64.startsWith("magnet:")) {
                return decodedBase64;
              }
            } catch {}
          }
        }

        const queryMatch = u.match(/(?:[?&][^=]+=)(https?%3A%2F%2F[^\s&"'>]+|https?:\/\/[^\s&"'>]+|magnet%3A%3F[^\s&"'>]+|magnet:\?[^\s&"'>]+)/i);
        if (queryMatch) {
          return decodeURIComponent(queryMatch[1]);
        }
      } catch {}
      return null;
    };

    let nested = extractNestedUrl(url);
    let depth = 0;
    while (nested && nested !== url && depth < 3) {
      url = nested;
      nested = extractNestedUrl(url);
      depth++;
    }

    try {
      const parsed = new URL(url);
      const trackingParams = [
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "aff", "affiliate", "ref", "referer", "referrer", "subid", "click_id",
        "ad_id", "ad_track", "source", "fbclid", "gclid"
      ];
      let changed = false;
      trackingParams.forEach((tp) => {
        if (parsed.searchParams.has(tp)) {
          parsed.searchParams.delete(tp);
          changed = true;
        }
      });
      if (changed) {
        url = parsed.toString();
      }
    } catch {}

    return url;
  }

  // Extrait les liens de téléchargement hébergeurs et le poids du jeu depuis la page
  function extractPageDownloads(doc, rawHtml) {
    const downloadLinks = [];
    let pageGameSize = null;

    if (rawHtml) {
      const sizeMatch = rawHtml.match(/Size\s*:\s*([0-9.]+\s*(?:[KMGT]?B|Go|Mo|To))/i);
      if (sizeMatch) {
        pageGameSize = sizeMatch[1].trim();
      }
    }

    const processedKeys = new Set();
    const strongs = doc.querySelectorAll("div.post strong, .entry-content strong, #main-content strong, p strong, span strong, strong");

    strongs.forEach((st) => {
      const hostText = (st.textContent || "").replace(/\u00a0|&nbsp;/g, " ").trim();
      if (!hostText || hostText.length > 50) return;
      const lower = hostText.toLowerCase();
      if (
        lower.includes("support") ||
        lower.includes("buy it") ||
        lower.includes("about") ||
        lower.includes("trailer") ||
        lower.includes("screenshot") ||
        lower.includes("system requirement") ||
        lower.includes("configuration") ||
        lower.includes("note") ||
        lower.includes("install") ||
        lower.includes("nfo") ||
        lower.includes("release date") ||
        lower.includes("genre") ||
        lower.includes("title") ||
        lower.includes("enjoy") ||
        lower.includes("changelog")
      ) {
        return;
      }

      let p = st.closest("p") || st.parentElement;
      let linkEl = null;
      let fileName = "";

      // A. Dans le même paragraphe
      const aInP = p ? p.querySelectorAll("a[href]") : [];
      for (const a of aInP) {
        const h = a.getAttribute("href") || "";
        if (h && !h.includes("store.steampowered.com") && h !== "#" && !h.startsWith("javascript:")) {
          linkEl = a;
          break;
        }
      }

      // B. Dans les frères suivants
      let cur = p ? p.nextElementSibling : null;
      let depth = 0;
      while (cur && depth < 5) {
        if (cur.tagName === "P" && cur.querySelector("strong")) {
          break; // Début de l'hébergeur suivant
        }
        if (cur.tagName === "A" && cur.getAttribute("href")) {
          const h = cur.getAttribute("href") || "";
          if (h && !h.includes("store.steampowered.com") && h !== "#" && !h.startsWith("javascript:")) {
            linkEl = cur;
            const code = cur.querySelector(".codecolorer, .text, div");
            if (code && !fileName) fileName = code.textContent.trim();
            break;
          }
        }
        const aInside = cur.querySelectorAll ? cur.querySelectorAll("a[href]") : [];
        for (const a of aInside) {
          const h = a.getAttribute("href") || "";
          if (h && !h.includes("store.steampowered.com") && h !== "#" && !h.startsWith("javascript:")) {
            linkEl = a;
            const code = a.querySelector(".codecolorer, .text, div");
            if (code && !fileName) fileName = code.textContent.trim();
            break;
          }
        }
        if (linkEl) break;
        cur = cur.nextElementSibling;
        depth++;
      }

      if (linkEl) {
        const rawHref = linkEl.getAttribute("href") || "";
        if (!fileName) {
          const codeEl = linkEl.querySelector(".codecolorer, .text, div") || (p ? p.querySelector(".codecolorer") : null);
          fileName = codeEl ? codeEl.textContent.trim() : (linkEl.textContent || "").trim();
        }

        const isUploading = fileName.toLowerCase().includes("uploading") || (rawHref.includes("skidrowreloaded.com") && !rawHref.includes("/download/"));
        const cleanedUrl = isUploading ? null : cleanDownloadUrl(rawHref);
        const cleanKey = `${hostText}_${cleanedUrl || rawHref}_${fileName}`;
        if (!processedKeys.has(cleanKey)) {
          processedKeys.add(cleanKey);
          downloadLinks.push({
            host: hostText,
            url: cleanedUrl,
            rawUrl: rawHref,
            filename: fileName,
            isUploading,
          });
        }
      }
    });

    // Fallback regex sur le HTML brut
    if (downloadLinks.length === 0 && rawHtml) {
      const regex = /<p[^>]*>(?:<span[^>]*>)?\s*<strong>\s*([^<]+?)\s*<\/strong>\s*(?:<\/span>)?\s*(?:<br\s*\/?>)?\s*(?:<a[^>]*><\/a>)?\s*<\/p>\s*<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = regex.exec(rawHtml)) !== null) {
        const host = m[1].replace(/&nbsp;|\u00a0/g, " ").trim();
        const href = m[2].trim();
        const inner = m[3];
        const lower = host.toLowerCase();
        if (
          lower.includes("support") ||
          lower.includes("buy it") ||
          lower.includes("about") ||
          lower.includes("trailer") ||
          lower.includes("screenshot")
        ) {
          continue;
        }
        const codeMatch = inner.match(/<div class="[^"]*codecolorer[^"]*">([\s\S]*?)<\/div>/i);
        const textLabel = codeMatch ? codeMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        const isUploading = textLabel.toLowerCase().includes("uploading") || href.includes("skidrowreloaded.com");
        const cleanedUrl = isUploading ? null : cleanDownloadUrl(href);

        const cleanKey = `${host}_${cleanedUrl || href}`;
        if (!processedKeys.has(cleanKey)) {
          processedKeys.add(cleanKey);
          downloadLinks.push({
            host,
            url: cleanedUrl,
            rawUrl: href,
            filename: textLabel,
            isUploading,
          });
        }
      }
    }

    return { pageGameSize, downloadLinks };
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

  function searchSteamGame(title) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "SEARCH_STEAM_GAME", title },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response || null);
        }
      );
    });
  }

  const STEAM_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2a10 10 0 0 0-9.96 9.04l5.35 2.21a2.83 2.83 0 0 1 1.6-.5l.01 0 2.39-3.46v-.05a3.78 3.78 0 1 1 3.78 3.78h-.09l-3.4 2.43a2.84 2.84 0 0 1-5.65.31L1.7 13.6A10 10 0 1 0 12 2zm-4.99 15.17l-1.71-.71a2.12 2.12 0 0 0 3.82.8 2.13 2.13 0 0 0-1.01-2.84l1.77.73a1.56 1.56 0 1 1-2.87 2.02zM15.17 9.24a2.52 2.52 0 1 0-2.52 2.52 2.52 2.52 0 0 0 2.52-2.52zm-4.28 0a1.76 1.76 0 1 1 1.76 1.76 1.76 1.76 0 0 1-1.76-1.76z"/></svg>`;
  const GOG_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c4.78 0 8.78-3.37 9.77-7.85h-3.15c-.86 2.76-3.41 4.75-6.62 4.75-3.86 0-7-3.14-7-7s3.14-7 7-7c2.97 0 5.51 1.84 6.55 4.45h3.18C20.73 4.95 16.74 2 12 2zm1 6.5v3.5h7.5V8.5H13zm0 4.5v3.5h7.5V13H13z"/></svg>`;
  const EPIC_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3.5 2.5l8.5-2 8.5 2v14.5L12 23.5 3.5 17V2.5zm8.5 2.2L6 6.2v9l6 4.6 6-4.6v-9l-6-1.5zm-2 4.3h4v1.8h-2.2v1.4h2v1.8h-2v1.6h2.2v1.8H10V9z"/></svg>`;
  const ITCH_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 5h18v4l-2 3v7H5v-7L3 9V5zm4 9h3v2H7v-2zm7 0h3v2h-3v-2z"/></svg>`;
  const XBOX_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.8 3.5c1.2 1.4 2.2 3.1 2.8 4.9-1.9-.3-3.8-.2-5.5.3.7-2 1.7-3.8 2.7-5.2zm3.6 0c1 1.4 2 3.2 2.7 5.2-1.7-.5-3.6-.6-5.5-.3.6-1.8 1.6-3.5 2.8-4.9z"/></svg>`;
  const UBISOFT_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>`;
  const EA_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5h2v6h-2zm0 8h2v2h-2z"/></svg>`;

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

  // Hébergeurs favoris pour prioriser les liens de téléchargement
  let userFavoriteHosts = new Set();

  function loadFavoriteHosts() {
    chrome.storage.local.get(["favoriteHosts"], (res) => {
      if (Array.isArray(res.favoriteHosts)) {
        userFavoriteHosts = new Set(res.favoriteHosts.map((h) => String(h).toUpperCase().trim()));
      }
      updateAllDownloadsDropdowns();
    });
  }
  loadFavoriteHosts();

  function toggleFavoriteHost(hostName) {
    if (!hostName) return;
    const cleanHost = String(hostName).toUpperCase().trim();
    if (userFavoriteHosts.has(cleanHost)) {
      userFavoriteHosts.delete(cleanHost);
    } else {
      userFavoriteHosts.add(cleanHost);
    }
    chrome.storage.local.set({ favoriteHosts: Array.from(userFavoriteHosts) }, () => {
      updateAllDownloadsDropdowns();
    });
  }

  function updateAllDownloadsDropdowns() {
    document.querySelectorAll(".lgsp-card, .post, article").forEach((card) => {
      if (card._lgspDownloadLinks) {
        renderDownloadsDropdown(card, card._lgspDownloadLinks);
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.steamWishlist || changes.steamOwned) {
        loadUserSteamData();
      }
      if (changes.favoriteHosts) {
        loadFavoriteHosts();
      }
    }
  });

  // --- Détection Automatique du Matériel & Comparateur de Compatibilité -------

  let cachedUserHardware = null;

  function getUserHardware() {
    if (cachedUserHardware) return cachedUserHardware;

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

    cachedUserHardware = {
      gpu: cleanGpu || gpu,
      rawGpu: gpu,
      ram,
      cores,
    };

    return cachedUserHardware;
  }

  function getGpuScore(str) {
    if (!str) return 20;
    const s = str.toUpperCase();

    // 1. Puces graphiques intégrées Intel (Scores 6 - 28)
    if (s.includes("INTEL") || s.includes("HD GRAPHICS") || s.includes("UHD GRAPHICS") || s.includes("IRIS")) {
      if (s.includes("ARC A770") || s.includes("ARC A750")) return 74;
      if (s.includes("ARC A580") || s.includes("ARC A380")) return 50;
      if (s.includes("IRIS XE") || s.includes("IRIS PLUS")) return 28;
      if (s.includes("IRIS")) return 22;
      if (s.includes("UHD 770") || s.includes("UHD 750") || s.includes("UHD 730")) return 20;
      if (s.includes("UHD 630") || s.includes("UHD 620") || s.includes("UHD")) return 16;
      if (s.includes("HD 630") || s.includes("HD 620") || s.includes("HD 530") || s.includes("HD 520")) return 14;
      if (s.includes("HD 4600") || s.includes("HD 4400") || s.includes("HD 4000")) return 10;
      if (s.includes("HD 3000") || s.includes("HD 2500") || s.includes("HD 2000")) return 6;
      return 12; // Intel HD générique
    }

    // 2. NVIDIA RTX 40 / 50 Series
    if (s.includes("RTX 4090") || s.includes("RTX 5090") || s.includes("RTX 4080") || s.includes("RTX 5080")) return 120;
    if (s.includes("RTX 4070 TI") || s.includes("RTX 4070 SUPER") || s.includes("RTX 4070")) return 96;
    if (s.includes("RTX 4060 TI") || s.includes("RTX 4060")) return 84;

    // 3. NVIDIA RTX 30 Series
    if (s.includes("RTX 3090") || s.includes("RTX 3080 TI") || s.includes("RTX 3080")) return 100;
    if (s.includes("RTX 3070 TI") || s.includes("RTX 3070")) return 88;
    if (s.includes("RTX 3060 TI")) return 82;
    if (s.includes("RTX 3060")) return 76;
    if (s.includes("RTX 3050")) return 62;

    // 4. NVIDIA RTX 20 Series
    if (s.includes("RTX 2080 TI") || s.includes("RTX 2080 SUPER") || s.includes("RTX 2080")) return 86;
    if (s.includes("RTX 2070 SUPER") || s.includes("RTX 2070")) return 78;
    if (s.includes("RTX 2060 SUPER") || s.includes("RTX 2060")) return 70;

    // 5. NVIDIA GTX 16 Series
    if (s.includes("GTX 1660 TI") || s.includes("GTX 1660 SUPER")) return 64;
    if (s.includes("GTX 1660")) return 58;
    if (s.includes("GTX 1650 SUPER") || s.includes("GTX 1650 TI")) return 52;
    if (s.includes("GTX 1650")) return 46;

    // 6. NVIDIA GTX 10 Series
    if (s.includes("GTX 1080 TI") || s.includes("TITAN")) return 78;
    if (s.includes("GTX 1080")) return 72;
    if (s.includes("GTX 1070 TI") || s.includes("GTX 1070")) return 64;
    if (s.includes("GTX 1060")) return 56;
    if (s.includes("GTX 1050 TI")) return 42;
    if (s.includes("GTX 1050")) return 36;
    if (s.includes("GT 1030")) return 24;

    // 7. NVIDIA GTX 900 Series
    if (s.includes("GTX 980 TI") || s.includes("GTX 980")) return 58;
    if (s.includes("GTX 970")) return 50;
    if (s.includes("GTX 960")) return 40;
    if (s.includes("GTX 950")) return 34;

    // 8. NVIDIA GTX 700 Series / 600 Series / GT
    if (s.includes("GTX 780") || s.includes("GTX 770")) return 42;
    if (s.includes("GTX 760") || s.includes("GTX 680") || s.includes("GTX 670") || s.includes("GTX 660")) return 34;
    if (s.includes("GTX 750 TI")) return 30;
    if (s.includes("GTX 750") || s.includes("GTX 650")) return 26;
    if (s.includes("GT 730") || s.includes("GT 720") || s.includes("GT 710")) return 14;

    // 9. AMD Radeon RX 7000 / 6000 / 5000 Series
    if (s.includes("RX 7900") || s.includes("RX 7800")) return 100;
    if (s.includes("RX 7700") || s.includes("RX 7600") || s.includes("RX 6800") || s.includes("RX 6750") || s.includes("RX 6700")) return 88;
    if (s.includes("RX 6650") || s.includes("RX 6600")) return 76;
    if (s.includes("RX 6500") || s.includes("RX 6400")) return 48;
    if (s.includes("RX 5700")) return 74;
    if (s.includes("RX 5600")) return 68;
    if (s.includes("RX 5500")) return 52;

    // 10. AMD Radeon RX 500 / 400 / Vega / R9 / R7 Series
    if (s.includes("VEGA 64") || s.includes("VEGA 56") || s.includes("RADEON VII")) return 66;
    if (s.includes("RX 590") || s.includes("RX 580")) return 56;
    if (s.includes("RX 570") || s.includes("RX 480")) return 50;
    if (s.includes("RX 470") || s.includes("R9 390") || s.includes("R9 290")) return 46;
    if (s.includes("RX 560") || s.includes("RX 460") || s.includes("R9 380") || s.includes("R9 280")) return 38;
    if (s.includes("RX 550") || s.includes("R9 270") || s.includes("R7 370") || s.includes("R7 260")) return 32;

    // 11. Fallback regex intelligent pour séries non listées
    const rtxMatch = s.match(/RTX\s*(\d{4})/i);
    if (rtxMatch) {
      const n = parseInt(rtxMatch[1], 10);
      if (n >= 4000) return 90;
      if (n >= 3000) return 80;
      if (n >= 2000) return 72;
    }

    const gtxMatch = s.match(/GTX\s*(\d{3,4})/i);
    if (gtxMatch) {
      const n = parseInt(gtxMatch[1], 10);
      if (n >= 1660) return 60;
      if (n >= 1650) return 48;
      if (n >= 1080) return 72;
      if (n >= 1070) return 64;
      if (n >= 1060) return 56;
      if (n >= 1050) return 38;
      if (n >= 970) return 50;
      if (n >= 950) return 34;
      if (n >= 750) return 28;
      return 30;
    }

    const rxMatch = s.match(/RX\s*(\d{3,4})/i);
    if (rxMatch) {
      const n = parseInt(rxMatch[1], 10);
      if (n >= 7000) return 90;
      if (n >= 6000) return 80;
      if (n >= 5000) return 68;
      if (n >= 570) return 52;
      if (n >= 460) return 36;
      return 40;
    }

    const amdHdMatch = s.match(/(?:RADEON\s*)?HD\s*(\d{4})/i);
    if (amdHdMatch) {
      const n = parseInt(amdHdMatch[1], 10);
      if (n >= 7000) return 28;
      if (n >= 6000) return 24;
      if (n >= 5000) return 20;
      return 18;
    }

    if (s.includes("NVIDIA") || s.includes("GEFORCE") || s.includes("RADEON")) return 45;

    return 20;
  }

  function parseCpuCores(str) {
    if (!str) return { minCores: 2, raw: "" };
    const s = str.toLowerCase();

    let cores = 2;

    if (s.includes("octo") || s.includes("octa") || s.includes("huit cœur") || s.includes("8-core") || s.includes("8 core") || s.includes("i7") || s.includes("i9") || s.includes("ryzen 7") || s.includes("ryzen 9")) {
      cores = 8;
    } else if (s.includes("hexa") || s.includes("six cœur") || s.includes("6-core") || s.includes("6 core") || s.includes("ryzen 5") || s.includes("i5-1") || s.includes("i5 1")) {
      cores = 6;
    } else if (s.includes("quad") || s.includes("quatre cœur") || s.includes("quadri") || s.includes("4-core") || s.includes("4 core") || s.includes("i5") || s.includes("i3") || s.includes("ryzen 3")) {
      cores = 4;
    } else if (s.includes("double") || s.includes("dual") || s.includes("deux cœur") || s.includes("2-core") || s.includes("2 core")) {
      cores = 2;
    } else {
      const digitMatch = s.match(/(\d+)\s*(?:cœurs?|cores?)/i);
      if (digitMatch) {
        cores = parseInt(digitMatch[1], 10);
      }
    }

    return { minCores: cores, raw: str.trim() };
  }

  function parseGameRequirements(specs) {
    let minRamGB = null;
    let minGpuStr = "";
    let minCpuStr = "";

    (specs || []).forEach((item) => {
      const l = item.label.toLowerCase();
      const v = item.value;

      if (l.includes("mémoire") || l.includes("memory") || l.includes("ram")) {
        const m = v.match(/(\d+(?:\.\d+)?)\s*(GB|Go|MB|Mo)/i);
        if (m) {
          const val = parseFloat(m[1]);
          const unit = m[2].toUpperCase();
          minRamGB = (unit === "MB" || unit === "MO") ? Math.max(1, Math.round(val / 1024)) : val;
        }
      }

      if (l.includes("graphique") || l.includes("graphics") || l.includes("carte graphique") || l.includes("video")) {
        minGpuStr = v;
      }

      if (l.includes("processeur") || l.includes("processor") || l.includes("cpu")) {
        minCpuStr = v;
      }
    });

    const cpuInfo = parseCpuCores(minCpuStr);

    return {
      minRamGB: minRamGB ?? 4,
      minGpuStr,
      minCpuStr: minCpuStr || "Processeur double cœur standard",
      minCpuCores: cpuInfo.minCores,
    };
  }

  function evaluateCompatibility(userHardware, gameSpecs) {
    const { minRamGB, minGpuStr, minCpuStr, minCpuCores } = parseGameRequirements(gameSpecs);
    const userRam = userHardware.ram || 8;
    const userCores = userHardware.cores || 4;
    const userGpuScore = getGpuScore(userHardware.gpu);
    const gameGpuScore = getGpuScore(minGpuStr);

    const ramOk = userRam >= minRamGB;
    const ramClose = userRam >= minRamGB * 0.75;

    const gpuOk = userGpuScore >= gameGpuScore;
    const gpuClose = userGpuScore >= gameGpuScore * 0.8;

    const cpuOk = userCores >= minCpuCores;

    let status = "ok";
    let label = "PC Compatible";
    let icon = "✅";
    let summary = "Votre matériel respecte ou dépasse la configuration minimale requise.";

    const failedCount = (!ramOk ? 1 : 0) + (!gpuOk ? 1 : 0) + (!cpuOk ? 1 : 0);

    if (failedCount >= 2) {
      status = "fail";
      label = "Config Insuffisante";
      icon = "❌";
      summary = "Plusieurs composants de votre PC sont en-dessous de la configuration minimale requise.";
    } else if (failedCount === 1) {
      if ((!ramOk && ramClose) || (!gpuOk && gpuClose) || !cpuOk) {
        status = "warn";
        label = "Config Limite";
        icon = "⚠️";
        summary = "Votre matériel est proche du seuil minimal requis pour faire tourner le jeu.";
      } else {
        status = "fail";
        label = "Config Insuffisante";
        icon = "❌";
        summary = !gpuOk
          ? "Votre carte graphique est inférieure à la configuration minimale requise."
          : "Votre quantité de mémoire vive (RAM) est insuffisante pour ce jeu.";
      }
    }

    return {
      status,
      label,
      icon,
      summary,
      userGpu: userHardware.gpu,
      userRam: `${userRam} Go`,
      userCores: `${userCores} cœurs`,
      reqGpu: minGpuStr || "Non spécifié",
      reqRam: `${minRamGB} Go`,
      reqCpu: minCpuStr || `${minCpuCores} cœurs`,
      ramOk,
      gpuOk,
      cpuOk,
    };
  }

  // Construit le bandeau complet d'informations de la boutique (Steam, GOG, Epic, etc.)
  function renderSteamInfo(card, storeInfo, steamData) {
    let wrap = card.querySelector(".lgsp-steam-info");
    const storeObj = typeof storeInfo === "string"
      ? { platform: "steam", name: "Steam", storeUrl: storeInfo, svg: STEAM_SVG, btnClass: "lgsp-store-steam" }
      : storeInfo;

    const currentAppId = steamData?.appId || storeObj?.appId || null;

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

    // 1. Bouton Boutique officielle principale (Steam, GOG, Epic Games, Itch, Xbox, etc.)
    if (storeObj && storeObj.storeUrl) {
      const btn = document.createElement("a");
      btn.className = `lgsp-steam-btn ${storeObj.btnClass || "lgsp-store-default"}`;
      btn.href = storeObj.storeUrl;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";

      let svgIcon = storeObj.svg;
      if (!svgIcon) {
        if (storeObj.platform === "gog") svgIcon = GOG_SVG;
        else if (storeObj.platform === "epic") svgIcon = EPIC_SVG;
        else if (storeObj.platform === "itch") svgIcon = ITCH_SVG;
        else if (storeObj.platform === "xbox") svgIcon = XBOX_SVG;
        else if (storeObj.platform === "ubisoft") svgIcon = UBISOFT_SVG;
        else if (storeObj.platform === "ea") svgIcon = EA_SVG;
        else svgIcon = STEAM_SVG;
      }

      btn.innerHTML = `${svgIcon}<span>${storeObj.name || "Boutique"}</span>`;
      btn.addEventListener("click", (e) => e.stopPropagation());
      wrap.appendChild(btn);
    }

    // 1b. Si la boutique d'origine n'était pas Steam mais qu'on a trouvé le jeu sur Steam, on ajoute AUSSI le bouton Steam
    if (currentAppId && storeObj && storeObj.platform && storeObj.platform !== "steam") {
      const steamBtn = document.createElement("a");
      steamBtn.className = "lgsp-steam-btn lgsp-store-steam";
      steamBtn.href = `https://store.steampowered.com/app/${currentAppId}/`;
      steamBtn.target = "_blank";
      steamBtn.rel = "noopener noreferrer";
      steamBtn.innerHTML = `${STEAM_SVG}<span>Steam</span>`;
      steamBtn.title = "Voir également la fiche du jeu sur Steam";
      steamBtn.addEventListener("click", (e) => e.stopPropagation());
      wrap.appendChild(steamBtn);
    }

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

      // 6. Poids du jeu / Espace disque
      const storageVal = steamData.requirements?.storage || card._lgspGameSize;
      if (storageVal) {
        const storageBadge = document.createElement("span");
        storageBadge.className = "lgsp-steam-badge lgsp-storage-badge";
        storageBadge.innerHTML = `💾 ${storageVal}`;
        storageBadge.title = `Espace disque requis : ${storageVal}`;
        wrap.appendChild(storageBadge);
      }

      // 7. Configuration Minimale Requise (Volet Popover interactif)
      const minSpecs = steamData.requirements?.minimum?.specs;
      if (Array.isArray(minSpecs) && minSpecs.length > 0) {
        const reqContainer = document.createElement("div");
        reqContainer.className = "lgsp-sysreq-wrapper";

        const reqBtn = document.createElement("button");
        reqBtn.type = "button";
        reqBtn.className = "lgsp-steam-badge lgsp-sysreq-btn";
        reqBtn.innerHTML = `⚙️ Config Min. <span class="lgsp-sysreq-arrow">▼</span>`;

        const popover = document.createElement("div");
        popover.className = "lgsp-sysreq-popover lgsp-hidden";

        let specsHtml = "";
        minSpecs.forEach((s) => {
          specsHtml += `<div class="lgsp-sysreq-row"><span class="lgsp-sysreq-key">${s.label} :</span> <span class="lgsp-sysreq-val">${s.value}</span></div>`;
        });

        popover.innerHTML = `
          <div class="lgsp-sysreq-title">⚙️ Configuration Minimale Requise</div>
          <div class="lgsp-sysreq-content">${specsHtml}</div>
        `;

        let reqLeaveTimer = null;
        const openReqPopover = () => {
          if (reqLeaveTimer) { clearTimeout(reqLeaveTimer); reqLeaveTimer = null; }
          document.querySelectorAll(".lgsp-compat-popover").forEach((p) => p.classList.add("lgsp-hidden"));
          document.querySelectorAll(".lgsp-compat-btn").forEach((b) => b.classList.remove("lgsp-compat-active"));
          popover.classList.remove("lgsp-hidden");
          reqBtn.classList.add("lgsp-sysreq-active");
        };

        const closeReqPopover = () => {
          if (reqLeaveTimer) clearTimeout(reqLeaveTimer);
          reqLeaveTimer = setTimeout(() => {
            popover.classList.add("lgsp-hidden");
            reqBtn.classList.remove("lgsp-sysreq-active");
          }, 150);
        };

        reqContainer.addEventListener("mouseenter", openReqPopover);
        reqContainer.addEventListener("mouseleave", closeReqPopover);

        reqBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isClosed = popover.classList.contains("lgsp-hidden");
          if (isClosed) openReqPopover();
          else {
            popover.classList.add("lgsp-hidden");
            reqBtn.classList.remove("lgsp-sysreq-active");
          }
        });

        document.addEventListener("click", (e) => {
          if (!reqContainer.contains(e.target)) {
            popover.classList.add("lgsp-hidden");
            reqBtn.classList.remove("lgsp-sysreq-active");
          }
        });

        reqContainer.appendChild(reqBtn);
        reqContainer.appendChild(popover);
        wrap.appendChild(reqContainer);

        // 8. Comparateur automatique de compatibilité PC
        const userHw = getUserHardware();
        const compat = evaluateCompatibility(userHw, minSpecs);

        const compatContainer = document.createElement("div");
        compatContainer.className = "lgsp-compat-wrapper";

        const compatBtn = document.createElement("button");
        compatBtn.type = "button";
        compatBtn.className = `lgsp-steam-badge lgsp-compat-btn lgsp-compat-${compat.status}`;
        compatBtn.innerHTML = `${compat.icon} <span>${compat.label}</span> <span class="lgsp-compat-arrow">▼</span>`;

        const compatPopover = document.createElement("div");
        compatPopover.className = "lgsp-compat-popover lgsp-hidden";

        const checkIcon = `<span class="lgsp-check">${SVG_CHECK}</span>`;
        const crossIcon = `<span class="lgsp-cross">${SVG_CROSS}</span>`;

        compatPopover.innerHTML = `
          <div class="lgsp-compat-header">
            <div class="lgsp-compat-title">${compat.icon} Analyse de compatibilité PC</div>
            <div class="lgsp-compat-subtitle">${compat.summary}</div>
          </div>
          <div class="lgsp-compat-table">
            <div class="lgsp-compat-row">
              <div class="lgsp-compat-row-header">
                <span class="lgsp-compat-comp-name">🎮 Carte Graphique (GPU)</span>
                <span class="lgsp-compat-status-tag ${compat.gpuOk ? "lgsp-status-ok" : "lgsp-status-fail"}">
                  ${compat.gpuOk ? `${checkIcon} Compatible` : `${crossIcon} Inférieur`}
                </span>
              </div>
              <div class="lgsp-compat-details">
                <div><span class="lgsp-compat-dim">Votre PC :</span> <strong class="lgsp-compat-user-val">${compat.userGpu}</strong></div>
                <div><span class="lgsp-compat-dim">Requis :</span> <span class="lgsp-compat-req-val">${compat.reqGpu}</span></div>
              </div>
            </div>
            <div class="lgsp-compat-row">
              <div class="lgsp-compat-row-header">
                <span class="lgsp-compat-comp-name">⚡ Mémoire Vive (RAM)</span>
                <span class="lgsp-compat-status-tag ${compat.ramOk ? "lgsp-status-ok" : "lgsp-status-fail"}">
                  ${compat.ramOk ? `${checkIcon} Compatible` : `${crossIcon} Insuffisante`}
                </span>
              </div>
              <div class="lgsp-compat-details">
                <div><span class="lgsp-compat-dim">Votre PC :</span> <strong class="lgsp-compat-user-val">${compat.userRam}</strong></div>
                <div><span class="lgsp-compat-dim">Requis :</span> <span class="lgsp-compat-req-val">${compat.reqRam}</span></div>
              </div>
            </div>
            <div class="lgsp-compat-row">
              <div class="lgsp-compat-row-header">
                <span class="lgsp-compat-comp-name">🖥️ Processeur (CPU)</span>
                <span class="lgsp-compat-status-tag ${compat.cpuOk ? "lgsp-status-ok" : "lgsp-status-fail"}">
                  ${compat.cpuOk ? `${checkIcon} Compatible` : `${crossIcon} Limite`}
                </span>
              </div>
              <div class="lgsp-compat-details">
                <div><span class="lgsp-compat-dim">Votre PC :</span> <strong class="lgsp-compat-user-val">${compat.userCores}</strong></div>
                <div><span class="lgsp-compat-dim">Requis :</span> <span class="lgsp-compat-req-val">${compat.reqCpu}</span></div>
              </div>
            </div>
          </div>
        `;

        let compatLeaveTimer = null;
        const openCompatPopover = () => {
          if (compatLeaveTimer) { clearTimeout(compatLeaveTimer); compatLeaveTimer = null; }
          document.querySelectorAll(".lgsp-sysreq-popover").forEach((p) => p.classList.add("lgsp-hidden"));
          document.querySelectorAll(".lgsp-sysreq-btn").forEach((b) => b.classList.remove("lgsp-sysreq-active"));
          compatPopover.classList.remove("lgsp-hidden");
          compatBtn.classList.add("lgsp-compat-active");
        };

        const closeCompatPopover = () => {
          if (compatLeaveTimer) clearTimeout(compatLeaveTimer);
          compatLeaveTimer = setTimeout(() => {
            compatPopover.classList.add("lgsp-hidden");
            compatBtn.classList.remove("lgsp-compat-active");
          }, 150);
        };

        compatContainer.addEventListener("mouseenter", openCompatPopover);
        compatContainer.addEventListener("mouseleave", closeCompatPopover);

        compatBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isClosed = compatPopover.classList.contains("lgsp-hidden");
          if (isClosed) openCompatPopover();
          else {
            compatPopover.classList.add("lgsp-hidden");
            compatBtn.classList.remove("lgsp-compat-active");
          }
        });

        document.addEventListener("click", (e) => {
          if (!compatContainer.contains(e.target)) {
            compatPopover.classList.add("lgsp-hidden");
            compatBtn.classList.remove("lgsp-compat-active");
          }
        });

        compatContainer.appendChild(compatBtn);
        compatContainer.appendChild(compatPopover);
        wrap.appendChild(compatContainer);
      }

      // 9. Description courte du jeu (game_description_snippet)
      if (steamData.shortDescription) {
        const descEl = document.createElement("p");
        descEl.className = "lgsp-game-desc";
        descEl.textContent = steamData.shortDescription;
        wrap.appendChild(descEl);
      }
    } else if (card._lgspGameSize) {
      // Si Steam indisponible mais taille connue depuis la page Skidrow
      const storageBadge = document.createElement("span");
      storageBadge.className = "lgsp-steam-badge lgsp-storage-badge";
      storageBadge.innerHTML = `💾 ${card._lgspGameSize}`;
      storageBadge.title = `Taille du jeu : ${card._lgspGameSize}`;
      wrap.appendChild(storageBadge);
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

  const preloadedImagesCache = new Set();

  function preloadImage(url) {
    if (!url || typeof url !== "string" || preloadedImagesCache.has(url)) return;
    preloadedImagesCache.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    if (typeof img.decode === "function") {
      img.decode().catch(() => {});
    }
  }

  function preloadLightboxItems(items, currentIndex = 0) {
    if (!Array.isArray(items) || items.length === 0) return;
    const len = items.length;
    const sequence = [];
    for (let offset = 1; offset <= Math.min(len - 1, 6); offset++) {
      sequence.push((currentIndex + offset) % len);
      sequence.push((currentIndex - offset + len) % len);
    }
    for (let i = 0; i < len; i++) {
      if (!sequence.includes(i) && i !== currentIndex) {
        sequence.push(i);
      }
    }

    sequence.forEach((idx) => {
      const it = items[idx];
      if (!it) return;
      const src = typeof it === "string" ? it : (it.type === "image" ? it.src : it.thumbnail);
      if (src) preloadImage(src);
    });
  }

  function openLightbox(itemOrList, initialIndex = 0) {
    const items = Array.isArray(itemOrList) ? itemOrList : [itemOrList];
    let currentIndex = Math.max(0, Math.min(items.length - 1, initialIndex));

    preloadLightboxItems(items, currentIndex);

    const box = document.createElement("div");
    box.className = "lgsp-lightbox";

    const closeBtn = document.createElement("button");
    closeBtn.className = "lgsp-lightbox-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Fermer");
    box.appendChild(closeBtn);

    const prevBtn = document.createElement("button");
    prevBtn.className = "lgsp-lightbox-arrow lgsp-lightbox-prev";
    prevBtn.setAttribute("aria-label", "Précédent");
    prevBtn.innerHTML = `
      <span class="lgsp-lightbox-arrow-icon">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </span>
    `;

    const nextBtn = document.createElement("button");
    nextBtn.className = "lgsp-lightbox-arrow lgsp-lightbox-next";
    nextBtn.setAttribute("aria-label", "Suivant");
    nextBtn.innerHTML = `
      <span class="lgsp-lightbox-arrow-icon">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </span>
    `;

    const counter = document.createElement("div");
    counter.className = "lgsp-lightbox-counter";

    const container = document.createElement("div");
    container.className = "lgsp-lightbox-content";

    box.appendChild(prevBtn);
    box.appendChild(container);
    box.appendChild(nextBtn);
    box.appendChild(counter);

    function cleanupCurrentMedia() {
      const v = container.querySelector("video");
      if (v) {
        if (!v.muted) {
          saveNewVolume(v.volume);
        }
        if (v._hls) {
          v._hls.destroy();
        }
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
      container.innerHTML = "";
    }

    function renderCurrentItem() {
      cleanupCurrentMedia();
      const item = items[currentIndex];
      if (!item) return;

      preloadLightboxItems(items, currentIndex);

      if (items.length > 1) {
        prevBtn.classList.remove("lgsp-hidden");
        nextBtn.classList.remove("lgsp-hidden");
        counter.textContent = `${currentIndex + 1} / ${items.length}`;
        counter.classList.remove("lgsp-hidden");
      } else {
        prevBtn.classList.add("lgsp-hidden");
        nextBtn.classList.add("lgsp-hidden");
        counter.classList.add("lgsp-hidden");
      }

      if (typeof item === "string" || item.type === "image") {
        const src = typeof item === "string" ? item : item.src;
        const img = document.createElement("img");
        img.src = src;
        img.decoding = "async";
        img.alt = (typeof item === "object" && item.title) ? item.title : "Capture d'écran";
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

        // Spinner de chargement pour le Trailer dans la Lightbox
        const spinner = document.createElement("div");
        spinner.className = "lgsp-video-spinner";
        spinner.innerHTML = `<div class="lgsp-spinner-ring"></div>`;

        const hideSpinner = () => spinner.classList.add("lgsp-hidden");
        const showSpinner = () => spinner.classList.remove("lgsp-hidden");

        video.addEventListener("playing", hideSpinner);
        video.addEventListener("canplay", hideSpinner);
        video.addEventListener("timeupdate", () => {
          if (video.currentTime > 0) hideSpinner();
        });
        video.addEventListener("waiting", showSpinner);
        video.addEventListener("seeking", showSpinner);
        video.addEventListener("seeked", hideSpinner);
        video.addEventListener("error", hideSpinner);

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
        container.appendChild(spinner);
      }
    }

    function goToPrev() {
      if (items.length <= 1) return;
      currentIndex = (currentIndex - 1 + items.length) % items.length;
      renderCurrentItem();
    }

    function goToNext() {
      if (items.length <= 1) return;
      currentIndex = (currentIndex + 1) % items.length;
      renderCurrentItem();
    }

    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      goToPrev();
    });

    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      goToNext();
    });

    function close() {
      cleanupCurrentMedia();
      box.remove();
      document.removeEventListener("keydown", onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    }

    box.addEventListener("click", (e) => {
      if (e.target === box || e.target === closeBtn) close();
    });

    document.addEventListener("keydown", onKeyDown);
    renderCurrentItem();
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
    mediaItems.forEach((item, itemIdx) => {
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

            // Spinner de chargement dédié aux Trailers Steam
            const spinner = document.createElement("div");
            spinner.className = "lgsp-video-spinner";
            spinner.innerHTML = `<div class="lgsp-spinner-ring"></div>`;

            const hideSpinner = () => spinner.classList.add("lgsp-hidden");
            const showSpinner = () => spinner.classList.remove("lgsp-hidden");

            video.addEventListener("playing", hideSpinner);
            video.addEventListener("canplay", hideSpinner);
            video.addEventListener("timeupdate", () => {
              if (video.currentTime > 0) hideSpinner();
            });
            video.addEventListener("waiting", showSpinner);
            video.addEventListener("seeking", showSpinner);
            video.addEventListener("seeked", hideSpinner);
            video.addEventListener("error", hideSpinner);

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
            itemWrap.appendChild(spinner);
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
          openLightbox(mediaItems, itemIdx);
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
        // Préchargement immédiat de l'image haute définition au survol de la vignette
        itemWrap.addEventListener("mouseenter", () => {
          if (item.src) preloadImage(item.src);
          if (mediaItems[itemIdx + 1]?.src) preloadImage(mediaItems[itemIdx + 1].src);
          if (mediaItems[itemIdx - 1]?.src) preloadImage(mediaItems[itemIdx - 1].src);
        });

        // Clic gauche sur la vignette ouvre l'image en grand dans la Lightbox
        itemWrap.addEventListener("click", (e) => {
          if (e.button === 1 || e.which === 2) return;
          e.preventDefault();
          e.stopPropagation();
          openLightbox(mediaItems, itemIdx);
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
    prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    prevBtn.setAttribute("aria-label", "Précédent");

    const nextBtn = document.createElement("button");
    nextBtn.className = "lgsp-carousel-arrow lgsp-arrow-next lgsp-hidden";
    nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
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

  // --- Rendu de l'accordéon des liens de téléchargement avec flèche déroulante ---

  function renderDownloadsDropdown(card, downloadLinks) {
    const existingWrapper = card.querySelector(".lgsp-downloads-wrapper");
    const wasExpanded = existingWrapper?.querySelector(".lgsp-downloads-toggle")?.getAttribute("aria-expanded") === "true";

    if (existingWrapper) existingWrapper.remove();

    if (!Array.isArray(downloadLinks) || downloadLinks.length === 0) return;

    card._lgspDownloadLinks = downloadLinks;

    const isFav = (h) => userFavoriteHosts.has(String(h || "").toUpperCase().trim());

    // Tri prioritaire : Favoris en 1er, puis liens actifs, puis liens en cours d'upload
    const sortedLinks = [...downloadLinks].sort((a, b) => {
      const favA = isFav(a.host);
      const favB = isFav(b.host);
      if (favA && !favB) return -1;
      if (!favA && favB) return 1;
      if (!a.isUploading && b.isUploading) return -1;
      if (a.isUploading && !b.isUploading) return 1;
      return 0;
    });

    const availableLinks = sortedLinks.filter((l) => !l.isUploading);
    const availableCount = availableLinks.length;
    const totalCount = sortedLinks.length;

    const wrapper = document.createElement("div");
    wrapper.className = "lgsp-downloads-wrapper";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = `lgsp-downloads-toggle ${wasExpanded ? "lgsp-expanded" : ""}`;
    toggleBtn.setAttribute("aria-expanded", wasExpanded ? "true" : "false");

    const dlIconSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    const arrowSvg = `<svg class="lgsp-dl-arrow-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    toggleBtn.innerHTML = `
      <div class="lgsp-dl-toggle-left">
        <span class="lgsp-dl-toggle-icon">${dlIconSvg}</span>
        <span class="lgsp-dl-toggle-title">Liens de téléchargement</span>
        <span class="lgsp-dl-toggle-badge">${availableCount > 0 ? `${availableCount} dispo` : `${totalCount} liens`}</span>
      </div>
      <div class="lgsp-dl-toggle-right">
        <span class="lgsp-dl-toggle-arrow">${arrowSvg}</span>
      </div>
    `;

    const panel = document.createElement("div");
    panel.className = `lgsp-downloads-panel ${wasExpanded ? "" : "lgsp-hidden"}`;

    const grid = document.createElement("div");
    grid.className = "lgsp-downloads-grid";

    const getHostTheme = (host) => {
      const h = (host || "").toLowerCase();
      if (h.includes("mega")) return "lgsp-host-mega";
      if (h.includes("1fichier")) return "lgsp-host-1fichier";
      if (h.includes("pixeldrain")) return "lgsp-host-pixeldrain";
      if (h.includes("mediafire")) return "lgsp-host-mediafire";
      if (h.includes("gofile")) return "lgsp-host-gofile";
      if (h.includes("torrent")) return "lgsp-host-torrent";
      if (h.includes("buzzheavier")) return "lgsp-host-buzz";
      if (h.includes("datanodes")) return "lgsp-host-datanodes";
      if (h.includes("multi")) return "lgsp-host-multi";
      if (h.includes("rootz")) return "lgsp-host-rootz";
      if (h.includes("filemirage")) return "lgsp-host-mirage";
      if (h.includes("bowfile")) return "lgsp-host-bow";
      if (h.includes("sendcm") || h.includes("send.now")) return "lgsp-host-send";
      return "lgsp-host-default";
    };

    sortedLinks.forEach((dl) => {
      const themeClass = getHostTheme(dl.host);
      const isFavorite = isFav(dl.host);

      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = `lgsp-dl-fav-btn ${isFavorite ? "lgsp-is-fav" : ""}`;
      favBtn.innerHTML = isFavorite ? "★" : "☆";
      favBtn.title = isFavorite ? "Retirer des favoris (prioritaire)" : "Mettre en favori (apparaîtra en priorité)";
      favBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavoriteHost(dl.host);
      });

      if (!dl.isUploading && dl.url) {
        const item = document.createElement("a");
        item.className = `lgsp-dl-card ${themeClass} ${isFavorite ? "lgsp-dl-card-fav" : ""}`;
        item.href = dl.url;
        item.target = "_blank";
        item.rel = "noopener noreferrer";

        const header = document.createElement("div");
        header.className = "lgsp-dl-card-header";

        const hostGroup = document.createElement("div");
        hostGroup.className = "lgsp-dl-host-group";
        hostGroup.appendChild(favBtn);

        const hostPill = document.createElement("span");
        hostPill.className = "lgsp-dl-host-pill";
        hostPill.textContent = dl.host;
        hostGroup.appendChild(hostPill);

        const actionPill = document.createElement("span");
        actionPill.className = "lgsp-dl-action-pill";
        actionPill.innerHTML = `<span>Télécharger</span><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

        header.appendChild(hostGroup);
        header.appendChild(actionPill);
        item.appendChild(header);

        if (dl.filename) {
          const fn = document.createElement("div");
          fn.className = "lgsp-dl-filename";
          fn.title = dl.filename;
          fn.textContent = dl.filename;
          item.appendChild(fn);
        }

        item.addEventListener("click", (e) => e.stopPropagation());
        grid.appendChild(item);
      } else {
        const item = document.createElement("div");
        item.className = `lgsp-dl-card lgsp-dl-card-disabled ${themeClass} ${isFavorite ? "lgsp-dl-card-fav" : ""}`;

        const header = document.createElement("div");
        header.className = "lgsp-dl-card-header";

        const hostGroup = document.createElement("div");
        hostGroup.className = "lgsp-dl-host-group";
        hostGroup.appendChild(favBtn);

        const hostPill = document.createElement("span");
        hostPill.className = "lgsp-dl-host-pill";
        hostPill.textContent = dl.host;
        hostGroup.appendChild(hostPill);

        const statusEl = document.createElement("span");
        statusEl.className = "lgsp-dl-status-uploading";
        statusEl.textContent = "⏳ Upload en cours...";

        header.appendChild(hostGroup);
        header.appendChild(statusEl);
        item.appendChild(header);

        if (dl.filename) {
          const fn = document.createElement("div");
          fn.className = "lgsp-dl-filename";
          fn.title = dl.filename;
          fn.textContent = dl.filename;
          item.appendChild(fn);
        }

        grid.appendChild(item);
      }
    });

    panel.appendChild(grid);

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
      toggleBtn.setAttribute("aria-expanded", String(!isExpanded));
      toggleBtn.classList.toggle("lgsp-expanded", !isExpanded);
      panel.classList.toggle("lgsp-hidden", isExpanded);
    });

    wrapper.appendChild(toggleBtn);
    wrapper.appendChild(panel);

    card.appendChild(wrapper);
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
      let downloadLinks = [];
      let pageGameSize = null;

      if (cached) {
        pageScreenshots = cached.pageScreenshots;
        pageVideos = cached.pageVideos;
        steamInfo = cached.steamInfo;
        downloadLinks = cached.downloadLinks || [];
        pageGameSize = cached.pageGameSize || null;
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

        const pageDlData = extractPageDownloads(doc, html);
        downloadLinks = pageDlData.downloadLinks;
        pageGameSize = pageDlData.pageGameSize;

        detailCache.set(link, { pageScreenshots, pageVideos, steamInfo, downloadLinks, pageGameSize });
      }

      if (pageGameSize) {
        card._lgspGameSize = pageGameSize;
      }

      // Si aucun appId direct n'a été trouvé (ex: jeu GOG, Epic ou sans lien Steam), on recherche sur Steam avec le titre
      if (!steamInfo || !steamInfo.appId) {
        const titleEl = card.querySelector(titleSel);
        const rawTitle = titleEl ? titleEl.textContent : "";
        if (rawTitle) {
          const searchRes = await searchSteamGame(rawTitle);
          if (searchRes && searchRes.appId) {
            if (steamInfo) {
              steamInfo.appId = searchRes.appId;
            } else {
              steamInfo = {
                platform: "steam",
                name: "Steam",
                storeUrl: `https://store.steampowered.com/app/${searchRes.appId}/`,
                steamUrl: `https://store.steampowered.com/app/${searchRes.appId}/`,
                appId: searchRes.appId,
                btnClass: "lgsp-store-steam",
              };
            }
          }
        }
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

      if (steamInfo && (steamInfo.storeUrl || steamInfo.steamUrl)) {
        renderSteamInfo(card, steamInfo, steamData);
      } else if (pageGameSize) {
        renderSteamInfo(card, null, null);
      }

      // Rendu du menu déroulant des liens de téléchargement
      if (Array.isArray(downloadLinks) && downloadLinks.length > 0) {
        renderDownloadsDropdown(card, downloadLinks);
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

  function cleanPostMeta(card) {
    const meta = card.querySelector(".meta:not(.right), .meta");
    if (!meta) return;
    const text = (meta.textContent || "").trim();
    // Ne garder que la date (ex: "Posted August 22, 2026")
    const match = text.match(/(Posted\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (match && match[1]) {
      meta.textContent = match[1].trim();
    } else {
      const parts = text.split(/\s+in\s+/i);
      if (parts[0]) {
        meta.textContent = parts[0].trim();
      }
    }
  }

  function enhanceCard(card) {
    extractAndCleanCover(card);
    cleanPostMeta(card);
    removeFooterMeta(card);
  }

  function scanForCards() {
    neutralizeAnnoyingPopups();
    adjustSkidrowElements();
    if (lastSettings) enforceMaxWidth(lastSettings);
    const currentPageNum = getPageNumFromUrl(location.href);
    document.querySelectorAll(".wp-pagenavi, ul.uk-pagination").forEach((p) => {
      formatPagenavi(p);
    });
    document.querySelectorAll(`${cardSel}`).forEach((card) => {
      if (!card.hasAttribute("data-lgsp-page")) {
        card.setAttribute("data-lgsp-page", `${currentPageNum}`);
      }
      if (!card.hasAttribute(PROCESSED_ATTR)) {
        enforceSingleColumnLayout(card);
        if (config.enhanceCard) enhanceCard(card);
        observer.observe(card);
      }
    });
  }

  // --- Système de Défilement Infini (Infinite Scroll) & Navigation Dynamique (SPA) ---

  let nextScrollPageUrl = null;
  let isLoadingNextPage = false;
  let hasMorePages = true;
  let infiniteScrollObserver = null;
  let infiniteLoaderEl = null;
  let infiniteSentinelEl = null;
  let userHasScrolled = false;
  let scrollSpyTimer = null;

  window.addEventListener(
    "scroll",
    () => {
      if (window.scrollY > 40) {
        userHasScrolled = true;
      }
      if (!scrollSpyTimer) {
        scrollSpyTimer = requestAnimationFrame(() => {
          scrollSpyTimer = null;
          updateActivePageFromScroll();
        });
      }
    },
    { passive: true }
  );

  function extractPageLabel(url) {
    try {
      const u = new URL(url, location.origin);
      const pathMatch = u.pathname.match(/\/page\/(\d+)/i);
      const pagedParam = u.searchParams.get("paged") || u.searchParams.get("page");
      const pageNum = pathMatch ? pathMatch[1] : pagedParam;
      const searchParam = u.searchParams.get("s");
      if (searchParam && pageNum) {
        return `Recherche "${searchParam}" — Page ${pageNum}`;
      }
      if (pageNum) {
        return `Page ${pageNum}`;
      }
    } catch (_) {}
    return "Page suivante";
  }

  function getNextPageUrl(doc = document) {
    // 1. WP-PageNavi (SkidrowReloaded & WordPress)
    const pagenavi = doc.querySelector(".wp-pagenavi");
    if (pagenavi) {
      // Lien nextpostslink explicite
      const nextLink = pagenavi.querySelector("a.nextpostslink");
      if (nextLink && nextLink.href) return nextLink.href;

      // Lien immédiatement après le span.current
      const current = pagenavi.querySelector("span.current");
      if (current) {
        let nextElem = current.nextElementSibling;
        while (nextElem) {
          if (nextElem.tagName === "A" && nextElem.href && !nextElem.classList.contains("last")) {
            return nextElem.href;
          }
          nextElem = nextElem.nextElementSibling;
        }
      }

      // Lien avec flèche »
      const arrowLink = Array.from(pagenavi.querySelectorAll("a")).find((a) =>
        a.textContent.includes("»") || (a.title && a.title.toLowerCase().includes("next"))
      );
      if (arrowLink && arrowLink.href) return arrowLink.href;
    }

    // 2. UIKit Pagination (PCGamesTorrents & IGG-Games)
    const ukPagination = doc.querySelector("ul.uk-pagination, .uk-pagination");
    if (ukPagination) {
      const activeLi = ukPagination.querySelector("li.uk-active");
      if (activeLi) {
        let nextLi = activeLi.nextElementSibling;
        while (nextLi) {
          const a = nextLi.querySelector("a");
          if (a && a.href && !nextLi.classList.contains("uk-disabled")) {
            return a.href;
          }
          nextLi = nextLi.nextElementSibling;
        }
      }
      const nextA = ukPagination.querySelector("li > a[rel='next'], a.next");
      if (nextA && nextA.href) return nextA.href;
    }

    // 3. Navigation générique WordPress
    const genericNext = doc.querySelector("a[rel='next'], .nav-previous a, .nav-links a.next, .pagination a.next");
    if (genericNext && genericNext.href) return genericNext.href;

    return null;
  }

  function buildPageUrl(pageNum) {
    const currentUrl = new URL(location.href);
    const num = Math.max(1, parseInt(pageNum, 10));
    // S'il y a déjà /page/N/, on le remplace
    if (/\/page\/\d+\/?/i.test(currentUrl.pathname)) {
      currentUrl.pathname = currentUrl.pathname.replace(/\/page\/\d+\/?/i, `/page/${num}/`);
    } else {
      // Sinon on ajoute /page/N/ avant la fin ou le query
      currentUrl.pathname = currentUrl.pathname.replace(/\/?$/, `/page/${num}/`);
    }
    return currentUrl.href;
  }

  function getPageNumFromUrl(url) {
    try {
      const u = new URL(url || location.href, location.origin);
      const m = u.pathname.match(/\/page\/(\d+)/i);
      if (m && m[1]) return parseInt(m[1], 10);
      const paged = u.searchParams.get("paged") || u.searchParams.get("page");
      if (paged) return parseInt(paged, 10);
    } catch {}
    return 1;
  }

  function formatPagenavi(pagenavi) {
    if (!pagenavi || pagenavi.hasAttribute("data-lgsp-formatted")) return;
    pagenavi.setAttribute("data-lgsp-formatted", "1");

    // 1. Détection et mémorisation du nombre total de pages
    let maxPages = 9999;
    const pagesSpan = pagenavi.querySelector("span.pages");
    if (pagesSpan) {
      const match = (pagesSpan.textContent || "").match(/of\s+([0-9,]+)/i);
      if (match && match[1]) {
        maxPages = parseInt(match[1].replace(/,/g, ""), 10) || 9999;
      }
    } else {
      const lastA = pagenavi.querySelector("a.last");
      if (lastA && lastA.href) {
        const match = lastA.href.match(/\/page\/(\d+)/i);
        if (match && match[1]) {
          maxPages = parseInt(match[1], 10) || 9999;
        }
      }
    }
    pagenavi.setAttribute("data-max-pages", `${maxPages}`);

    // 2. Formater le compteur en haut (Page X of Y)
    const initialPage = getPageNumFromUrl(location.href);
    if (pagesSpan) {
      pagesSpan.innerHTML = `<strong>${initialPage}</strong><small>/ ${maxPages.toLocaleString()}</small>`;
    }

    // 3. Formulaire de saut direct
    renderPageJumpInput(pagenavi);

    // 4. Générer immédiatement la liste propre des boutons (élimine immédiatement 10, 20, 30, «, », etc.)
    regeneratePagenaviRange(pagenavi, initialPage);
  }

  function setActivePageInPagenavi(pageNum) {
    const pagenavi = document.querySelector(".wp-pagenavi");
    if (!pagenavi) return;

    const maxPages = parseInt(pagenavi.getAttribute("data-max-pages"), 10) || 9999;

    // 1. Mettre à jour le compteur en haut (Page X of Y)
    const pagesSpan = pagenavi.querySelector("span.pages");
    if (pagesSpan) {
      pagesSpan.innerHTML = `<strong>${pageNum}</strong><small>/ ${maxPages.toLocaleString()}</small>`;
    }

    // 2. Mettre à jour l'élément actif 'current' parmi les boutons de page
    let foundTarget = false;
    pagenavi.querySelectorAll("a.page, a, span.current").forEach((el) => {
      if (el.classList.contains("pages") || el.closest(".lgsp-pagenavi-jump")) return;
      const text = (el.textContent || "").trim();
      const val = parseInt(text, 10);
      if (val === pageNum) {
        foundTarget = true;
        if (el.tagName === "A") {
          const span = document.createElement("span");
          span.className = "current";
          span.textContent = `${pageNum}`;
          el.replaceWith(span);
        }
      } else if (el.classList.contains("current")) {
        const a = document.createElement("a");
        a.className = "page";
        a.href = buildPageUrl(val || text);
        a.textContent = text;
        el.replaceWith(a);
      }
    });

    // Si la page active n'est pas dans la liste actuelle des boutons affichés, on régénère la plage
    if (!foundTarget) {
      regeneratePagenaviRange(pagenavi, pageNum);
    }
  }

  function regeneratePagenaviRange(pagenavi, activePage) {
    const maxPages = parseInt(pagenavi.getAttribute("data-max-pages"), 10) || 9999;
    let start = Math.max(1, activePage - 2);
    let end = Math.min(maxPages, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    pagenavi.querySelectorAll("a, span").forEach((el) => {
      if (el.classList.contains("pages") || el.classList.contains("lgsp-pagenavi-jump") || el.closest(".lgsp-pagenavi-jump")) return;
      el.remove();
    });

    const jumpForm = pagenavi.querySelector(".lgsp-pagenavi-jump");

    for (let p = start; p <= end; p++) {
      if (p === activePage) {
        const span = document.createElement("span");
        span.className = "current";
        span.textContent = `${p}`;
        if (jumpForm) pagenavi.insertBefore(span, jumpForm);
        else pagenavi.appendChild(span);
      } else {
        const a = document.createElement("a");
        a.className = "page";
        a.href = buildPageUrl(p);
        a.textContent = `${p}`;
        if (jumpForm) pagenavi.insertBefore(a, jumpForm);
        else pagenavi.appendChild(a);
      }
    }
  }

  let currentActiveScrollPage = getPageNumFromUrl(location.href);

  function updateActivePageFromScroll() {
    const cards = document.querySelectorAll(`${cardSel}[data-lgsp-page]`);
    if (!cards.length) return;

    const targetY = window.innerHeight * 0.35;
    let visiblePage = currentActiveScrollPage;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.top <= targetY && rect.bottom >= targetY) {
        const p = parseInt(card.getAttribute("data-lgsp-page"), 10);
        if (!isNaN(p) && p >= 1) {
          visiblePage = p;
          break;
        }
      } else if (rect.top > targetY) {
        const p = parseInt(card.getAttribute("data-lgsp-page"), 10);
        if (!isNaN(p) && p >= 1 && visiblePage === currentActiveScrollPage) {
          visiblePage = p;
        }
        break;
      }
    }

    if (visiblePage !== currentActiveScrollPage) {
      currentActiveScrollPage = visiblePage;
      setActivePageInPagenavi(visiblePage);
      try {
        window.history.replaceState(null, "", buildPageUrl(visiblePage));
      } catch (_) {}
    }
  }

  function renderPageJumpInput(pagenavi) {
    if (!pagenavi) return;
    if (pagenavi.querySelector(".lgsp-pagenavi-jump")) return;

    // Détection du nombre max de pages depuis span.pages ou a.last
    let maxPages = 9999;
    const pagesSpan = pagenavi.querySelector("span.pages");
    if (pagesSpan) {
      const match = (pagesSpan.textContent || "").match(/of\s+([0-9,]+)/i);
      if (match && match[1]) {
        maxPages = parseInt(match[1].replace(/,/g, ""), 10) || 9999;
      }
    } else {
      const lastA = pagenavi.querySelector("a.last");
      if (lastA && lastA.href) {
        const match = lastA.href.match(/\/page\/(\d+)/i);
        if (match && match[1]) {
          maxPages = parseInt(match[1], 10) || 9999;
        }
      }
    }

    const form = document.createElement("form");
    form.className = "lgsp-pagenavi-jump";
    form.title = `Aller à une page (1 à ${maxPages})`;
    form.innerHTML = `
      <input type="number" min="1" max="${maxPages}" placeholder="N°" class="lgsp-pagenavi-input" aria-label="Numéro de page">
      <button type="submit" class="lgsp-pagenavi-submit" title="Aller à cette page">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    `;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = form.querySelector(".lgsp-pagenavi-input");
      const val = parseInt(input ? input.value : "", 10);
      if (!isNaN(val) && val >= 1) {
        const targetUrl = buildPageUrl(val);
        navigateToUrl(targetUrl);
      }
    });

    pagenavi.appendChild(form);
  }

  document.addEventListener(
    "click",
    (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = e.target.closest(".wp-pagenavi a, ul.uk-pagination a, .navigation a, a.page, a.last, a.first, a.nextpostslink, a.previouspostslink");
      if (!link) return;
      const targetHref = link.getAttribute("href") || link.href;
      if (targetHref && !targetHref.startsWith("#") && !targetHref.startsWith("javascript:")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const fullUrl = new URL(targetHref, location.href).href;
        navigateToUrl(fullUrl);
      }
    },
    true
  );

  async function navigateToUrl(targetUrl) {
    if (isLoadingNextPage) return;
    isLoadingNextPage = true;
    userHasScrolled = false;

    showPageLoader();

    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        location.href = targetUrl;
        return;
      }

      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const newCards = Array.from(doc.querySelectorAll(cardSel));
      const mainContainer = document.querySelector(config.mainSelector) || document.body;

      if (mainContainer) {
        // 1. Supprimer toutes les anciennes cartes et séparateurs affichés
        mainContainer.querySelectorAll(`${cardSel}, .lgsp-page-separator`).forEach((c) => c.remove());

        // 2. Insérer les nouvelles cartes issues du HTML chargé
        if (infiniteSentinelEl && infiniteSentinelEl.parentNode === mainContainer) {
          newCards.forEach((card) => {
            const importedCard = document.importNode(card, true);
            mainContainer.insertBefore(importedCard, infiniteSentinelEl);
          });
        } else {
          newCards.forEach((card) => {
            const importedCard = document.importNode(card, true);
            mainContainer.appendChild(importedCard);
          });
        }
      }

      // 3. Mettre à jour la pagination à partir de la nouvelle page chargée
      currentActiveScrollPage = getPageNumFromUrl(targetUrl);
      const newPagenavi = doc.querySelector(".wp-pagenavi, ul.uk-pagination");
      const currentPagenavis = document.querySelectorAll(".wp-pagenavi, ul.uk-pagination");
      if (newPagenavi) {
        currentPagenavis.forEach((cp) => {
          cp.removeAttribute("data-lgsp-formatted");
          cp.innerHTML = newPagenavi.innerHTML;
          formatPagenavi(cp);
        });
      }

      // 4. IMPORTANT : Extraire la page suivante DE CETTE NOUVELLE PAGE
      nextScrollPageUrl = getNextPageUrl(doc);
      hasMorePages = Boolean(nextScrollPageUrl);

      // 5. Réinitialiser la sentinelle de scroll infini
      if (infiniteScrollObserver && infiniteSentinelEl) {
        infiniteScrollObserver.unobserve(infiniteSentinelEl);
        infiniteScrollObserver.observe(infiniteSentinelEl);
      }

      // 6. Mettre à jour l'URL dans la barre d'adresse et l'historique
      try {
        window.history.pushState({ url: targetUrl }, "", targetUrl);
      } catch (_) {}

      // 7. Mettre à jour le champ de recherche si la navigation provient d'une recherche
      try {
        const urlObj = new URL(targetUrl, location.origin);
        const searchQuery = urlObj.searchParams.get("s");
        const searchInput = document.querySelector("#searchbar");
        const clearBtn = document.querySelector("#lgsp-search-clear-btn");
        if (searchInput) {
          searchInput.value = searchQuery !== null ? searchQuery : "";
          if (clearBtn) {
            clearBtn.classList.toggle("lgsp-visible", Boolean(searchInput.value.trim()));
          }
        }
      } catch (_) {}

      // 8. Remonter doucement vers le haut de la liste
      window.scrollTo({ top: 0, behavior: "smooth" });

      // 9. Traiter et enrichir les nouvelles cartes (captures, Steam, etc.)
      scanForCards();
    } catch (err) {
      console.warn("[Game Sites Screenshots] Erreur de navigation SPA :", err);
      location.href = targetUrl;
    } finally {
      isLoadingNextPage = false;
      requestAnimationFrame(() => {
        hidePageLoader();
      });
    }
  }

  async function loadNextPage() {
    if (isLoadingNextPage || !hasMorePages || !nextScrollPageUrl) return;

    // Empêcher tout déclenchement prématuré avant le premier scroll effectif de l'utilisateur
    if (!userHasScrolled && window.scrollY < 40) return;
    if (document.documentElement.scrollHeight <= window.innerHeight + 100) return;

    isLoadingNextPage = true;

    if (infiniteLoaderEl) {
      infiniteLoaderEl.classList.remove("lgsp-hidden");
    }

    try {
      const targetUrl = nextScrollPageUrl;
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const newCards = Array.from(doc.querySelectorAll(cardSel));
      if (!newCards.length) {
        hasMorePages = false;
        if (infiniteLoaderEl) infiniteLoaderEl.remove();
        return;
      }

      // Recherche de l'URL de la page suivante pour le coup d'après
      nextScrollPageUrl = getNextPageUrl(doc);
      if (!nextScrollPageUrl || nextScrollPageUrl === targetUrl) {
        hasMorePages = false;
      }

      // Création du séparateur visuel de section de page
      const pageLabel = extractPageLabel(targetUrl);
      const separator = document.createElement("div");
      separator.className = "lgsp-page-separator";
      separator.innerHTML = `
        <div class="lgsp-page-separator-line"></div>
        <div class="lgsp-page-separator-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>${pageLabel}</span>
        </div>
        <div class="lgsp-page-separator-line"></div>
      `;

      // Insertion du séparateur et des nouvelles cartes avant la sentinelle
      const targetPageNum = getPageNumFromUrl(targetUrl);
      separator.setAttribute("data-lgsp-page", `${targetPageNum}`);

      const mainContainer = document.querySelector(config.mainSelector) || (infiniteSentinelEl ? infiniteSentinelEl.parentElement : document.body);
      if (mainContainer) {
        if (infiniteSentinelEl && infiniteSentinelEl.parentNode === mainContainer) {
          mainContainer.insertBefore(separator, infiniteSentinelEl);
          newCards.forEach((card) => {
            const importedCard = document.importNode(card, true);
            importedCard.setAttribute("data-lgsp-page", `${targetPageNum}`);
            mainContainer.insertBefore(importedCard, infiniteSentinelEl);
          });
        } else {
          mainContainer.appendChild(separator);
          newCards.forEach((card) => {
            const importedCard = document.importNode(card, true);
            importedCard.setAttribute("data-lgsp-page", `${targetPageNum}`);
            mainContainer.appendChild(importedCard);
          });
        }
      }

      // Scanner et enrichir les nouvelles cartes
      scanForCards();
      updateActivePageFromScroll();
    } catch (err) {
      console.warn("[Game Sites Screenshots] Erreur chargement page suivante :", err);
    } finally {
      if (infiniteLoaderEl) {
        infiniteLoaderEl.classList.add("lgsp-hidden");
      }
      isLoadingNextPage = false;
    }
  }

  function setupInfiniteScroll() {
    nextScrollPageUrl = getNextPageUrl(document);
    if (!nextScrollPageUrl) return;

    const mainContainer = document.querySelector(config.mainSelector);
    if (!mainContainer) return;

    if (!infiniteSentinelEl) {
      infiniteSentinelEl = document.createElement("div");
      infiniteSentinelEl.id = "lgsp-infinite-scroll-sentinel";
    }

    if (!infiniteLoaderEl) {
      infiniteLoaderEl = document.createElement("div");
      infiniteLoaderEl.id = "lgsp-infinite-scroll-loader";
      infiniteLoaderEl.className = "lgsp-hidden";
      infiniteLoaderEl.innerHTML = `
        <div class="lgsp-infinite-spinner"></div>
        <span class="lgsp-infinite-text">Chargement des jeux suivants...</span>
      `;
    }

    // Insérer la sentinelle et le loader à la fin du main
    if (!infiniteSentinelEl.parentElement) {
      mainContainer.appendChild(infiniteSentinelEl);
    }
    if (!infiniteLoaderEl.parentElement) {
      mainContainer.appendChild(infiniteLoaderEl);
    }

    if (infiniteScrollObserver) {
      infiniteScrollObserver.disconnect();
    }

    infiniteScrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadNextPage();
          }
        });
      },
      { rootMargin: "600px" }
    );

    infiniteScrollObserver.observe(infiniteSentinelEl);
  }

  window.addEventListener("popstate", () => {
    if (location.href) {
      navigateToUrl(location.href);
    }
  });

  function init() {
    if (lastSettings) {
      applySettings(lastSettings);
    } else {
      chrome.storage.local.get(defaultsWithPrefix(), (settings) =>
        applySettings(normalizeSettings(settings))
      );
    }

    scanForCards();
    setupInfiniteScroll();

    if (document.body) {
      let scanScheduled = false;
      const mutationObserver = new MutationObserver((mutations) => {
        let hasNewCards = false;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.id === "lgsp-page-loader" || node.id === "lgsp-infinite-scroll-sentinel" || node.id === "lgsp-infinite-scroll-loader") {
                continue;
              }
              if (node.matches && (node.matches(cardSel) || node.querySelector(cardSel))) {
                hasNewCards = true;
                break;
              }
            }
          }
          if (hasNewCards) break;
        }
        if (hasNewCards && !scanScheduled) {
          scanScheduled = true;
          requestAnimationFrame(() => {
            scanScheduled = false;
            scanForCards();
          });
        }
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // Écoute en direct des changements de réglages depuis la popup
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      chrome.storage.local.get(defaultsWithPrefix(), (settings) => {
        applySettings(normalizeSettings(settings));
      });
    });

    // Lever l'écran de chargement dès que la structure initiale est prête
    requestAnimationFrame(() => {
      if (lastSettings) applySettings(lastSettings);
      hidePageLoader();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();