// Faux environnement d'extension pour la démo : chrome.* en mémoire, fetch() sur fiches pré-enregistrées,
// sendMessage() répondant depuis fixtures.json, navigation désactivée.
(() => {
  const loc = {
    hostname: "www.skidrowreloaded.com",
    host: "www.skidrowreloaded.com",
    origin: "https://www.skidrowreloaded.com",
    protocol: "https:",
    pathname: "/",
    search: "",
    hash: "",
    get href() {
      return "https://www.skidrowreloaded.com/";
    },
    set href(_) {},
    assign() {},
    replace() {},
    reload() {},
    toString() {
      return this.href;
    },
  };
  window.__DEMO_LOCATION__ = loc;

  let fixtures = { messages: {}, pages: {} };
  try {
    const x = new XMLHttpRequest();
    x.open("GET", "fixtures.json", false);
    x.send();
    fixtures = JSON.parse(x.responseText);
  } catch (e) {
    console.warn("[demo] fixtures.json introuvable", e);
  }
  window.__DEMO_MISSES__ = [];

  const store = {};
  const listeners = [];
  const notify = (changes) => listeners.forEach((fn) => fn(changes, "local"));
  const pick = (keys) => {
    if (keys == null) return { ...store };
    if (typeof keys === "string") keys = [keys];
    const out = {};
    if (Array.isArray(keys)) keys.forEach((k) => k in store && (out[k] = store[k]));
    else Object.entries(keys).forEach(([k, d]) => (out[k] = k in store ? store[k] : d));
    return out;
  };
  const done = (cb, v) => {
    if (typeof cb === "function") setTimeout(() => cb(v), 0);
    return Promise.resolve(v);
  };

  const msgKey = (m) => `${m.type}|${m.appId || m.title || m.url || ""}`;

  window.chrome = {
    runtime: {
      id: "demo-extension",
      lastError: undefined,
      onMessage: { addListener() {} },
      sendMessage(msg, cb) {
        const res = fixtures.messages[msgKey(msg)];
        if (res === undefined) window.__DEMO_MISSES__.push(msgKey(msg));
        setTimeout(() => typeof cb === "function" && cb(res === undefined ? null : res), 30);
      },
    },
    storage: {
      local: {
        get: (keys, cb) => done(cb, pick(keys)),
        set(items, cb) {
          const changes = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = v;
          }
          notify(changes);
          return done(cb);
        },
        remove(keys, cb) {
          [].concat(keys).forEach((k) => delete store[k]);
          return done(cb);
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const html = fixtures.pages[url];
    if (html) return Promise.resolve(new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
    if (/skidrowreloaded\.com/.test(url)) return Promise.resolve(new Response("", { status: 404 }));
    return realFetch(input, init);
  };

  // Aucune navigation vers le vrai site ou les hébergeurs
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (a && !a.getAttribute("href").startsWith("#")) e.preventDefault();
    },
    true
  );
})();
