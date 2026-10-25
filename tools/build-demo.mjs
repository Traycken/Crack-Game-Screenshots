// Génère docs/demo : snapshot nettoyé de SkidrowReloaded + vrai content.js/style.css
// exécutés avec un faux chrome.* et des réponses pré-enregistrées (docs/demo/fixtures.json).
// Usage : node tools/build-demo.mjs [--refresh]   (--refresh re-télécharge le snapshot)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "demo");
const ASSETS = path.join(OUT, "assets");
const ORIGIN = "https://www.skidrowreloaded.com";
const MAX_POSTS = 8;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36";

fs.mkdirSync(ASSETS, { recursive: true });

const get = async (url, binary = false) => {
  const res = await fetch(url, { headers: { "user-agent": UA, referer: ORIGIN + "/" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
};

const imgCache = new Map();
async function localImage(url) {
  if (!url || !/^https?:\/\//.test(url)) return url;
  if (imgCache.has(url)) return imgCache.get(url);
  const name = path.basename(new URL(url).pathname).replace(/[^\w.-]/g, "_");
  const file = `img_${imgCache.size}_${name}`;
  try {
    fs.writeFileSync(path.join(ASSETS, file), await get(url, true));
    imgCache.set(url, `assets/${file}`);
  } catch {
    imgCache.set(url, url);
  }
  return imgCache.get(url);
}

async function rewriteImages(html) {
  const urls = [...new Set([...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]))];
  for (const u of urls) {
    if (!u.includes("/wp-content/uploads/")) continue;
    html = html.split(u).join(await localImage(u));
  }
  // srcset pointe vers les originaux : on le retire
  return html.replace(/\s(?:srcset|sizes)=["'][^"']*["']/gi, "");
}

function stripActive(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*')/gi, "");
}

// Liens de téléchargement : on garde l'hébergeur (utile à l'affichage) mais plus le chemin.
function neutralizeLinks(html) {
  return html.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (m, q, url) => {
    const u = new URL(url);
    if (u.hostname.endsWith("skidrowreloaded.com")) return m;
    return `href=${q}${u.origin}/demo${q}`;
  });
}

async function main() {
  const rawFile = path.join(ROOT, "tools", ".cache", "raw.html");
  fs.mkdirSync(path.dirname(rawFile), { recursive: true });
  if (process.argv.includes("--refresh") || !fs.existsSync(rawFile)) {
    fs.writeFileSync(rawFile, await get(ORIGIN + "/"));
  }
  let home = fs.readFileSync(rawFile, "utf8");

  // CSS du site, avec url() relatives rendues absolues
  const cssLinks = [...home.matchAll(/<link[^>]+rel=['"]stylesheet['"][^>]+href=['"]([^'"]+)['"]/gi)].map((m) => m[1]);
  let cssTags = "";
  for (const [i, href] of cssLinks.entries()) {
    try {
      const abs = new URL(href, ORIGIN).href;
      const base = abs.replace(/[^/]*$/, "");
      const css = (await get(abs)).replace(/url\(\s*(['"]?)(?!data:|https?:|\/\/)([^'")]+)\1\s*\)/g, (_, q, p) => `url(${q}${new URL(p, base).href}${q})`);
      fs.writeFileSync(path.join(ASSETS, `site${i}.css`), css);
      cssTags += `<link rel="stylesheet" href="assets/site${i}.css">\n`;
    } catch (e) {
      console.warn("CSS ignoré :", href, e.message);
    }
  }

  // Page d'accueil : on ne garde que les N premières cartes
  const bodyStart = home.indexOf("<body");
  const bodyHtml = home.slice(home.indexOf(">", bodyStart) + 1, home.indexOf("</body>"));
  const parts = bodyHtml.split(/(?=<div class="post class=)/);
  const head = parts[0];
  const posts = parts.slice(1, 1 + MAX_POSTS).map((p) => p.replace(/<!--End post-->[\s\S]*$/, "<!--End post-->\n"));
  const tailIdx = bodyHtml.indexOf('<div id="sidebar"');
  const tail = tailIdx >= 0 ? bodyHtml.slice(tailIdx) : "</div>";

  let page = neutralizeLinks(stripActive(head + posts.join("\n") + "</div>\n" + tail));
  page = await rewriteImages(page);

  // Fiches détail (fixtures pour fetch(link))
  const pages = {};
  const links = [...new Set(posts.flatMap((p) => [...p.matchAll(/<h2><a href="([^"]+)"/g)].map((m) => m[1])))];
  for (const link of links) {
    try {
      let h = await get(link);
      const start = h.indexOf('<div id="main-content"');
      h = await rewriteImages(neutralizeLinks(stripActive(start >= 0 ? h.slice(start) : h)));
      pages[link] = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="overall-container">${h}</div></body></html>`;
    } catch (e) {
      console.warn("Fiche ignorée :", link, e.message);
    }
  }

  const fixturesFile = path.join(OUT, "fixtures.json");
  const old = fs.existsSync(fixturesFile) ? JSON.parse(fs.readFileSync(fixturesFile, "utf8")) : {};
  fs.writeFileSync(fixturesFile, JSON.stringify({ messages: old.messages || {}, pages }));

  // Extension réelle : content.js enveloppé pour fournir une fausse `location`
  fs.copyFileSync(path.join(ROOT, "style.css"), path.join(OUT, "style.css"));
  fs.copyFileSync(path.join(ROOT, "hls.min.js"), path.join(OUT, "hls.min.js"));
  const content = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
  fs.writeFileSync(path.join(OUT, "content.demo.js"), `(function (location) {\n${content}\n}).call(window, window.__DEMO_LOCATION__);\n`);

  const title = (home.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "Skidrow";
  fs.writeFileSync(
    path.join(OUT, "index.html"),
    `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${cssTags}<link rel="stylesheet" href="style.css">
<script src="shim.js"></script>
<script src="hls.min.js"></script>
<script src="content.demo.js"></script>
</head>
<body class="home blog">
<div id="demo-banner" style="position:relative;z-index:99999;background:#111;color:#e5e7eb;font:12px sans-serif;text-align:center;padding:6px 10px">Démo de l'extension — snapshot nettoyé de SkidrowReloaded, données Steam pré-enregistrées, liens désactivés.</div>
${page}
</body>
</html>
`
  );
  console.log(`OK : ${posts.length} cartes, ${Object.keys(pages).length} fiches, ${imgCache.size} images`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
