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
  ];

  // Config par domaine : sélecteurs de carte/titre/images, repris du scraper
  // Rust du projet quand disponibles.
  //
  // "mainSelector" désigne, pour chaque mise en page, l'élément qui contient
  // réellement la liste des jeux (sans la sidebar). Il sert à deux choses :
  //  - mesurer la largeur réellement disponible pour calculer la hauteur des
  //    captures (computeGalleryHeight), plutôt que deviner via une largeur
  //    de sidebar codée en dur ;
  //  - pour la mise en page "uikit-container", neutraliser une largeur max.
  //    fixe imposée par le thème sur cet élément (voir applyUikitContainerLayout).
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
    // IGG-Games et PCGamesTorrents partagent le même thème UIkit (WordPress).
    // Chaîne de parents réelle (vérifiée sur le HTML d'IGG-Games) :
    //   body > .tm-page-container > .tm-page > #tm-main > .uk-container
    //        > .uk-grid > [".container-main-post" (uk-width-expand@m), "aside#tm-sidebar"]
    // TROIS éléments plafonnent la largeur, chacun plus restrictif que le
    // suivant, et tous devaient être neutralisés (élargir "#tm-main" seul,
    // ou même ".uk-container" seul, ne suffisait pas) :
    //  - ".tm-page" (le thème l'utilise pour la mise en page "boxed") :
    //    max-width: 1010px dès que la fenêtre atteint 1010px de large. C'est
    //    l'élément le plus haut dans l'arbre et donc celui qui l'emportait
    //    silencieusement sur tous les réglages plus bas.
    //  - ".uk-container" : max-width: 1200px (conteneur UIkit par défaut),
    //    englobe la liste de jeux ET la sidebar.
    //  - ".container-main-post" : max-width: 680px fixe en desktop, qui
    //    écrasait la classe UIkit "uk-width-expand@m" déjà présente dans le
    //    HTML et censée répartir l'espace avec la sidebar.
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
      // Meilleure estimation faute de HTML de référence pour ce site.
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

  // Réglages de tailles, persistés via chrome.storage.local (une paire de
  // clés par site, préfixées par le nom d'hôte, pour que SkidrowReloaded,
  // IGG-Games et PCGamesTorrents aient chacun leurs propres réglages).
  //
  // "Largeur max. de la page" est un pourcentage (et non plus une valeur en
  // pixels) de la largeur réelle de la fenêtre. Comme le pourcentage est
  // recalculé à chaque redimensionnement (voir le listener "resize"
  // ci-dessous), la mise en page garde le même ratio quelle que soit la
  // taille de la fenêtre, sans réglage "largeur illimitée" séparé : 100%
  // équivaut à une largeur illimitée.
  //
  // "Hauteur des screenshots" n'est plus un réglage : elle est déduite de la
  // largeur réellement disponible dans la colonne de contenu (mesurée dans
  // le DOM, voir computeGalleryHeight) et de "Screenshots par ligne", en
  // visant un ratio 16:9 typique d'une capture d'écran. L'espacement entre
  // screenshots est fixé à 0.
  const STORAGE_PREFIX = `${location.hostname}:`;
  const DEFAULTS = {
    galleryColumns: 3,
    maxContentWidthPct: 66.7,
  };
  const CARD_PADDING = 44; // padding horizontal de la carte (22px de chaque côté)
  const SCREENSHOT_RATIO = 9 / 16; // hauteur/largeur visée pour une capture
  const RESIZE_DEBOUNCE_MS = 120;

  function storageKey(field) {
    return `${STORAGE_PREFIX}${field}`;
  }

  function defaultsWithPrefix() {
    return {
      [storageKey("galleryColumns")]: DEFAULTS.galleryColumns,
      [storageKey("maxContentWidthPct")]: DEFAULTS.maxContentWidthPct,
    };
  }

  function normalizeSettings(raw) {
    return {
      galleryColumns: raw[storageKey("galleryColumns")],
      maxContentWidthPct: raw[storageKey("maxContentWidthPct")],
    };
  }

  function widthValueFor(settings) {
    const px = Math.round(
      (document.documentElement.clientWidth * settings.maxContentWidthPct) / 100
    );
    return `${px}px`;
  }

  // Mesure la largeur réellement rendue de la colonne de contenu plutôt que
  // de la déduire arithmétiquement (ex. largeur de page moins largeur de
  // sidebar codée en dur) : ça reste juste quelle que soit la mise en page
  // ou la largeur de la sidebar, et ça se recalcule tout seul à chaque appel.
  function computeGalleryHeight(settings) {
    const ref = config.mainSelector ? document.querySelector(config.mainSelector) : null;
    let totalWidth = ref ? ref.getBoundingClientRect().width : document.documentElement.clientWidth;
    totalWidth -= CARD_PADDING;
    const columns = Math.max(1, settings.galleryColumns);
    const columnWidth = Math.max(100, totalWidth) / columns;
    return Math.round(columnWidth * SCREENSHOT_RATIO);
  }

  let lastSettings = null;

  function applySettings(settings) {
    lastSettings = settings;
    const root = document.documentElement.style;
    root.setProperty("--lgsp-gallery-columns", `${settings.galleryColumns}`);
    root.setProperty("--lgsp-gallery-gap", "0px");
    enforceMaxWidth(settings);
    // La hauteur de galerie dépend de la largeur du conteneur après son
    // redimensionnement : on la calcule au prochain frame pour laisser le
    // layout se stabiliser.
    requestAnimationFrame(() => {
      root.setProperty("--lgsp-gallery-height", `${computeGalleryHeight(settings)}px`);
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

  // IGG-Games / PCGamesTorrents (thème UIkit) : on élargit le SEUL élément
  // le plus haut dans l'arbre qui porte encore une limite (".tm-page", le
  // wrapper "boxed" du thème, 1010px) à la largeur voulue, puis on retire
  // purement et simplement la limite des deux éléments plus bas
  // (".uk-container" à 1200px, ".container-main-post" à 680px) : comme
  // ".tm-page" est maintenant le seul à porter une largeur maximale, eux
  // n'ont plus qu'à suivre en largeur 100%. Une fois la limite de
  // ".container-main-post" retirée, la classe UIkit "uk-width-expand@m"
  // déjà présente dans le HTML se charge toute seule de répartir l'espace
  // entre la liste de jeux et la sidebar : pas besoin de reproduire le hack
  // flex utilisé pour SkidrowReloaded.
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

  // Recalcule la largeur max. et la hauteur de galerie à chaque
  // redimensionnement de la fenêtre, pour que le ratio choisi dans le popup
  // reste respecté automatiquement (plutôt que de figer une largeur en px
  // une fois pour toutes au chargement).
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (!lastSettings) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applySettings(lastSettings), RESIZE_DEBOUNCE_MS);
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
  // Le thème du site décore chaque annonce avec la ligne "GROUPE – TYPE DE
  // LIEN – TORRENT", un synopsis tronqué, souvent un paragraphe vide
  // superflu, et un pied de carte "Read More" / commentaires. Sur demande,
  // on retire tout ce texte/footer et on ne garde que la vignette (dans
  // ".post-excerpt") : le reste de l'information est de toute façon déjà
  // disponible via le titre de la carte et la galerie de captures.

  function stripExcerptText(card) {
    const excerpt = card.querySelector(".post-excerpt");
    if (!excerpt) return;
    excerpt.querySelectorAll("p").forEach((p) => {
      // On garde le paragraphe s'il contient la vignette du jeu ; seul le
      // texte (tags de release, synopsis, paragraphes vides) est retiré.
      if (p.querySelector("img")) return;
      p.remove();
    });
  }

  function removeFooterMeta(card) {
    const footer = card.querySelector(".meta.right");
    if (footer) footer.remove();
  }

  function enhanceCard(card) {
    stripExcerptText(card);
    removeFooterMeta(card);
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