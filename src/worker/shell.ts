import { listFile, root } from "./address";

// A stored document names the files of the deploy it came from. It is served only when the network
// is gone.
const VERSION = 1;

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

// An install that fails leaves the browser with no worker at all, so nothing here may throw.
export const precache = async (): Promise<void> => {
  const shell = await fetch(root, { cache: "reload" });
  if (shell.ok || shell.status === 404) await store(DOCUMENT, root, shell);
  const names: string[] = await fetch(listFile, { cache: "reload" })
    .then((found) => (found.ok ? found.json() : []))
    .catch(() => []);
  await Promise.all(
    names.map((name) => remember(new URL(name, listFile).href)),
  );
};

// What the worker answers for. `undefined` leaves the request to the browser.
export const respond = (request: Request): Promise<Response> | undefined => {
  if (request.method !== "GET") return undefined;

  if (request.mode === "navigate") return networkFirst(request, DOCUMENT, root);
  // A dev server renames these whenever it re-bundles its dependencies.
  if (new URL(request.url).pathname.includes("/node_modules/"))
    return undefined;
  // Other hosts set their own freshness; a second copy here would need its own expiry.
  if (new URL(request.url).origin !== self.location.origin) return undefined;

  return hashed(request.url)
    ? cacheFirst(request, ASSETS, request.url)
    : networkFirst(request, DOCUMENT, request.url);
};

// Caches of a deploy two versions back hold bytes that no document asks for.
export const dropRetired = (): Promise<unknown> =>
  caches
    .keys()
    .then((names) =>
      Promise.all(names.filter(retired).map((name) => caches.delete(name))),
    );
