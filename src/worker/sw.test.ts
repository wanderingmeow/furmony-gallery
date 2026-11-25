import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { bundleWorker } from "../../workerBundle";

// The browser gets one bundled file, so the harness runs one bundled file.
let swSource = "";

beforeAll(async () => {
  swSource = await bundleWorker();
}, 60_000);

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
    // A real Response rejects `json()` when the body is not json, which the worker reads as an
    // empty entry.
    json: () => {
      try {
        return Promise.resolve(JSON.parse(body));
      } catch (err) {
        return Promise.reject(err);
      }
    },
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

// Storage that behaves like CacheStorage: named caches holding URL to response. A read hands back
// a copy, because a body can be read once and the worker reads it on every event.
function fakeStorage(
  owned?: Map<string, Map<string, FakeResponse>>,
  origin = ORIGIN,
) {
  const stores = owned ?? new Map<string, Map<string, FakeResponse>>();
  const copy = (found: FakeResponse | undefined) => found?.clone();
  // A cache only holds names from the worker's own origin, so the fake rejects a foreign key the
  // way a browser does. Without that check, no test could see a bad key.
  const sameOrigin = (key: string): void => {
    if (new URL(key).origin !== origin) {
      throw new TypeError(`cache key is not same-origin: ${key}`);
    }
  };
  const find = async (key: string) => {
    for (const entries of stores.values()) {
      const hit = copy(entries.get(key));
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
          match: async (key: string) => copy(entries.get(key)),
          put: async (key: string, value: FakeResponse) => {
            sameOrigin(key);
            entries.set(key, value);
          },
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
interface Kit {
  /** Which holder carries the badging method. */
  badge?: "navigator" | "registration" | "none";
  /** A card list that comes back empty. */
  emptyList?: boolean;
  /** A card list whose read fails. */
  failList?: boolean;
  /** Storage left by an earlier worker: the tally has to outlive the instance that wrote it. */
  stores?: Map<string, Map<string, FakeResponse>>;
  /** Cards an earlier worker showed, so a second instance sees the same tray. */
  cards?: Card[];
  /** Storage that refuses to open: the number must still go away when the page is opened. */
  failStore?: boolean;
}

// A card as the platform hands one back: the payload's own data, and a way to put it away.
interface Card {
  tag: string;
  data?: unknown;
  lang?: string;
  close(): Promise<void>;
}

// stand-in global. Its network is exactly the URLs listed here; anything else cannot be reached.
function worker(
  net: Record<string, FakeResponse | Error | Promise<never>>,
  kit: Kit = {},
) {
  const asked: string[] = [];
  const modes: string[] = [];
  const calls: string[] = [];
  const badges: (number | "clear")[] = [];
  const shown: string[] = [];
  const opened: string[] = [];
  const cards: Card[] = kit.cards ?? [];
  const where = kit.badge ?? "navigator";
  const bager = {
    setAppBadge: (contents: number) => {
      badges.push(contents);
      return Promise.resolve();
    },
    clearAppBadge: () => {
      badges.push("clear");
      return Promise.resolve();
    },
  };
  const registration = {
    showNotification: (
      title: string,
      opt: { data?: unknown; lang?: string; tag?: string },
    ) => {
      shown.push(title);
      const card: Card = {
        tag: opt?.tag ?? "",
        data: opt?.data,
        lang: opt?.lang,
        close: () => {
          const at = cards.indexOf(card);
          if (at >= 0) cards.splice(at, 1);
          return Promise.resolve();
        },
      };
      cards.push(card);
      return Promise.resolve();
    },
    getNotifications: () =>
      kit.failList
        ? Promise.reject(new Error("no list"))
        : Promise.resolve(kit.emptyList ? [] : [...cards]),
    ...(where === "registration" ? bager : {}),
  };
  const { stores, caches } = fakeStorage(kit.stores);
  const storage = kit.failStore
    ? { ...caches, open: () => Promise.reject(new Error("no storage")) }
    : caches;
  const handled = new Map<string, ((event: unknown) => void)[]>();
  const on = (type: string, event: unknown): void => {
    for (const listener of handled.get(type) ?? []) listener(event);
  };

  new Function("self", "caches", "fetch", "Response", swSource)(
    {
      location: new URL(`${BASE}/sw.js`),
      addEventListener: (type: string, listener: (event: unknown) => void) =>
        void handled.set(type, [...(handled.get(type) ?? []), listener]),
      skipWaiting: () => void calls.push("skipWaiting"),
      clients: {
        claim: () => Promise.resolve(),
        matchAll: () => Promise.resolve([]),
        openWindow: (url: string) => Promise.resolve(opened.push(url)),
      },
      registration,
      navigator: where === "navigator" ? bager : {},
    },
    storage,
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
    // The tally is written as a Response, which is the only thing a cache holds.
    Response,
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
    fire,
    badges,
    shown,
    cards,
    opened,
    /**
     * The card the platform puts in a handler's hand. It is the very object the tray holds, so
     * closing it takes it out of the list the way a browser does: a card the reader is done with
     * must not come back when the tally is rebuilt from that list.
     */
    notice: (tag: string, count: number): Card =>
      cards.find((one) => one.tag === tag) ?? {
        tag,
        data: { url: ROOT, count },
        close: () => Promise.resolve(),
      },
    push: (words: Record<string, unknown>) =>
      fire("push", {
        data: { json: () => words, text: () => JSON.stringify(words) },
      }),
    activate: async () => {
      await fire("activate");
      return [...stores.keys()];
    },
  };
}

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
    // The tally of notifications is not a copy of any deploy's files, so no version retires it.
    w.stores.set(
      "furmony-notifications",
      new Map([[`${ROOT}notifications.tally`, reply('{"a":1}')]]),
    );
    expect(await w.activate()).toEqual([
      "furmony-document-v1",
      "furmony-assets-v1",
      "puzzles-v1",
      "furmony-assets-v0",
      "furmony-notifications",
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

  // The limit is read out of the worker's own source, because this case waits it out for real. The
  // source file is the one read here: vitest asks for the ceiling before the bundle exists.
  const stalled = (): number =>
    Number(
      /const STALL_MS = ([\d.eE+]+)/.exec(
        readFileSync("src/worker/shell.ts", "utf8"),
      )?.[1] ?? 0,
    );

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

describe("the card a push leaves", () => {
  // The service names a language for every subscription. A payload without one is an operator's
  // own send, and `zh` is the language the site itself defaults to (src/i18n/apiLanguage.ts).
  test("a payload with no language is shown in Chinese", async () => {
    const w = worker({});
    await w.push({ title: "new", body: "2 listings moved" });
    expect(w.cards[0]?.lang).toBe("zh");
  });

  // The service writes `zh_tw`; a platform reads a language tag with a hyphen in it.
  test("the language the service wrote is the one the card carries", async () => {
    const w = worker({});
    await w.push({ title: "新設定", lang: "zh_tw" });
    expect(w.cards[0]?.lang).toBe("zh-tw");
  });
});

describe("the number on the icon", () => {
  test("a card that says three listings moved puts three on the icon", async () => {
    const w = worker({});
    await w.push({ title: "新设定", body: "3 个", count: 3 });
    expect(w.badges).toEqual([3]);
  });

  test("a browser that only carries the older registration spelling gets its number too", async () => {
    const w = worker({}, { badge: "registration" });
    await w.push({ title: "新设定", count: 2 });
    expect(w.badges).toEqual([2]);
  });

  test("a worker with no badging method still shows the card", async () => {
    const w = worker({}, { badge: "none" });
    await w.push({ title: "新设定", count: 4 });
    expect(w.shown).toEqual(["新设定"]);
    expect(w.badges).toEqual([]);
  });

  test("clearing the number is a call, not a missing argument", async () => {
    const w = worker({});
    await w.push({ title: "新设定", body: "没有数目" });
    expect(w.badges).toEqual(["clear"]);
  });

  test("a card list that comes back empty keeps the number the push carried", async () => {
    const w = worker({}, { emptyList: true });
    await w.push({ title: "新设定", count: 5 });
    expect(w.badges).toEqual([5]);
  });

  test("a card list whose read fails keeps the number the push carried", async () => {
    const w = worker({}, { failList: true });
    await w.push({ title: "新设定", count: 6 });
    expect(w.badges).toEqual([6]);
  });

  test("a card dismissed by hand lowers the number", async () => {
    const w = worker({});
    await w.push({ title: "新设定", tag: "furmony-lock-09", count: 2 });
    w.cards.length = 0;
    await w.fire("notificationclose", {
      notification: w.notice("furmony-lock-09", 2),
    });
    expect(w.badges).toEqual([2, "clear"]);
  });

  // The service names each card after the round that sent it, so two rounds are two cards.
  test("two cards from two rounds add up instead of the later one replacing the total", async () => {
    const w = worker({});
    await w.push({ title: "新设定", tag: "furmony-new-08", count: 2 });
    await w.push({ title: "锁定变更", tag: "furmony-lock-09", count: 3 });
    expect(w.badges).toEqual([2, 5]);
  });
});

describe("the tally the number is built from", () => {
  // The reader's own sequence, one hour to the next: one listing at 8, two locks and one new
  // listing at 9, a tap on the lock card at 9:30, one unlock at 10, the page opened at 10:30.
  test("a day of news stacks up card by card and goes at once on opening", async () => {
    const w = worker({});
    await w.push({ title: "上新", tag: "furmony-new-08", count: 1 });
    await w.push({ title: "锁定", tag: "furmony-lock-09", count: 2 });
    await w.push({ title: "上新", tag: "furmony-new-09", count: 1 });
    expect(w.badges).toEqual([1, 3, 4]);
    await w.fire("notificationclick", {
      notification: w.notice("furmony-lock-09", 2),
    });
    expect(w.badges).toEqual([1, 3, 4, 2]);
    await w.push({ title: "锁定", tag: "furmony-lock-10", count: 1 });
    expect(w.badges).toEqual([1, 3, 4, 2, 3]);
    await w.fire("message", { data: { type: "push:seen" } });
    expect(w.badges).toEqual([1, 3, 4, 2, 3, "clear"]);
    expect(w.cards).toEqual([]);
  });

  // The same round reaching the same device twice is one card, which is what the tag is for.
  test("the same card sent twice counts once", async () => {
    const w = worker({});
    await w.push({ title: "测试", tag: "furmony-test", count: 2 });
    await w.push({ title: "测试", tag: "furmony-test", count: 2 });
    expect(w.badges).toEqual([2, 2]);
  });

  // The welcome card says notifications work and counts nothing: twenty of them must not crowd
  // the other notifications out of the tally.
  test("a card with no number takes no room in the tally", async () => {
    const w = worker({});
    for (let n = 0; n < 25; n += 1) {
      await w.push({ title: "通知已开启", tag: "furmony-welcome" });
    }
    await w.push({ title: "上新", tag: "furmony-new-08", count: 3 });
    expect(w.badges.at(-1)).toBe(3);
  });

  test("a tally that is full keeps the newer cards", async () => {
    const w = worker({});
    for (let n = 1; n <= 22; n += 1) {
      await w.push({ title: `第${n}张`, tag: `t${n}`, count: 1 });
    }
    expect(w.badges.at(-1)).toBe(20);
  });

  test("a card dismissed while the worker was asleep comes off at the next push", async () => {
    const w = worker({});
    await w.push({ title: "上新", tag: "furmony-new-08", count: 1 });
    await w.push({ title: "上新", tag: "furmony-new-09", count: 4 });
    expect(w.badges).toEqual([1, 5]);
    w.cards.splice(0, 1);
    await w.push({ title: "锁定", tag: "furmony-lock-10", count: 2 });
    expect(w.badges).toEqual([1, 5, 6]);
  });

  test("a list that comes back empty leaves the tally where it was", async () => {
    const w = worker({}, { emptyList: true });
    await w.push({ title: "上新", tag: "furmony-new-08", count: 2 });
    await w.push({ title: "上新", tag: "furmony-new-09", count: 3 });
    expect(w.badges).toEqual([2, 5]);
  });

  test("a tally that cannot be read falls back to the number this push carried", async () => {
    const w = worker({});
    w.stores.set(
      "furmony-notifications",
      new Map([[`${ROOT}notifications.tally`, reply("not json")]]),
    );
    await w.push({ title: "上新", tag: "furmony-new-08", count: 7 });
    expect(w.badges).toEqual([7]);
    const stored = await w.stores
      .get("furmony-notifications")
      ?.get(`${ROOT}notifications.tally`)
      ?.text();
    expect(JSON.parse(stored ?? "")).toEqual({ "furmony-new-08": 7 });
  });

  test("the tally outlives the worker that wrote it", async () => {
    const first = worker({});
    await first.push({ title: "上新", tag: "furmony-new-08", count: 2 });
    const again = worker({}, { stores: first.stores, cards: first.cards });
    await again.push({ title: "上新", tag: "furmony-new-09", count: 3 });
    expect(again.badges).toEqual([5]);
  });

  test("opening the page clears the number when storage is gone", async () => {
    const w = worker({}, { failStore: true });
    await w.push({ title: "上新", tag: "furmony-new-08", count: 4 });
    expect(w.badges).toEqual([4]);
    await w.fire("message", { data: { type: "push:seen" } });
    expect(w.badges).toEqual([4, "clear"]);
  });

  test("a tap opens the listing the card was sent with", async () => {
    const w = worker({});
    await w.push({
      title: "上新",
      tag: "furmony-new-08",
      count: 1,
      url: `${ROOT}detail/2481`,
    });
    await w.fire("notificationclick", {
      notification: w.notice("furmony-new-08", 1),
    });
    expect(w.opened).toEqual([`${ROOT}detail/2481`]);
  });
});
