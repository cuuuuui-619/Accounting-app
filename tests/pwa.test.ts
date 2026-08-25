import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function createServiceWorkerHarness(initialNetwork: Record<string, string>) {
  const origin = "https://moss-ledger.example";
  const network = new Map(Object.entries(initialNetwork));
  const fetchRequests: Array<{ url: string; cache: RequestCache }> = [];
  const stores = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (event: any) => void>();
  const normalize = (input: string | Request) => new URL(typeof input === "string" ? input : input.url, `${origin}/`).href;

  const fetchAsset = async (input: string | Request) => {
    const url = normalize(input);
    fetchRequests.push({ url, cache: typeof input === "string" ? "default" : input.cache });
    const body = network.get(url);
    if (body === undefined) throw new Error(`Network fixture missing: ${url}`);
    return new Response(body, { status: 200 });
  };

  const caches = {
    async open(name: string) {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        async addAll(inputs: Array<string | Request>) {
          const responses = await Promise.all(inputs.map(async (input) => [normalize(input), await fetchAsset(input)] as const));
          responses.forEach(([url, response]) => store.set(url, response.clone()));
        },
        async match(input: string | Request) {
          return stores.get(name)?.get(normalize(input))?.clone();
        },
        async put(input: string | Request, response: Response) {
          store.set(normalize(input), response.clone());
        },
        async delete(input: string | Request) {
          return store.delete(normalize(input));
        },
        async keys() {
          return [...store.keys()].map((url) => new Request(url));
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async match(input: string | Request) {
      const url = normalize(input);
      for (const store of stores.values()) {
        const response = store.get(url);
        if (response) return response.clone();
      }
      return undefined;
    },
  };

  const worker = {
    location: { origin },
    registration: { scope: `${origin}/` },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(name: string, handler: (event: any) => void) {
      handlers.set(name, handler);
    },
  };

  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: worker,
    caches,
    fetch: fetchAsset,
    URL,
    Request,
    Response,
    Promise,
  });

  return { caches, fetchRequests, handlers, network, origin };
}

async function dispatchInstall(harness: ReturnType<typeof createServiceWorkerHarness>) {
  let work = Promise.resolve();
  harness.handlers.get("install")?.({ waitUntil: (promise: Promise<unknown>) => { work = promise.then(() => undefined); } });
  await work;
}

test("declares an installable standalone PWA for iPhone", () => {
  const manifest = readJson("public/manifest.webmanifest");
  assert.equal(manifest.name, "苔账");
  assert.equal(manifest.short_name, "苔账");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");

  const icons = manifest.icons as Array<Record<string, unknown>>;
  assert.deepEqual(icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.ok(icons.every((icon) => icon.purpose === "any maskable"));
});

test("includes iOS home-screen metadata and offline registration", () => {
  const html = readFileSync("public/index.html", "utf8");
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="default"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="苔账"/);

  const serviceWorker = readFileSync("public/sw.js", "utf8");
  assert.match(serviceWorker, /addEventListener\("install"/);
  assert.match(serviceWorker, /addEventListener\("activate"/);
  assert.match(serviceWorker, /addEventListener\("fetch"/);
});

test("warms the Supabase connection before the application bundle runs", () => {
  const html = readFileSync("public/index.html", "utf8");
  assert.match(html, /rel="preconnect" href="https:\/\/iibhhdpsbjdnqnoljfka\.supabase\.co" crossorigin/);
  assert.match(html, /rel="dns-prefetch" href="\/\/iibhhdpsbjdnqnoljfka\.supabase\.co"/);
});

test("pre-caches the generated Expo bundle discovered from the app shell", async () => {
  const origin = "https://moss-ledger.example";
  const bundleUrl = `${origin}/_expo/static/js/web/index-old.js`;
  const harness = createServiceWorkerHarness({
    [`${origin}/`]: `<div id="root"></div><script src="/_expo/static/js/web/index-old.js" defer></script>`,
    [`${origin}/manifest.webmanifest`]: "{}",
    [`${origin}/icons/icon-192.png`]: "192",
    [`${origin}/icons/icon-512.png`]: "512",
    [`${origin}/icons/apple-touch-icon.png`]: "180",
    [bundleUrl]: "old bundle",
  });

  await dispatchInstall(harness);

  assert.equal(await (await harness.caches.match(`${origin}/`))?.text(), `<div id="root"></div><script src="/_expo/static/js/web/index-old.js" defer></script>`);
  assert.equal(await (await harness.caches.match(bundleUrl))?.text(), "old bundle");
  assert.equal(harness.fetchRequests.find((request) => request.url === bundleUrl)?.cache, "force-cache");
});

test("serves a cached navigation immediately and refreshes its bundle atomically", async () => {
  const origin = "https://moss-ledger.example";
  const oldHtml = `<script src="/_expo/static/js/web/index-old.js"></script>`;
  const newHtml = `<script src="/_expo/static/js/web/index-new.js"></script>`;
  const harness = createServiceWorkerHarness({
    [`${origin}/`]: oldHtml,
    [`${origin}/manifest.webmanifest`]: "{}",
    [`${origin}/icons/icon-192.png`]: "192",
    [`${origin}/icons/icon-512.png`]: "512",
    [`${origin}/icons/apple-touch-icon.png`]: "180",
    [`${origin}/_expo/static/js/web/index-old.js`]: "old bundle",
  });
  await dispatchInstall(harness);
  harness.network.set(`${origin}/`, newHtml);
  harness.network.set(`${origin}/_expo/static/js/web/index-new.js`, "new bundle");

  let response: Promise<Response> | undefined;
  let refresh: Promise<void> | undefined;
  harness.handlers.get("fetch")?.({
    request: { url: `${origin}/`, method: "GET", mode: "navigate" },
    respondWith: (promise: Promise<Response>) => { response = promise; },
    waitUntil: (promise: Promise<unknown>) => { refresh = promise.then(() => undefined); },
  });

  assert.ok(response, "fetch handler did not respond");
  assert.equal(await (await response).text(), oldHtml);
  assert.ok(refresh, "navigation refresh was not kept alive");
  await refresh;
  assert.equal(await (await harness.caches.match(`${origin}/`))?.text(), newHtml);
  assert.equal(await (await harness.caches.match(`${origin}/_expo/static/js/web/index-new.js`))?.text(), "new bundle");
});

test("ships correctly sized PNG icons", () => {
  const cases = [
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/apple-touch-icon.png", 180],
  ] as const;

  for (const [path, expectedSize] of cases) {
    const png = readFileSync(path);
    assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(png.readUInt32BE(16), expectedSize);
    assert.equal(png.readUInt32BE(20), expectedSize);
  }
});
