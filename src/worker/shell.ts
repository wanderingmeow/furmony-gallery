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

// A body is read once, and opening a cache is a step: the caller hands over a copy, not the response
// the page is about to paint with. The install writes through here, before the list is held.
const put = (name: string, key: string, copy: Response): Promise<void> =>
  caches.open(name).then((cache) => cache.put(key, copy)) as Promise<void>;

// A list is a list of names or it is no list at all.
const names = (body: unknown): body is string[] =>
  Array.isArray(body) && body.every((one) => typeof one === "string");

// The names sit under the list, so a build under a sub-path stays under it. A name that walks out
// of this directory is not one of this deploy's files, and `caches.put` takes a same-origin URL
// only: a foreign one throws before it is stored.
const addresses = (list: string[]): string[] =>
  list.flatMap((name) => {
    try {
      const at = new URL(name, listFile);
      return at.href.startsWith(root) ? [at.href] : [];
    } catch {
      return [];
    }
  });

// What the build ships is what the caches hold: the same set covers both what may be written and
// what may stay.
const shipped = async (): Promise<Set<string>> => {
  const found = await caches.match(listFile);
  if (!found) return new Set();
  const body: unknown = await found.json().catch(() => null);
  if (!names(body)) return new Set();
  // One key behind the document serves every route, and the list is what the next install reads.
  return new Set([...addresses(body), root, listFile]);
};

const storeIfShipped = async (
  name: string,
  key: string,
  copy: Response,
): Promise<void> => {
  if (name === DOCUMENT && !(await shipped()).has(key)) return;
  await put(name, key, copy);
};

const empty = async (name: string): Promise<void> => {
  const cache = await caches.open(name);
  const held = await cache.keys();
  await Promise.all(held.map((one) => cache.delete(one.url)));
};

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
    if (response.ok || response.status === 404)
      void storeIfShipped(name, key, response.clone());
    return response;
  } catch {
    const saved = await caches.match(key);
    if (saved) return saved;
    throw new Error(`offline, and nothing was saved for ${key}`);
  }
};

const cacheFirst = async (
  request: RequestInfo,
  name: string,
  key: string,
): Promise<Response> => {
  const saved = await caches.match(key);
  if (saved) return saved;
  const found = await fetch(request);
  if (found.ok) void storeIfShipped(name, key, found.clone());
  return found;
};

// The write is waited for: the worker can be stopped the moment the install step ends, and a file
// still on its way to storage would be missing on the first visit with no network. Nobody else reads
// this body, so it goes in as it stands.
const remember = async (url: string): Promise<unknown> => {
  const name = hashed(url) ? ASSETS : DOCUMENT;
  try {
    if (await caches.match(url)) return undefined;
    const found = await fetch(url);
    if (found.ok) await put(name, url, found);
  } catch {
    // One file that cannot be had is not worth losing the whole install over.
  }
};

// Pruning costs a page that still runs the previous deploy: it cannot reach a chunk this build never
// named, so it reloads once a newer worker takes over.
const onlyThese = async (name: string, urls: string[]): Promise<void> => {
  const cache = await caches.open(name);
  const wanted = new Set(urls);
  const held = await cache.keys();
  await Promise.all(
    held
      .filter((one) => !wanted.has(one.url))
      .map((one) => cache.delete(one.url)),
  );
};

// An install that fails leaves the browser with no worker at all, so nothing here may throw.
export const precache = async (): Promise<void> => {
  const list = await fetch(listFile, { cache: "reload" }).catch(() => null);
  // A read that did not reach us, or did not succeed, says nothing about this build: what is held
  // stays. Pages answers a missing file with 404 and its own document inside.
  if (!list?.ok) return;
  // The copy is taken before the body is read, and the list goes in before anything else: later
  // writes are checked against it.
  const held = list.clone();
  const body: unknown = await list.json().catch(() => null);
  // What parses into a list of names is the list. A dev server answers the missing file with the
  // document of its own, under a 200, and that is no list: its cache fills with modules that change
  // on the next edit.
  if (!names(body)) {
    await empty(DOCUMENT);
    return;
  }
  await put(DOCUMENT, listFile, held);
  const shell = await fetch(root, { cache: "reload" });
  if (shell.ok || shell.status === 404) await put(DOCUMENT, root, shell);
  const urls = addresses(body);
  await Promise.all(urls.map((url) => remember(url)));
  await onlyThese(ASSETS, urls);
  await onlyThese(DOCUMENT, [...(await shipped())]);
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
