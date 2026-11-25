import swTypeScript from "../worker/sw.ts?raw";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { serviceWorkerAddress } from "./serviceWorker";

// The browser gets the compiled file, so the harness reads the compiled file too.
const swSource = ts.transpileModule(swTypeScript, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;

const ORIGIN = "https://app.test";
const BASE = `${ORIGIN}/furmony-gallery`;
const ROOT = `${BASE}/`;
const ASSET = `${BASE}/assets/main-BUcNlnNG.js`;
const LIST = `${BASE}/precache.json`;
const API = "https://apo.furmony.com/adopt/entrustAdopt/list";

const CARD =
  "https://cdn.myqcloud.com/pic/1.png?sign=old&imageMogr2/thumbnail/600x%3E";

const DOWN = new Error("no network");

interface FakeResponse {
  ok: boolean;
  status: number;
  type: string;
  body: string;
  clone(): FakeResponse;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

interface FakeRequest {
  method: string;
  url: string;
  mode: string;
  destination: string;
}

const reply = (
  body: string,
  init: { status?: number; type?: string } = {},
): FakeResponse => {
  const status = init.status ?? 200;
  const type = init.type ?? "basic";
  return {
    ok: status >= 200 && status < 400,
    status,
    type,
    body,
    clone: () => reply(body, { status, type }),
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  };
};

const request = (
  url: string,
  init: Partial<FakeRequest> = {},
): FakeRequest => ({
  method: "GET",
  url,
  mode: "cors",
  destination: "",
  ...init,
});

const navigate = (url: string): FakeRequest =>
  request(url, { mode: "navigate" });
const picture = (url: string): FakeRequest =>
  request(url, { destination: "image" });

// Storage that behaves like CacheStorage: named caches holding URL to response.
function fakeStorage() {
  const stores = new Map<string, Map<string, FakeResponse>>();
  const find = async (key: string) => {
    for (const entries of stores.values()) {
      const hit = entries.get(key);
      if (hit) return hit;
    }
    return undefined;
  };
  return {
    stores,
    caches: {
      open: async (name: string) => {
        const entries = stores.get(name) ?? new Map<string, FakeResponse>();
        stores.set(name, entries);
        return {
          match: async (key: string) => entries.get(key),
          put: async (key: string, value: FakeResponse) =>
            void entries.set(key, value),
          keys: async () => [...entries.keys()].map((url) => ({ url })),
          delete: async (key: string) => entries.delete(key),
        };
      },
      match: find,
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
  };
}

// The worker is a script the browser runs on its own, so the cases evaluate its source against a
// stand-in global. Its network is exactly the URLs listed here; anything else cannot be reached.
function worker(net: Record<string, FakeResponse | Error | Promise<never>>) {
  const asked: string[] = [];
  const modes: string[] = [];
  const calls: string[] = [];
  const { stores, caches } = fakeStorage();
  const handled = new Map<string, ((event: unknown) => void)[]>();
  const on = (type: string, event: unknown): void => {
    for (const listener of handled.get(type) ?? []) listener(event);
  };

  new Function("self", "caches", "fetch", swSource)(
    {
      location: new URL(`${BASE}/sw.js`),
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        void handled.set(type, [...(handled.get(type) ?? []), listener]),
      skipWaiting: () => void calls.push("skipWaiting"),
      clients: { claim: () => Promise.resolve() },
    },
    caches,
    async (sent: string | FakeRequest, init?: { cache?: string }) => {
      const url = typeof sent === "string" ? sent : sent.url;
      asked.push(url);
      modes.push(init?.cache ?? "");
      const hit = net[url];
      if (!hit) throw new Error(`nothing routes ${url}`);
      // A connection that holds the request open and answers nothing.
      if (hit instanceof Promise) return hit;
      if (hit instanceof Error) throw hit;
      return hit.clone();
    },
  );

  // An event the worker was told to handle, settled once its waitUntil promise settles.
  const fire = async (type: string, extra: object = {}) => {
    let waited: Promise<unknown> = Promise.resolve();
    on(type, {
      waitUntil: (settled: Promise<unknown>) => (waited = settled),
      ...extra,
    });
    await waited;
  };

  return {
    asked,
    modes,
    calls,
    stores,
    /** `undefined` is the answer for a request the worker leaves to the browser. */
    serve: async (req: FakeRequest): Promise<FakeResponse | undefined> => {
      let answered: Promise<FakeResponse> | undefined;
      on("fetch", {
        request: req,
        respondWith: (promise: Promise<FakeResponse>) => (answered = promise),
      });
      return answered;
    },
    install: () => fire("install"),
    activate: async () => {
      await fire("activate");
      return [...stores.keys()];
    },
  };
}

describe("serviceWorkerAddress", () => {
  test("the subpath survives, because a worker cannot control paths above itself", () => {
    expect(
      serviceWorkerAddress(
        "/furmony-gallery",
        "https://wanderingmeow.github.io",
      ),
    ).toEqual({
      url: "https://wanderingmeow.github.io/furmony-gallery/sw.js",
      scope: "https://wanderingmeow.github.io/furmony-gallery/",
    });
  });

  test("a base that already ends in a slash does not get a second one", () => {
    expect(serviceWorkerAddress("/furmony-gallery/", ORIGIN).scope).toBe(ROOT);
  });

  test("an app served at the domain root keeps that root", () => {
    expect(serviceWorkerAddress("/", ORIGIN)).toEqual({
      url: `${ORIGIN}/sw.js`,
      scope: `${ORIGIN}/`,
    });
  });
});

describe("the worker's own life", () => {
  test("an install takes effect without waiting for the old worker to be let go", async () => {
    const w = worker({ [ROOT]: reply("<html>") });
    await w.install();
    expect(w.calls).toEqual(["skipWaiting"]);
  });

  // Every project page of one account shares an origin and a CacheStorage, so cleanup reaches names
  // this worker never wrote unless it keeps to its own prefix.
  test("activate clears our own old version and leaves another project alone", async () => {
    const w = worker({ [ASSET]: reply("code"), [ROOT]: reply("<html>") });
    await w.serve(navigate(ROOT));
    await w.serve(request(ASSET));
    w.stores.set("puzzles-v1", new Map([["gone", reply("old")]]));
    // A page still open from the previous deploy reaches for the chunk kept here.
    w.stores.set("furmony-assets-v0", new Map([["chunk", reply("old")]]));
    expect(await w.activate()).toEqual([
      "furmony-document-v1",
      "furmony-assets-v1",
      "puzzles-v1",
      "furmony-assets-v0",
    ]);
  });

  test("an install caches every file the build listed", async () => {
    const sheet = `${BASE}/assets/sheet-DxY2aQ.css`;
    const w = worker({
      [ROOT]: reply("<html>"),
      [LIST]: reply(
        JSON.stringify(["assets/main-BUcNlnNG.js", "assets/sheet-DxY2aQ.css"]),
      ),
      [sheet]: reply("layout"),
      [ASSET]: reply("code"),
    });
    await w.install();
    expect(w.stores.get("furmony-document-v1")?.has(ROOT)).toBe(true);
    // They download together, so which lands first is not a fact worth asserting.
    expect(
      [...(w.stores.get("furmony-assets-v1")?.keys() ?? [])].sort(),
    ).toEqual([sheet, ASSET].sort());
    // Names are written relative to the list, so a build under a sub-path stays under it.
    expect(w.asked).toContain(sheet);
  });

  test("a file the worker already holds is not asked for a second time", async () => {
    const w = worker({
      [ROOT]: reply("<html>"),
      [LIST]: reply(JSON.stringify(["assets/main-BUcNlnNG.js"])),
      [ASSET]: reply("code"),
    });
    await w.install();
    await w.install();
    expect(w.asked.filter((url) => url === ASSET)).toEqual([ASSET]);
  });

  test("a build that lists nothing still leaves a worker standing", async () => {
    const w = worker({
      [ROOT]: reply("<html>"),
      [LIST]: new Error("no list"),
      [ASSET]: reply("code"),
    });
    await w.install();
    expect(w.calls).toEqual(["skipWaiting"]);
    expect(w.stores.get("furmony-document-v1")?.has(ROOT)).toBe(true);
  });
});

describe("a repeat visit with no network", () => {
  test("a hashed asset is asked for once and then comes out of storage", async () => {
    const w = worker({ [ASSET]: reply("code") });
    expect((await w.serve(request(ASSET)))?.body).toBe("code");
    expect((await w.serve(request(ASSET)))?.body).toBe("code");
    expect(w.asked).toEqual([ASSET]);
  });

  test("a name the build did not hash is read again while the network is up", async () => {
    const icon = `${BASE}/icon-maskable-512.png`;
    const w = worker({ [icon]: reply("bytes") });
    await w.serve(request(icon));
    await w.serve(request(icon));
    expect(w.asked).toEqual([icon, icon]);
  });

  test("the document is asked for again every time the network answers", async () => {
    const w = worker({ [ROOT]: reply("<html>") });
    await w.serve(navigate(ROOT));
    await w.serve(navigate(ROOT));
    expect(w.asked).toEqual([ROOT, ROOT]);
  });

  test("a deep link is stored even though Pages answers it with 404", async () => {
    const deep = `${BASE}/detail/7`;
    const w = worker({ [deep]: reply("<html>", { status: 404 }) });
    expect((await w.serve(navigate(deep)))?.status).toBe(404);
    expect(w.stores.get("furmony-document-v1")?.has(ROOT)).toBe(true);
  });

  test("offline, the stored document answers a route that was never visited", async () => {
    const first = worker({ [ROOT]: reply("<html>") });
    await first.serve(navigate(ROOT));

    const later = worker({ [ROOT]: DOWN });
    later.stores.set(
      "furmony-document-v1",
      new Map(first.stores.get("furmony-document-v1")),
    );
    expect((await later.serve(navigate(`${BASE}/stats`)))?.body).toBe("<html>");
  });

  // Pages answers a read with max-age=600: from the HTTP cache that answer is the previous deploy's
  // document, with that deploy's file names inside it.
  test("a read of the document goes to the network and not to the HTTP cache", async () => {
    const w = worker({ [ROOT]: reply("<html>"), [ASSET]: reply("code") });
    await w.serve(navigate(ROOT));
    expect(w.modes).toEqual(["no-cache"]);
  });

  // The limit is read out of the worker's own source, because this case waits it out for real.
  const stalled = (): number =>
    Number(/const STALL_MS = ([\d.eE+]+);/.exec(swSource)?.[1] ?? 0);

  test(
    "a stalled network gives the stored document its turn",
    async () => {
      const deep = `${BASE}/stats`;
      const w = worker({ [deep]: new Promise<never>(() => {}) });
      w.stores.set("furmony-document-v1", new Map([[ROOT, reply("<html>")]]));
      const served = w.serve(navigate(deep));
      await new Promise((done) => setTimeout(done, stalled() + 50));
      expect((await served)?.body).toBe("<html>");
    },
    stalled() + 800,
  );

  test("a cross-origin picture is left to the browser, which holds the host's freshness rules", async () => {
    const w = worker({ [CARD]: reply("bytes") });
    expect(await w.serve(picture(CARD))).toBeUndefined();
    expect(w.stores.size).toBe(0);
    expect(w.asked).toEqual([]);
  });

  test("the listing API is left to the network, which is where IndexedDB already covers it", async () => {
    const w = worker({ [API]: reply(`{"rows":[]}`) });
    expect(await w.serve(request(API))).toBeUndefined();
    expect(w.stores.size).toBe(0);
    expect(w.asked).toEqual([]);
  });

  test("a dev server module is left to the dev server, which renames them at will", async () => {
    const dep = `${BASE}/node_modules/.vite/deps/solid-js_web.js?v=148b1cbd`;
    const w = worker({ [dep]: reply("code") });
    expect(await w.serve(request(dep))).toBeUndefined();
    expect(w.stores.size).toBe(0);
    expect(w.asked).toEqual([]);
  });

  test("a request that is not a read is left to the browser", async () => {
    const w = worker({ [ROOT]: reply("<html>") });
    expect(await w.serve(request(ROOT, { method: "POST" }))).toBeUndefined();
  });
});
