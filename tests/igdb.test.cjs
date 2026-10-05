const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function worker(fetchMock, initial = { igdbClientId: 'test-id', igdbClientSecret: 'test-secret' }) {
  const storage = { ...initial };
  const listeners = [];
  const noop = { addListener() {} };
  const context = vm.createContext({
    console, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout, fetch: fetchMock,
    chrome: {
      runtime: { onMessage: { addListener(fn) { listeners.push(fn); } }, onInstalled: noop, onStartup: noop },
      alarms: { onAlarm: noop },
      storage: { local: {
        async get(keys, cb) { const data = keys ? Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, storage[k]])) : { ...storage }; if (cb) cb(data); return data; },
        async set(data) { Object.assign(storage, data); },
        async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key]; },
      } },
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8') + '\nthis.api = { cleanIggGameTitle, searchIgdbSteamGame, steamAppIdFromUrl };', context);
  return { api: context.api, storage, message: msg => new Promise(resolve => listeners[0](msg, {}, resolve)) };
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('nettoyage des suffixes demandés et conservation du vrai titre', () => {
  const { api } = worker(() => { throw new Error('appel réseau inattendu'); });
  for (const suffix of [' Free Download', '  Free Download (v42.21)', ' Free Download (v1.4.1)', ' Free Download (v1.3.0 & All DLCs)']) {
    assert.equal(api.cleanIggGameTitle(`Project Zomboid${suffix}`), 'Project Zomboid');
  }
  assert.equal(api.cleanIggGameTitle('Game (Remastered) Free Download (v1.0)'), 'Game (Remastered)');
});

test('titre IGDB nettoyé → lien Steam exact, OAuth, déduplication et cache', async () => {
  const calls = [];
  const { api, message } = worker(async (url, options) => {
    calls.push({ url, options });
    if (url.includes('oauth2/token')) return json({ access_token: 'test-token', expires_in: 3600 });
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert(options.body.includes('search "Project Zomboid";'));
    return json([
      { id: 2, name: 'Project Zomboid 2', websites: [{ url: 'https://store.steampowered.com/app/999/' }] },
      { id: 1, name: 'Project Zomboid', websites: [{ url: 'https://store.steampowered.com/app/108600/Project_Zomboid/' }] },
    ]);
  });
  const title = 'Project Zomboid Free Download (v42.21)';
  const [first, second] = await Promise.all([message({ type: 'SEARCH_IGDB_STEAM_GAME', title }), api.searchIgdbSteamGame(title)]);
  assert.equal(first.appId, '108600');
  assert.equal(second.appId, first.appId);
  assert.equal(first.steamUrl, 'https://store.steampowered.com/app/108600/');
  assert.equal(calls.length, 2);
  await api.searchIgdbSteamGame(title);
  assert.equal(calls.length, 2);
});

test('alias IGDB et identifiant externe Steam sans URL', async () => {
  const { api } = worker(async url => url.includes('oauth2/token') ? json({ access_token: 'token', expires_in: 3600 }) : json([
    { id: 3, name: 'Titre officiel', alternative_names: [{ name: 'Origin Hunt' }], external_games: [{ uid: '123', external_game_source: { name: 'Steam' } }] },
  ]));
  assert.equal((await api.searchIgdbSteamGame('Origin Hunt Free Download')).appId, '123');
  assert.equal(api.steamAppIdFromUrl('https://store.steampowered.com.evil/app/123/'), null);
  assert.equal(api.steamAppIdFromUrl('https://store.steampowered.com/sub/123/'), null);
});

test('aucun résultat plutôt que les médias d’une suite; absence mémorisée', async () => {
  let calls = 0;
  const { api } = worker(async url => {
    calls++;
    return url.includes('oauth2/token') ? json({ access_token: 'token', expires_in: 3600 }) : json([{ name: 'Game 2', websites: [{ url: 'https://store.steampowered.com/app/999/' }] }]);
  });
  assert.equal(await api.searchIgdbSteamGame('Game Free Download'), null);
  assert.equal(await api.searchIgdbSteamGame('Game Free Download'), null);
  assert.equal(calls, 2);
});

test('identifiants manquants : erreur utile sans requête réseau', async () => {
  const { message } = worker(() => { throw new Error('appel réseau inattendu'); }, {});
  const result = await message({ type: 'SEARCH_IGDB_STEAM_GAME', title: 'Game Free Download' });
  assert.match(result.error, /Client ID et le Client Secret/);
});

test('jeton refusé : renouvellement OAuth puis nouvelle requête IGDB', async () => {
  let calls = 0;
  const { api } = worker(async url => {
    calls++;
    if (calls === 1) return json({}, 401);
    if (url.includes('oauth2/token')) return json({ access_token: 'new-token', expires_in: 3600 });
    return json([{ name: 'Game', websites: [{ url: 'https://store.steampowered.com/app/123/' }] }]);
  }, { igdbClientId: 'test-id', igdbClientSecret: 'test-secret', igdbToken: { clientId: 'test-id', accessToken: 'old-token', expiresAt: Date.now() + 3600000 } });
  assert.equal((await api.searchIgdbSteamGame('Game Free Download')).appId, '123');
  assert.equal(calls, 3);
});
