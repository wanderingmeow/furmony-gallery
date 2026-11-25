/// <reference lib="webworker" />

// src/worker/sw.ts - the source of sw.js: the offline shell, and the card a push leaves on the
// screen. `vite.config.ts` compiles this file; nothing else runs it.
// A stored document names the files of the deploy it came from, so it is served only when the
// network is gone.
const VERSION = 1;

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// CacheStorage is keyed by origin, which every project page of one account shares.
const prefix = "furmony-";
const ASSETS = `${prefix}assets-v${VERSION}`;
const DOCUMENT = `${prefix}document-v${VERSION}`;

// One version stays behind: a document from the previous deploy still asks for that deploy's files.
const retired = (name: string): boolean => {
  if (!name.startsWith(prefix)) return false;
  const found = /-v(\d+)$/.exec(name);
  return found !== null && Number(found[1]) < VERSION - 1;
};

// The worker's scope, and the one key every route's document is stored under.
const root = new URL("./", self.location.href).href;

// Only this directory holds content-hashed names, so a name under it cannot change bytes.
const assetDir = new URL("assets/", self.location.href).pathname;
const hashed = (url: string): boolean =>
  new URL(url).pathname.startsWith(assetDir);

const store = (name: string, key: string, response: Response): Promise<void> =>
  caches
    .open(name)
    .then((cache) => cache.put(key, response.clone())) as Promise<void>;

// A stalled request never fails, so the stored copy behind it would never get its turn.
const STALL_MS = 3000;

// Pages answers a read with max-age=600, so a plain fetch can return a stale document.
const fromNetwork = (request: RequestInfo): Promise<Response> =>
  new Promise((done, fail) => {
    const idle = setTimeout(
      () => fail(new Error("the network did not answer")),
      STALL_MS,
    );
    const settle =
      (go: (value: Response) => void) =>
      (value: Response): void => {
        clearTimeout(idle);
        go(value);
      };
    fetch(request, { cache: "no-cache" }).then(settle(done), settle(fail));
  });

const networkFirst = async (
  request: RequestInfo,
  name: string,
  key: string,
): Promise<Response> => {
  try {
    const response = await fromNetwork(request);
    // Pages answers a deep link with 404 and the app inside the body.
    if (response.ok || response.status === 404) void store(name, key, response);
    return response;
  } catch {
    const saved = await caches.match(key);
    if (saved) return saved;
    throw new Error(`offline, and nothing was saved for ${key}`);
  }
};

const cacheFirst = (
  request: RequestInfo,
  name: string,
  key: string,
): Promise<Response> =>
  caches.match(key).then(
    (saved) =>
      saved ??
      fetch(request).then((response) => {
        if (response.ok) void store(name, key, response);
        return response;
      }),
  );

const remember = (url: string): Promise<unknown> =>
  cacheFirst(url, hashed(url) ? ASSETS : DOCUMENT, url).catch(() => undefined);

// What the build writes beside this worker.
const listFile = new URL("precache.json", self.location.href).href;

// An install that fails leaves the browser with no worker at all, so nothing here may throw.
const precache = async (): Promise<void> => {
  const shell = await fetch(root, { cache: "reload" });
  if (shell.ok || shell.status === 404) await store(DOCUMENT, root, shell);
  const names: string[] = await fetch(listFile, { cache: "reload" })
    .then((found) => (found.ok ? found.json() : []))
    .catch(() => []);
  await Promise.all(
    names.map((name) => remember(new URL(name, listFile).href)),
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    precache()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter(retired).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, DOCUMENT, root));
    return;
  }
  // A dev server renames these whenever it re-bundles its dependencies.
  if (new URL(request.url).pathname.includes("/node_modules/")) return;
  // Other hosts set their own freshness; a second copy here would need its own expiry.
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    hashed(request.url)
      ? cacheFirst(request, ASSETS, request.url)
      : networkFirst(request, DOCUMENT, request.url),
  );
});

