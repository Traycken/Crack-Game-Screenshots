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

  // SkidrowReloaded : activation sur les pages de liste uniquement
  if (config.layout === "sidebar-flex") {
    const path = location.pathname;
    const isListingPage =
      path === "/" ||
      /^\/page\/\d+\/?$/.test(path) ||
      path.startsWith("/category/");
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

    const wrap = document.querySelector(config.wrapSelector);
    const main = document.querySelector(config.mainSelector);
    const sidebar = config.sidebarSelector ? document.querySelector(config.sidebarSelector) : null;
    if (!wrap || !main) return;

    wrap.style.setProperty("max-width", widthValue, "important");
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("margin-left", "auto", "important");
    wrap.style.setProperty("margin-right", "auto", "important");
    wrap.style.setProperty("display", "flex", "important");
    wrap.style.setProperty("align-items", "flex-start", "important");
    wrap.style.setProperty("gap", "24px", "important");
    wrap.style.setProperty("box-sizing", "border-box", "important");

    main.style.setProperty("float", "none", "important");
    main.style.setProperty("width", "auto", "important");
    main.style.setProperty("max-width", "none", "important");
    main.style.setProperty("flex", "1 1 0", "important");
    main.style.setProperty("min-width", "0", "important");
    main.style.setProperty("box-sizing", "border-box", "important");

    if (sidebar) {
      sidebar.style.setProperty("float", "none", "important");
      sidebar.style.setProperty("flex", "0 0 280px", "important");
      sidebar.style.setProperty("width", "280px", "important");
      sidebar.style.setProperty("box-sizing", "border-box", "important");
    }
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
            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`,
            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            title: "Bande-annonce YouTube",
          });
        }
      }
    });
    return videos;
  }

  // --- Steam : extraction d'URL et interrogation de l'API enrichie -----------

  const STEAM_APP_RE = /https:\/\/store\.steampowered\.com\/app\/(\d+)/;

  function extractSteamInfo(doc) {
    const links = doc.querySelectorAll('a[href*="store.steampowered.com/app/"]');
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const m = href.match(STEAM_APP_RE);
      if (m) return { steamUrl: href, appId: m[1] };
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

  // Construit le bandeau complet d'informations Steam
  function renderSteamInfo(card, steamUrl, steamData) {
    if (card.querySelector(".lgsp-steam-info")) return;

    const wrap = document.createElement("div");
    wrap.className = "lgsp-steam-info";

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
        revBadge.innerHTML = `${icon} ${rev.desc} (${rev.percent}%)`;
        revBadge.title = `${rev.totalPositive.toLocaleString()} avis positifs sur ${rev.total.toLocaleString()} (${rev.percent}%)`;
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

      // 4. Modes de jeu (Solo, Multijoueur, Coop, MMO)
      if (Array.isArray(steamData.modes) && steamData.modes.length > 0) {
        const modeIcons = {
          Solo: "🎮",
          Multijoueur: "👥",
          Coop: "🤝",
          MMO: "🌐",
        };
        steamData.modes.forEach((mode) => {
          const modeBadge = document.createElement("span");
          modeBadge.className = "lgsp-steam-badge lgsp-mode-badge";
          modeBadge.textContent = `${modeIcons[mode] || "🕹️"} ${mode}`;
          if (steamData.modeDetails) {
            modeBadge.title = steamData.modeDetails;
          }
          wrap.appendChild(modeBadge);
        });
      }

      // 5. Badge Langue Français détaillé (3 éléments : Interface, Audio, Sous-titres)
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
      iframe.src = item.embedUrl;
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "true");
      iframe.className = "lgsp-lightbox-video";
      container.appendChild(iframe);
    } else if (item.type === "steam_movie") {
      const video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.className = "lgsp-lightbox-video";
      attachVideoSource(video, item);
      container.appendChild(video);
    }

    box.appendChild(container);

    function close() {
      const v = container.querySelector("video");
      if (v && v._hls) {
        v._hls.destroy();
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

        const startPreview = () => {
          if (isPlayingPreview) return;
          isPlayingPreview = true;
          itemWrap.innerHTML = "";
          itemWrap.classList.add("lgsp-playing-inline");

          if (item.type === "youtube") {
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1`;
            iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
            iframe.setAttribute("allowfullscreen", "true");
            iframe.className = "lgsp-gallery-embed";
            itemWrap.appendChild(iframe);
          } else if (item.type === "steam_movie") {
            const video = document.createElement("video");
            video.controls = false;
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            video.className = "lgsp-gallery-embed";
            attachVideoSource(video, item);
            itemWrap.appendChild(video);
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

        // Clic sur la vignette ouvre le lecteur en grand dans la Lightbox
        itemWrap.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          stopPreview();
          openLightbox(item);
        });
      } else {
        itemWrap.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openLightbox(item);
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
        steamInfo = extractSteamInfo(doc);

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