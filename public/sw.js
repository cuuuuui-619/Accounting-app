const CACHE_PREFIX = "moss-ledger-pwa";
const CACHE_VERSION = "v4";
const SHELL_CACHE_NAME = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const ASSET_CACHE_NAME = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE_NAME, ASSET_CACHE_NAME]);
const ROOT_URL = new URL("./", self.registration.scope).href;
const APP_SHELL = [
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
].map((path) => new URL(path, ROOT_URL).href);

function isCacheable(response) {
  return response.ok && (response.type === "basic" || response.type === "default");
}

function extractBuildAssets(html) {
  const assets = new Set();
  const attributePattern = /<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = attributePattern.exec(html)) !== null) {
    const url = new URL(match[1], ROOT_URL);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_expo/static/")) {
      assets.add(url.href);
    }
  }

  return [...assets];
}

async function refreshAppShell() {
  const response = await fetch(new Request(ROOT_URL, { cache: "reload" }));
  if (!isCacheable(response)) throw new Error("The app shell response is not cacheable.");

  const buildAssets = extractBuildAssets(await response.clone().text());
  if (buildAssets.length === 0) throw new Error("No Expo build assets were found in the app shell.");

  const fetchedAssets = await Promise.all(buildAssets.map(async (url) => {
    const assetResponse = await fetch(new Request(url, { cache: "force-cache" }));
    if (!isCacheable(assetResponse)) throw new Error(`Build asset is not cacheable: ${url}`);
    return [url, assetResponse];
  }));

  const assetCache = await caches.open(ASSET_CACHE_NAME);
  await Promise.all(fetchedAssets.map(([url, assetResponse]) => assetCache.put(url, assetResponse)));

  const activeAssets = new Set(buildAssets);
  const cachedAssets = await assetCache.keys();
  await Promise.all(cachedAssets
    .filter((request) => new URL(request.url).pathname.startsWith("/_expo/static/") && !activeAssets.has(request.url))
    .map((request) => assetCache.delete(request)));

  const shellCache = await caches.open(SHELL_CACHE_NAME);
  await shellCache.put(ROOT_URL, response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      refreshAppShell(),
      caches.open(SHELL_CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.has(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const refresh = refreshAppShell();
    event.waitUntil(refresh.catch(() => undefined));
    event.respondWith(
      caches.match(ROOT_URL).then(async (cached) => {
        if (cached) return cached;
        try {
          await refresh;
          return await caches.match(ROOT_URL) ?? fetch(request);
        } catch {
          return fetch(request);
        }
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/_expo/static/")) {
    event.respondWith(
      caches.open(ASSET_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (isCacheable(response)) await cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  const refresh = fetch(request).then(async (response) => {
    if (isCacheable(response)) {
      const cache = await caches.open(SHELL_CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(refresh.catch(() => undefined));
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      return refresh;
    }),
  );
});