// The worker shows the wording the service wrote and writes none of its own.
const ICON = new URL("icon-192.png", self.location.href).href;

// No `badge` field: Android needs a flat white silhouette, and this build has none.

// What the wire said about how many listings moved. The number counts listings, not cards, and
// each card carries its own count, so the cards are the record a woken worker reads.
interface Words {
  body?: string;
  count?: unknown;
  lang?: string;
  tag?: string;
  title?: string;
  url?: string;
}

// `setAppBadge` takes a non-negative integer, and a throw here takes the push handler with it.
const asCount = (value: unknown): number => {
  const whole = Math.trunc(Number(value));
  return Number.isFinite(whole) && whole > 0 ? whole : 0;
};

// Badging is missing from the worker types, and a browser without an installed app has no method.
// A bare number is the one argument both the first and the current spelling of the option accept.
interface Badgeable {
  setAppBadge?(contents?: number): Promise<unknown>;
  clearAppBadge?(): Promise<unknown>;
}

const badge = (): Promise<unknown> => {
  const held = self.registration as ServiceWorkerRegistration & Badgeable;
  if (!held.setAppBadge) return Promise.resolve();
  return held.getNotifications().then((shown) => {
    const total = shown.reduce(
      (sum, one) => sum + asCount((one.data as Words | undefined)?.count),
      0,
    );
    return total > 0 ? held.setAppBadge?.(total) : held.clearAppBadge?.();
  });
};

// A payload that is not json is shown as it arrived: a card that never appears cannot be read.
const said = (data: PushMessageData | null): Words => {
  if (!data) return {};
  try {
    return data.json() as Words;
  } catch {
    return { title: "", body: data.text() };
  }
};

self.addEventListener("push", (event) => {
  const words = said(event.data);
  if (!words.title && !words.body) return;
  event.waitUntil(
    self.registration
      .showNotification(words.title ?? "", {
        body: words.body ?? "",
        // One card per kind, replaced by the next, so a rotation cannot leave two copies.
        tag: words.tag ?? "furmony",
        icon: ICON,
        // `zh_tw` is this page's own id; a platform reads a language tag with a hyphen in it.
        lang: (words.lang ?? "zh").replace("_", "-"),
        data: { url: words.url ?? root, count: asCount(words.count) },
      })
      .then(badge),
  );
});

// A card dismissed by hand stops standing for anything, and the number follows it down.
self.addEventListener("notificationclose", (event) => {
  event.waitUntil(badge());
});

// `type: "window"` asks for a window, while the types answer with the wider `Client`.
const pages = (): Promise<WindowClient[]> =>
  self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  }) as Promise<WindowClient[]>;

// One window per app: the reader tapped a card, not a request for another tab.
const visit = async (target: string): Promise<void> => {
  const open = (await pages()).find((one) => one.url.startsWith(root));
  if (!open) {
    await self.clients.openWindow(target);
    return;
  }
  await open.focus();
  if (open.url === target) return;
  // Navigating the open window opens the listing as a link would, back button included.
  try {
    await open.navigate(target);
  } catch {
    await self.clients.openWindow(target);
  }
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as Words | undefined)?.url ?? root;
  event.waitUntil(visit(target).then(badge));
});

// The new address needs the reader's picks and the service's address, neither of which is here.
const askThePage = (): Promise<unknown> =>
  pages().then((all) =>
    Promise.all(all.map((one) => one.postMessage({ type: "push:rotate" }))),
  );

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(askThePage());
});

// Opening the page is how the news gets read: the cards and the number go together.
self.addEventListener("message", (event) => {
  const seen = (event.data as { type?: string } | null)?.type;
  if (seen !== "push:seen") return;
  event.waitUntil(
    self.registration
      .getNotifications()
      .then((shown) => shown.map((one) => one.close()))
      .then(() => badge()),
  );
});
