// Script injecté directement sur les pages Steam Community et Steam Store
// Ne synchronise que si l'utilisateur a explicitement cliqué sur le bouton du popup.

(async function () {
  const isGamesPage = location.pathname.includes("/games") || location.search.includes("tab=all");
  const isWishlistPage = location.pathname.includes("/wishlist");

  if (!isGamesPage && !isWishlistPage) return;

  // Vérifie si la synchronisation a été explicitement demandée par l'utilisateur depuis le popup
  function isSyncAuthorized() {
    return new Promise((resolve) => {
      const hasHash = location.hash.includes("lgsp_sync=1") || location.search.includes("lgsp_sync=1");
      if (hasHash) {
        resolve(true);
        return;
      }
      chrome.storage.local.get(["steamSyncAuthorizedAt"], (res) => {
        const timestamp = res.steamSyncAuthorizedAt;
        if (typeof timestamp === "number" && Date.now() - timestamp < 60000) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  const authorized = await isSyncAuthorized();
  if (!authorized) {
    // Navigation normale : aucune synchronisation non sollicitée pour protéger la vie privée
    return;
  }

  // Consomme l'autorisation pour éviter les synchronisations ultérieures involontaires
  chrome.storage.local.remove("steamSyncAuthorizedAt");

  function showNotification(text) {
    let notif = document.getElementById("lgsp-steam-sync-notif");
    if (!notif) {
      notif = document.createElement("div");
      notif.id = "lgsp-steam-sync-notif";
      notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999999;
        background: linear-gradient(135deg, #1b2838, #171a21);
        color: #fff;
        border: 2px solid #38bdf8;
        border-radius: 12px;
        padding: 14px 20px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      document.body.appendChild(notif);
    }
    notif.innerHTML = `
      <div style="font-size: 24px;">🎮</div>
      <div>
        <div style="font-weight: 700; color: #38bdf8; font-size: 14px;">Extension Screenshots</div>
        <div>${text}</div>
      </div>
    `;

    setTimeout(() => {
      if (notif) {
        notif.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        notif.style.opacity = "0";
        notif.style.transform = "translateY(-10px)";
        setTimeout(() => notif.remove(), 500);
      }
    }, 4500);
  }

  // 1. Extraction des jeux possédés sur la page des jeux
  if (isGamesPage) {
    function extractOwnedGames() {
      const ownedSet = new Set();

      // Méthode A : Éléments du DOM avec id game_XXXX
      document.querySelectorAll('[id^="game_"]').forEach((el) => {
        const m = el.id.match(/^game_(\d+)$/);
        if (m) ownedSet.add(String(m[1]));
      });

      // Méthode B : Liens vers le magasin store.steampowered.com/app/XXXX
      document.querySelectorAll('a[href*="/app/"]').forEach((a) => {
        const m = (a.href || "").match(/\/app\/(\d+)/);
        if (m) ownedSet.add(String(m[1]));
      });

      // Méthode C : Balises script contenant rgGames ou rgOwnedApps
      document.querySelectorAll("script").forEach((s) => {
        const text = s.textContent || "";
        if (text.includes("rgGames") || text.includes("rgOwnedApps")) {
          const re = /"appid"\s*:\s*(\d+)/g;
          let m;
          while ((m = re.exec(text)) !== null) {
            ownedSet.add(String(m[1]));
          }
        }
      });

      const ownedArray = Array.from(ownedSet);
      if (ownedArray.length > 0) {
        chrome.storage.local.get(["steamOwned"], (res) => {
          const prev = Array.isArray(res.steamOwned) ? res.steamOwned : [];
          const merged = Array.from(new Set([...prev.map(String), ...ownedArray]));
          chrome.storage.local.set({
            steamOwned: merged,
            steamLastSync: Date.now(),
          }, () => {
            showNotification(`<strong>${ownedArray.length} jeux</strong> de votre bibliothèque synchronisés avec succès !`);
          });
        });
      }
    }

    setTimeout(extractOwnedGames, 600);
    setTimeout(extractOwnedGames, 2000);
  }

  // 2. Extraction de la Wishlist sur la page wishlist
  if (isWishlistPage) {
    function extractWishlist() {
      const wishlistSet = new Set();

      document.querySelectorAll('a[href*="/app/"], [data-app-id]').forEach((el) => {
        const appIdAttr = el.getAttribute("data-app-id");
        if (appIdAttr && /^\d+$/.test(appIdAttr)) {
          wishlistSet.add(String(appIdAttr));
        }
        const href = el.getAttribute("href") || "";
        const m = href.match(/\/app\/(\d+)/);
        if (m) wishlistSet.add(String(m[1]));
      });

      document.querySelectorAll("script").forEach((s) => {
        const text = s.textContent || "";
        const re = /"appid"\s*:\s*(\d+)/g;
        let m;
        while ((m = re.exec(text)) !== null) {
          wishlistSet.add(String(m[1]));
        }
      });

      const wishlistArray = Array.from(wishlistSet);
      if (wishlistArray.length > 0) {
        chrome.storage.local.get(["steamWishlist"], (res) => {
          const prev = Array.isArray(res.steamWishlist) ? res.steamWishlist : [];
          const merged = Array.from(new Set([...prev.map(String), ...wishlistArray]));
          chrome.storage.local.set({
            steamWishlist: merged,
            steamLastSync: Date.now(),
          }, () => {
            showNotification(`<strong>${wishlistArray.length} jeux</strong> de votre Wishlist synchronisés avec succès !`);
          });
        });
      }
    }

    setTimeout(extractWishlist, 600);
    setTimeout(extractWishlist, 2500);
  }
})();
