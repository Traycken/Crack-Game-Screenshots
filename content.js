(() => {
  // Répond au popup qui a besoin de la largeur réelle de la page pour
  // calculer une largeur max. par défaut (voir computeDefaultSettings).
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.type === "lgsp-get-page-width") {
        sendResponse({ width: document.documentElement.clientWidth });
      }
    });
  }

  const PROCESSED_ATTR = "data-lgsp-done";
  const BLACKLIST_SUBSTR = [
    "secure.gravatar.com",
    "social-twitter.gif",
    "social-digg.gif",
    "social-facebook.gif",
    "backgroundpic.jpg",
    "logoo.png",
    "/wp-content/themes/",
  ];

  // Config par domaine : sélecteurs de carte/titre/images, repris du scraper
  // Rust du projet quand disponibles.
  const SITE_CONFIGS = {
    "www.skidrowreloaded.com": {
      cardSelector: "div.post",
      titleSelector: "h2 a",
      detailImageSelector: "img",
      // Mise en page en 2 colonnes flottantes (#main-content + #sidebar
      // dans #overall-container) : il faut élargir le vrai conteneur parent
      // et transformer les flottants en flexbox pour que main-content
      // profite de l'espace, plutôt que juste élargir #main-content seul.
      layout: "sidebar-flex",
      wrapSelector: "#overall-container",
      mainSelector: "#main-content",
      sidebarSelector: "#sidebar",
      pageWrapSelector: "#page-wrap",
      // Redesign spécifique (voir style.css) : la carte a besoin d'un peu
      // de nettoyage DOM que le CSS seul ne peut pas faire proprement.
      enhanceCard: true,
    },
    "pcgamestorrents.com": {
      cardSelector: "article.uk-article",
      titleSelector: "h2.uk-article-title a",
      detailImageSelector: "img.igg-image-content",
      layout: "simple",
      mainContainerSelector: "#tm-main",
    },
    "igg-games.com": {
      // Meilleure estimation faute de HTML de référence pour ce site.
      cardSelector: "article.uk-article, article.post, div.post",
      titleSelector: "h2.uk-article-title a, h2.entry-title a, h2 a",
      detailImageSelector: "img.igg-image-content, .entry-content img, article img",
      layout: "simple",
      mainContainerSelector: "#tm-main",
    },
  };

  const config = SITE_CONFIGS[location.hostname];
  if (!config) return;

  // SkidrowReloaded : le thème habille aussi bien la page d'accueil (grille
  // de cartes) que la page d'un jeu individuel (article seul). Le redesign
  // (CSS + nettoyage DOM) ne doit s'appliquer que sur les pages de liste :
  // "/", pagination "/page/N/" et archives "/category/...". Sur une page de
  // jeu individuelle, on ne touche à rien et le thème d'origine reste tel quel.
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
  const MAX_THUMBS = 6;

  // Réglages de tailles, persistés via chrome.storage.local et modifiables
  // depuis le popup de l'extension. Appliqués comme variables CSS sur <html>.
  // Par défaut (tant que l'utilisateur n'a rien réglé lui-même), la largeur
  // max. de la page est automatique : 4/6 de la largeur réelle de la page,
  // recalculée à chaque chargement plutôt qu'une valeur fixe.
  //
  // "Hauteur des screenshots" n'est plus un réglage : elle est déduite de
  // "Largeur max. de la page" et de "Screenshots par ligne" (voir
  // computeGalleryHeight), en visant un ratio 16:9 typique d'une capture
  // d'écran. L'espacement entre screenshots est fixé à 0.
  const MIN_MAX_WIDTH = 800;
  const MAX_MAX_WIDTH = 3840;
  const SIDEBAR_WIDTH = 280 + 24; // largeur sidebar + gap, uniquement sur SkidrowReloaded
  const CARD_PADDING = 44; // padding horizontal de la carte (22px de chaque côté)
  const SCREENSHOT_RATIO = 9 / 16; // hauteur/largeur visée pour une capture

  function computeDefaultSettings() {
    const auto = Math.round((document.documentElement.clientWidth * 4) / 6);
    return {
      galleryColumns: 3,
      maxContentWidth: Math.min(MAX_MAX_WIDTH, Math.max(MIN_MAX_WIDTH, auto)),
      noLimit: false,
    };
  }

  function computeGalleryHeight(settings) {
    let totalWidth = settings.noLimit
      ? document.documentElement.clientWidth
      : settings.maxContentWidth;
    if (config.layout === "sidebar-flex") totalWidth -= SIDEBAR_WIDTH;
    totalWidth -= CARD_PADDING;
    const columns = Math.max(1, settings.galleryColumns);
    const columnWidth = Math.max(100, totalWidth) / columns;
    return Math.round(columnWidth * SCREENSHOT_RATIO);
  }

  function applySettings(settings) {
    const root = document.documentElement.style;
    root.setProperty("--lgsp-gallery-height", `${computeGalleryHeight(settings)}px`);
    root.setProperty("--lgsp-gallery-columns", `${settings.galleryColumns}`);
    root.setProperty("--lgsp-gallery-gap", "0px");
    enforceMaxWidth(settings);
  }

  function widthValueFor(settings) {
    return settings.noLimit ? "100%" : `${settings.maxContentWidth}px`;
  }

  function enforceMaxWidth(settings) {
    if (config.layout === "sidebar-flex") {
      applySidebarFlexLayout(settings);
      return;
    }
    if (!config.mainContainerSelector) return;
    document.querySelectorAll(config.mainContainerSelector).forEach((el) => {
      el.style.setProperty("max-width", widthValueFor(settings), "important");
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("margin-left", "auto", "important");
      el.style.setProperty("margin-right", "auto", "important");
    });
  }

  function applySidebarFlexLayout(settings) {
    if (config.pageWrapSelector) {
      document.querySelectorAll(config.pageWrapSelector).forEach((el) => {
        el.style.setProperty("max-width", widthValueFor(settings), "important");
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

    wrap.style.setProperty("max-width", widthValueFor(settings), "important");
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

  chrome.storage.local.get(computeDefaultSettings(), (settings) => applySettings(settings));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    chrome.storage.local.get(computeDefaultSettings(), (settings) => applySettings(settings));
  });

  const screenshotCache = new Map();

  function findCardLink(card) {
    const titleLink = card.querySelector(titleSel);
    return titleLink ? titleLink.getAttribute("href") : null;
  }

  function extractScreenshots(doc) {
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
      if (!urls.includes(src)) urls.push(src);
    });
    return urls.slice(0, MAX_THUMBS);
  }

  function openLightbox(src) {
    const box = document.createElement("div");
    box.className = "lgsp-lightbox";
    const img = document.createElement("img");
    img.src = src;
    box.appendChild(img);
    box.addEventListener("click", () => box.remove());
    document.body.appendChild(box);
  }

  function renderGallery(card, urls) {
    const existingStatus = card.querySelector(".lgsp-status");
    if (existingStatus) existingStatus.remove();

    if (urls.length === 0) {
      const empty = document.createElement("div");
      empty.className = "lgsp-status";
      empty.textContent = "Aucune capture trouvée";
      card.appendChild(empty);
      return;
    }

    const gallery = document.createElement("div");
    gallery.className = "lgsp-gallery";
    urls.forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.loading = "lazy";
      img.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(src);
      });
      gallery.appendChild(img);
    });
    card.appendChild(gallery);
  }

  async function loadScreenshotsForCard(card) {
    const link = findCardLink(card);
    if (!link) return;

    card.setAttribute(PROCESSED_ATTR, "1");

    const status = document.createElement("div");
    status.className = "lgsp-status";
    status.textContent = "Chargement des captures...";
    card.appendChild(status);

    try {
      let urls = screenshotCache.get(link);
      if (!urls) {
        const res = await fetch(link, { credentials: "include" });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        urls = extractScreenshots(doc);
        screenshotCache.set(link, urls);
      }
      renderGallery(card, urls);
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
        loadScreenshotsForCard(card);
      });
    },
    { rootMargin: "200px" }
  );

  // Force une carte par ligne. Comme on ne connaît pas la structure exacte
  // du conteneur de grille de chaque site, on agit directement sur la carte
  // elle-même en inline !important (bat n'importe quelle feuille de style).
  function enforceSingleColumnLayout(card) {
    card.style.setProperty("display", "block", "important");
    card.style.setProperty("width", "100%", "important");
    card.style.setProperty("max-width", "none", "important");
    card.style.setProperty("float", "none", "important");
    card.style.setProperty("margin-bottom", "24px", "important");
    card.classList.add("lgsp-card");
  }

  // --- Nettoyage spécifique SkidrowReloaded --------------------------------
  // Le thème du site décore chaque annonce à la main avec des couleurs et
  // une mise en page différentes à chaque fois. Le CSS seul peut neutraliser
  // les couleurs, mais transformer la ligne "GROUPE – TYPE DE LIEN –
  // TORRENT" en vraies étiquettes, et nettoyer le pied de carte, demande de
  // toucher au DOM.

  function enhanceReleaseTags(card) {
    const excerpt = card.querySelector(".post-excerpt");
    if (!excerpt) return;
    excerpt.querySelectorAll("p").forEach((p) => {
      if (p.dataset.lgspTags) return;
      const strong = p.querySelector("strong");
      if (!strong) return;
      const text = strong.textContent.replace(/\s+/g, " ").trim();
      if (!text.includes("–")) return;
      const parts = text
        .split("–")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length < 2) return;
      p.textContent = "";
      p.classList.add("lgsp-tagrow");
      parts.forEach((part) => {
        const tag = document.createElement("span");
        tag.className = "lgsp-tag";
        tag.textContent = part;
        p.appendChild(tag);
      });
      p.dataset.lgspTags = "1";
    });
  }

  function cleanFooterMeta(card) {
    const footer = card.querySelector(".meta.right");
    if (!footer || footer.dataset.lgspClean) return;
    Array.from(footer.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    footer.dataset.lgspClean = "1";
  }

  function enhanceCard(card) {
    enhanceReleaseTags(card);
    cleanFooterMeta(card);
  }

  function scanForCards() {
    document.querySelectorAll(`${cardSel}`).forEach((card) => {
      if (!card.hasAttribute(PROCESSED_ATTR)) {
        enforceSingleColumnLayout(card);
        observer.observe(card);
      }
      if (config.enhanceCard) enhanceCard(card);
    });
  }

  scanForCards();

  const mutationObserver = new MutationObserver(() => scanForCards());
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();