// Exécute le vrai background.js dans Node pour enregistrer les réponses Steam utilisées par la démo.
// Usage : node tools/record-demo-fixtures.mjs   (après build-demo.mjs)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesFile = path.join(ROOT, "docs", "demo", "fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesFile, "utf8"));

const store = {};
let listener = null;
const noop = () => {};
const ev = { addListener: noop };
const chrome = {
  runtime: { id: "rec", lastError: undefined, onMessage: { addListener: (fn) => (listener = fn) }, onInstalled: ev, onStartup: ev, getManifest: () => ({ version: "0" }) },
  alarms: { create: noop, onAlarm: ev },
  action: undefined,
  tabs: { query: noop, sendMessage: () => Promise.resolve() },
  storage: {
    local: {
      get: async (k) => (k == null ? { ...store } : Object.fromEntries([].concat(typeof k === "object" && !Array.isArray(k) ? Object.keys(k) : k).filter((x) => x in store).map((x) => [x, store[x]]))),
      set: async (o) => void Object.assign(store, o),
      remove: async (k) => void [].concat(k).forEach((x) => delete store[x]),
      getBytesInUse: async () => 0,
    },
  },
};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "background.js"), "utf8"), { TTL_STEAM_SEARCH_FOUND: 864e5, TTL_STEAM_SEARCH_NOT_FOUND: 36e5, chrome, fetch, console, setTimeout, clearTimeout, URL, URLSearchParams, Date, Math, JSON, Promise, Map, Set, TextEncoder, TextDecoder, btoa, atob, AbortController });

const ask = (msg) => new Promise((resolve) => {
  const t = setTimeout(() => resolve(null), 30000);
  listener(msg, {}, (r) => (clearTimeout(t), resolve(r)));
});

const html = fs.readFileSync(path.join(ROOT, "docs", "demo", "index.html"), "utf8");
const titles = [...html.matchAll(/<h2><a href="[^"]+">([^<]+)<\/a>/g)].map((m) => m[1].replace(/&#8211;/g, "–").replace(/&amp;/g, "&"));

for (const title of titles) {
  const found = await ask({ type: "SEARCH_STEAM_GAME", title });
  fixtures.messages[`SEARCH_STEAM_GAME|${title}`] = found;
  const appId = found && (found.appId || found.id);
  console.log(title, "→", appId || "aucun résultat");
  if (appId && !fixtures.messages[`STEAM_GAME_INFO|${appId}`]) {
    const info = await ask({ type: "STEAM_GAME_INFO", appId });
    fixtures.messages[`STEAM_GAME_INFO|${appId}`] = info;
    fixtures.messages[`STEAM_LANG_CHECK|${appId}`] = info;
  }
}
fs.writeFileSync(fixturesFile, JSON.stringify(fixtures));
process.exit(0);
