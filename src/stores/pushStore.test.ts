import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tr } from "../i18n";
import { requestedLocale } from "../i18n/locale";

const KEY = "furmony_push";

/** The store keeps one signal for the whole page, so each test needs its own copy of it. */
async function freshStore() {
  vi.resetModules();
  return import("./pushStore");
}

function sub(endpoint = "https://push.invalid/AAA") {
  const unsubscribe = vi.fn(() => Promise.resolve(true));
  return {
    endpoint,
    unsubscribe,
    toJSON: () => ({ keys: { p256dh: "BP-key", auth: "an-auth" } }),
  };
}

type Call = { answer: string }[];

/** The browser side of the world: a worker, a subscription, and the answers the service gives. */
function fakeBrowser(options: {
  held?: ReturnType<typeof sub> | null;
  answers?: string[];
  permission?: string;
  granted?: string;
  /** A cold first visit: startup has registered, but nothing has landed yet. */
  cold?: boolean;
  /** A browser that rejects `subscribe()`, which is how a prompt answered no arrives. */
  refuse?: boolean;
  /** A browser with no service worker at all. */
  noWorker?: boolean;
  /** A browser with no `Notification` either, which is how a tab on iPhone answers. */
  noNotice?: boolean;
  /** What the worker says about this site, which can differ from the browser-wide answer. */
  state?: "granted" | "denied";
  /** The address the provider hands over afterwards, which is how a rotation arrives. */
  rotated?: ReturnType<typeof sub>;
  /** A browser that gives the page a worker with no `pushManager`. */
  noPush?: boolean;
  /** A page whose worker never arrives. */
  noRegister?: boolean;
  /** Hold the service's answer from this many answered requests onward. Reads and writes share
   *  the count, because the page is held by whichever one is in the air.
   */
  pending?: number;
  /** What the record says, one answer per read. `pending` is a record that is there but has never
   *  had a notification arrive.
   */
  record?: ("held" | "pending" | "absent" | "quiet")[];
}) {
  const held = options.held ?? null;
  const cold = options.cold ?? false;
  const answers: Call = (options.answers ?? ["live"]).map((answer) => ({
    answer,
  }));
  const sent: unknown[] = [];
  const tellService = vi.fn(async (body: Record<string, unknown>) => {
    sent.push(body);
    const next = answers.shift();
    const answer = next?.answer ?? "live";
    await gate();
    return answer;
  });
  let resolve: (() => void) | undefined;
  const told = new Promise<void>((done) => {
    resolve = done;
  });
  // Whichever request is in the air holds the switch, so both kinds share one count.
  let calls = 0;
  const gate = (): Promise<boolean> => {
    calls += 1;
    return calls > (options.pending ?? Infinity)
      ? told.then(() => true)
      : Promise.resolve(false);
  };
  const records = [...(options.record ?? ["held"])];
  const reads: unknown[] = [];
  const askSettings = vi.fn(async (endpoint: string) => {
    reads.push(endpoint);
    const said = records.shift() ?? "held";
    await gate();
    // The record agrees with what the page would send, unless a test says otherwise: the language
    // is the one this build asks for, so a boot that agrees writes nothing.
    if (said === "absent") return { at: "absent" as const };
    if (said === "quiet") return { at: "quiet" as const };
    return {
      at: "held" as const,
      prefs: { new: true, lock: true },
      lang: requestedLocale(),
      pending: said === "pending",
    };
  });
  const posted: unknown[] = [];
  const listeners: ((event: { data: unknown }) => void)[] = [];
  const subscribe = vi.fn(() =>
    options.refuse
      ? Promise.reject(new Error("NotAllowedError"))
      : Promise.resolve(options.held ?? sub()),
  );
  // A rotation is a second `subscribe()` on the same question, and the second answer holds the new
  // address.
  let asked = 0;
  const getSubscription = vi.fn(() =>
    Promise.resolve(asked++ === 0 ? held : (options.rotated ?? held)),
  );

  vi.doMock("../data/pushApi", async () => {
    const actual =
      await vi.importActual<typeof import("../data/pushApi")>(
        "../data/pushApi",
      );
    return {
      ...actual,
      pushConfigured: () => true,
      applicationKey: () => new Uint8Array(65),
      tellService,
      askSettings,
    };
  });
  const registration: Record<string, unknown> = {
    active: { postMessage: (m: unknown) => posted.push(m) },
  };
  if (!options.noPush)
    registration.pushManager = {
      getSubscription,
      subscribe,
      ...(options.state
        ? { permissionState: () => Promise.resolve(options.state) }
        : {}),
    };
  const register = vi.fn(() =>
    Promise.resolve(options.noRegister ? null : registration),
  );
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: () => Promise.resolve(cold ? undefined : registration),
      addEventListener: (_type: string, fn: (e: { data: unknown }) => void) =>
        listeners.push(fn),
    },
  });
  // The store asks the same module startup does, and development gates that call behind ?sw=1,
  // which says nothing about what the store does with the answer.
  vi.doMock("../draw/serviceWorker", () => ({ registerWorker: register }));
  // happy-dom has no `PushManager`, so the store's own check has to answer before any prompt.
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: class {},
  });
  if (options.noWorker) {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  }
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: {
      permission: options.permission ?? "granted",
      // A real browser can change the permission while the prompt is open, so the store reads it again
      // afterwards.
      requestPermission() {
        this.permission = options.granted ?? "granted";
        return Promise.resolve(this.permission);
      },
    },
  });
  if (options.noNotice)
    delete (window as { Notification?: unknown }).Notification;
  return {
    sent,
    reads,
    tellService,
    askSettings,
    posted,
    listeners,
    subscribe,
    held,
    register,
    settle: () => resolve?.(),
  };
}

beforeEach(() => {
  localStorage.removeItem(KEY);
});

afterEach(() => {
  vi.doUnmock("../data/pushApi");
  vi.doUnmock("../draw/serviceWorker");
  vi.doUnmock("./persistenceStore");
  vi.useRealTimers();
});

describe("what the switch does while a request is in the air", () => {
  it("keeps the picks to itself until the answer lands", async () => {
    const browser = fakeBrowser({ held: null, pending: 0 });
    const { turn, setPick, pushOn, pushRows } = await freshStore();
    const first = turn(true);
    await vi.waitFor(() =>
      expect(browser.tellService).toHaveBeenCalledTimes(1),
    );
    setPick("new", false);
    expect(pushOn()).toBe(true);
    expect(pushRows()).toBe(false);
    browser.settle();
    await first;
    expect(pushOn()).toBe(true);
    expect(pushRows()).toBe(true);
    expect(browser.tellService).toHaveBeenCalledTimes(1);
  });

  it("calls the switch off the moment the reader leaves, not when the service answers", async () => {
    const browser = fakeBrowser({ held: sub(), pending: 1 });
    const { loadPush, turn, pushOn, pushBusy } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushBusy()).toBe(false));
    const leaving = turn(false);
    expect(pushOn()).toBe(false);
    expect(pushBusy()).toBe(true);
    browser.settle();
    await leaving;
    expect(pushBusy()).toBe(false);
    expect(pushOn()).toBe(false);
  });
});

describe("a page that opens with the address already held", () => {
  it("reads the switch from the record and writes nothing when the record agrees", async () => {
    // The service's record is what a round sends from.
    const browser = fakeBrowser({ held: sub() });
    const { loadPush, pushOn, pushLine } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushOn()).toBe(true));
    expect(pushLine()).toBe("");
    expect(browser.tellService).not.toHaveBeenCalled();
  });

  it("says it is finding out, and keeps the two rows off the screen until it knows", async () => {
    const browser = fakeBrowser({ held: sub(), pending: 0 });
    const { loadPush, pushOn, pushRows, pushLine } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(browser.askSettings).toHaveBeenCalledTimes(1),
    );
    expect(pushLine()).toBe(tr("push.checking"));
    expect(pushOn()).toBe(true);
    expect(pushRows()).toBe(false);
    browser.settle();
    await vi.waitFor(() => expect(pushRows()).toBe(true));
  });

  it("says the browser is the one blocking when the record is on and the permission is not", async () => {
    fakeBrowser({ held: sub(), permission: "denied" });
    const { loadPush, pushOn, pushLine } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushLine()).toBe(tr("push.denied")));
    expect(pushOn()).toBe(true);
  });

  it("asks the worker about this site rather than believing the whole browser", async () => {
    // Inside an installed app on iPhone, `Notification.permission` is the app's own answer, and this
    // site's permission can be the blocked one.
    fakeBrowser({ held: sub(), permission: "granted", state: "denied" });
    const { loadPush, pushLine } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushLine()).toBe(tr("push.denied")));
  });

  it("shows the picks the record holds, not the ones this browser remembers", async () => {
    // A cleared phone or a second device leaves a copy in this browser's storage that the service
    // never wrote.
    localStorage.setItem(KEY, JSON.stringify({ new: false, lock: false }));
    fakeBrowser({ held: sub() });
    const { loadPush, pushPicks } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(pushPicks()).toEqual({ new: true, lock: true }),
    );
  });

  it("offers the address again when the record has gone", async () => {
    // The address is still the reader's, so a dropped row is offered again rather than answered by
    // turning the switch off.
    const browser = fakeBrowser({ held: sub(), record: ["absent"] });
    const { loadPush, pushOn } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(browser.tellService).toHaveBeenCalledTimes(1),
    );
    expect(browser.sent[0]).toHaveProperty("p256dh");
    await vi.waitFor(() => expect(pushOn()).toBe(true));
  });

  it("says the record is unconfirmed when the service could not reach the provider", async () => {
    fakeBrowser({ held: sub(), record: ["pending"] });
    const { loadPush, pushOn, pushLine } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushLine()).toBe(tr("push.pending")));
    expect(pushOn()).toBe(true);
  });

  it("stays on when the record did not answer, because nobody turned anything off", async () => {
    const browser = fakeBrowser({ held: sub(), record: ["quiet"] });
    const { loadPush, pushOn, pushLine } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushOn()).toBe(true));
    expect(pushLine()).toBe("");
    expect(browser.tellService).not.toHaveBeenCalled();
  });

  it("asks for the worker a cold page does not have yet", async () => {
    const browser = fakeBrowser({ held: sub(), cold: true });
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(browser.register).toHaveBeenCalled();
    expect(pushOn()).toBe(true);
    expect(pushLine()).toBe("");
  });

  it("does not register a second worker when the page already has one", async () => {
    const browser = fakeBrowser({ held: sub() });
    const { turn } = await freshStore();
    await turn(true);
    expect(browser.register).not.toHaveBeenCalled();
  });

  it("says the browser cannot when it has no service worker, not that a file failed to load", async () => {
    fakeBrowser({ held: null, noWorker: true });
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.unsupported"));
  });

  it("says the browser cannot when it gives the page a worker with no push in it", async () => {
    fakeBrowser({ held: null, noPush: true });
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.unsupported"));
  });

  it("says the module failed to load when the page cannot get a worker at all", async () => {
    fakeBrowser({ held: null, cold: true, noRegister: true });
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.broken"));
  });

  it("names converting the site on the Mac once the attempt has actually failed", async () => {
    fakeBrowser({ held: null, refuse: true });
    vi.doMock("./persistenceStore", () => ({
      onIosBrowser: () => false,
      installCapable: () => true,
    }));
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.installMacLine"));
  });

  it("says what it is doing while the answer is out", async () => {
    fakeBrowser({ held: null });
    const { turn, pushLine } = await freshStore();
    const first = turn(true);
    expect(pushLine()).toBe(tr("push.opening"));
    await first;
    expect(pushLine()).toBe("");
  });

  it("says it is closing while the browser is being left", async () => {
    fakeBrowser({ held: sub() });
    const { loadPush, turn, pushLine, pushBusy } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushBusy()).toBe(false));
    const leaving = turn(false);
    expect(pushLine()).toBe(tr("push.closing"));
    await leaving;
    expect(pushLine()).toBe("");
  });

  it("drops a flip while the page is still finding out where the switch stands", async () => {
    const browser = fakeBrowser({ held: sub(), pending: 0 });
    const { loadPush, turn, pushOn, pushBusy } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(browser.askSettings).toHaveBeenCalledTimes(1),
    );
    expect(pushBusy()).toBe(true);
    await turn(false);
    expect(browser.tellService).not.toHaveBeenCalled();
    browser.settle();
    await vi.waitFor(() => expect(pushBusy()).toBe(false));
    expect(pushOn()).toBe(true);
  });

  it("holds the switch still while the service is answering", async () => {
    const browser = fakeBrowser({ held: null });
    const { turn, pushBusy } = await freshStore();
    const first = turn(true);
    expect(pushBusy()).toBe(true);
    // Dropped, not queued: the service answers in the order it likes, and an older answer must not
    // arrive last.
    await turn(true);
    await first;
    expect(pushBusy()).toBe(false);
    expect(browser.tellService).toHaveBeenCalledTimes(1);
  });

  it("holds the switch still while the browser is being left", async () => {
    const browser = fakeBrowser({ held: sub() });
    const { loadPush, turn, pushBusy } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushBusy()).toBe(false));
    const leaving = turn(false);
    expect(pushBusy()).toBe(true);
    await turn(false);
    await leaving;
    expect(pushBusy()).toBe(false);
    expect(browser.tellService).toHaveBeenCalledTimes(1);
  });

  it("keeps the switch on and says nothing when the service has no key to sign with", async () => {
    fakeBrowser({ held: sub(), answers: ["silent"] });
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    // The browser side is done; the missing key is the operator's to install.
    expect(pushOn()).toBe(true);
    expect(pushLine()).toBe("");
  });

  it("says nothing when the browser holds nothing", async () => {
    const browser = fakeBrowser({ held: null });
    const { loadPush, pushOn } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(browser.posted.length).toBeGreaterThan(0));
    expect(pushOn()).toBe(false);
    expect(browser.tellService).not.toHaveBeenCalled();
  });

  it("tells the worker to put the number on the icon away", async () => {
    const browser = fakeBrowser({ held: null });
    const { loadPush } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(browser.posted).toContainEqual({ type: "push:seen" }),
    );
  });
});

describe("the switch", () => {
  it("asks the browser once, and pairs when the answer is yes", async () => {
    const browser = fakeBrowser({
      held: null,
      permission: "default",
      granted: "granted",
    });
    const { turn, pushOn } = await freshStore();
    await turn(true);
    expect(browser.subscribe).toHaveBeenCalled();
    expect(pushOn()).toBe(true);
  });

  it("refuses without asking twice when the browser already said no", async () => {
    const browser = fakeBrowser({ held: null, permission: "denied" });
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(browser.subscribe).not.toHaveBeenCalled();
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.denied"));
  });

  it("tells a browser with no web push that it cannot, and never opens a prompt", async () => {
    const browser = fakeBrowser({ held: null, permission: "default" });
    delete (window as { PushManager?: unknown }).PushManager;
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(browser.subscribe).not.toHaveBeenCalled();
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.unsupported"));
  });

  it("goes back off when the provider does not know the address", async () => {
    fakeBrowser({ held: null, answers: ["rejected"] });
    const { turn, pushOn, pushLine } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.rejected"));
  });

  it("leaves the browser first, then the service", async () => {
    const away = sub();
    const browser = fakeBrowser({ held: away, answers: ["gone"] });
    const { loadPush, turn, pushBusy } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(browser.askSettings).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(pushBusy()).toBe(false));

    await turn(false);
    expect(away.unsubscribe).toHaveBeenCalled();
    // The departure names the endpoint and nothing else.
    expect(browser.tellService.mock.calls[0][0]).toEqual({
      endpoint: away.endpoint,
      unsubscribe: true,
    });
  });
});

describe("the two kinds of news", () => {
  it("says it is setting the record while a pick is on its way", async () => {
    const browser = fakeBrowser({ held: sub(), pending: 1 });
    const { loadPush, setPick, pushLine, pushRows, pushBusy } =
      await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushRows()).toBe(true));
    setPick("lock", false);
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(900);
    vi.useRealTimers();
    await vi.waitFor(() => expect(pushLine()).toBe(tr("push.setting")));
    expect(pushRows()).toBe(true);
    expect(pushBusy()).toBe(true);
    browser.settle();
    await vi.waitFor(() => expect(pushLine()).toBe(""));
  });

  it("does not send a pick that was queued before the reader left", async () => {
    const browser = fakeBrowser({ held: sub() });
    const { loadPush, setPick, turn, pushRows } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushRows()).toBe(true));
    setPick("lock", false);
    await turn(false);
    await vi.waitFor(() => expect(pushRows()).toBe(false));
    browser.tellService.mockClear();
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(900);
    vi.useRealTimers();
    expect(browser.tellService).not.toHaveBeenCalled();
  });

  it("closes the switch itself when the last kind of news is turned off", async () => {
    const browser = fakeBrowser({ held: sub(), answers: ["gone"] });
    const {
      loadPush,
      setPick,
      pushOn,
      pushRows,
      pushLine,
      pushBusy,
      pushPicks,
    } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushRows()).toBe(true));
    setPick("lock", false);
    setPick("new", false);
    expect(pushOn()).toBe(false);
    expect(pushRows()).toBe(false);
    expect(pushBusy()).toBe(true);
    expect(pushLine()).toBe(tr("push.closing"));
    expect(pushPicks()).toEqual({ new: true, lock: true });
    expect(localStorage.getItem(KEY)).toBeNull();
    await vi.waitFor(() => expect(pushBusy()).toBe(false));
    expect(browser.tellService).toHaveBeenCalledTimes(1);
    expect(browser.sent[0]).toEqual({
      endpoint: "https://push.invalid/AAA",
      unsubscribe: true,
    });
  });

  it("sends the picks once, however many were flipped", async () => {
    const browser = fakeBrowser({ held: sub() });
    const { loadPush, setPick, pushBusy } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(browser.askSettings).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(pushBusy()).toBe(false));
    browser.tellService.mockClear();
    // The clock is only stopped once the opening POST has landed: `waitFor` needs a real one.
    vi.useFakeTimers();

    setPick("new", false);
    setPick("new", true);
    // The clock is moved through its promises, because the send is a chain of them: a bare
    // `advanceTimersByTime` fires the debounce and stops before the request is made.
    await vi.advanceTimersByTimeAsync(900);
    vi.useRealTimers();
    await vi.waitFor(() =>
      expect(browser.tellService).toHaveBeenCalledTimes(1),
    );
  });

  it("keeps the picks for later when the switch is off", async () => {
    const browser = fakeBrowser({ held: null });
    const { setPick, pushPicks } = await freshStore();
    vi.useFakeTimers();
    setPick("lock", false);
    vi.advanceTimersByTime(900);
    await Promise.resolve();
    expect(browser.tellService).not.toHaveBeenCalled();
    expect(pushPicks()).toEqual({ new: true, lock: false });
    expect(JSON.parse(String(localStorage.getItem(KEY)))).toEqual({
      new: true,
      lock: false,
    });
  });

  it("hears a rotated address even when the page has never read the record", async () => {
    const second = sub("https://push.invalid/BBB");
    const browser = fakeBrowser({
      held: null,
      rotated: second,
      record: ["absent"],
    });
    const { loadPush } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(browser.listeners.length).toBe(1));
    expect(browser.tellService).not.toHaveBeenCalled();

    browser.listeners[0]({ data: { type: "push:rotate" } });
    await new Promise((r) => setTimeout(r, 60));
    await new Promise((r) => setTimeout(r, 200));
    // The rotation arrived during the opening round, which asked the browser before the new address
    // existed.
    await vi.waitFor(() =>
      expect(browser.tellService).toHaveBeenCalledTimes(1),
    );
    expect((browser.sent[0] as { endpoint: string }).endpoint).toBe(
      second.endpoint,
    );
  });

  it("hears a rotated address as a reason to send again", async () => {
    const browser = fakeBrowser({ held: sub() });
    const { loadPush } = await freshStore();
    loadPush();
    await vi.waitFor(() =>
      expect(browser.askSettings).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() => expect(browser.listeners.length).toBe(1));
    browser.tellService.mockClear();

    browser.listeners[0]({ data: { type: "push:rotate" } });
    await vi.waitFor(() => expect(browser.tellService).toHaveBeenCalled());
  });

  it("ignores a message about anything else", async () => {
    const browser = fakeBrowser({ held: sub() });
    const { loadPush } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(browser.listeners.length).toBe(1));
    browser.tellService.mockClear();

    browser.listeners[0]({ data: { type: "something-else" } });
    await Promise.resolve();
    expect(browser.tellService).not.toHaveBeenCalled();
  });
});

describe("what the reader picked", () => {
  it("hears everything before they have said anything", async () => {
    fakeBrowser({ held: null });
    const { loadPush, pushPicks } = await freshStore();
    loadPush();
    expect(pushPicks()).toEqual({ new: true, lock: true });
  });

  it("keeps a no that is stored, and ignores a value that is not one", async () => {
    fakeBrowser({ held: null });
    localStorage.setItem(KEY, JSON.stringify({ new: false, lock: "yes" }));
    const { loadPush, pushPicks } = await freshStore();
    loadPush();
    expect(pushPicks()).toEqual({ new: false, lock: true });
  });

  it("starts over when the stored thing is not a pick at all", async () => {
    fakeBrowser({ held: null });
    localStorage.setItem(KEY, "{not json");
    const { loadPush, pushPicks } = await freshStore();
    loadPush();
    expect(pushPicks()).toEqual({ new: true, lock: true });
  });
});

function fakeEnv(
  onIos: boolean,
  risk: string,
  guide = "https://support.apple.test/guide",
) {
  vi.doMock("./persistenceStore", () => ({
    onIosBrowser: () => onIos,
    installCapable: () => risk === "install",
    appleGuide: () => guide,
  }));
}

describe("what an off switch says", () => {
  it("says nothing to a browser that can be woken up from a tab", async () => {
    fakeBrowser({ held: null });
    fakeEnv(false, "none");
    const { pushHint } = await freshStore();
    expect(pushHint()).toBe("");
  });

  it("names the Home Screen on iPhone and iPad", async () => {
    fakeBrowser({ held: null });
    fakeEnv(true, "install");
    const { pushHint } = await freshStore();
    expect(pushHint()).toBe(tr("push.installIosLine"));
  });

  it("says nothing up front on the Mac, where a background Safari may carry the word", async () => {
    fakeBrowser({ held: null });
    fakeEnv(false, "install");
    const { pushHint } = await freshStore();
    expect(pushHint()).toBe("");
  });

  it("keeps a permission the reader was never asked for to itself", async () => {
    fakeBrowser({ held: null, permission: "denied" });
    fakeEnv(false, "none");
    const { loadPush, pushLine, pushOn } = await freshStore();
    loadPush();
    await vi.waitFor(() => expect(pushLine()).toBe(""));
    expect(pushOn()).toBe(false);
  });

  it("reads a Push API missing from an uninstalled iPhone as the install it needs", async () => {
    // Safari gives the Push API only to an installed page, so a missing name in a tab means the
    // install is missing.
    fakeBrowser({ held: null });
    fakeEnv(true, "install");
    delete (window as { PushManager?: unknown }).PushManager;
    const { pushHint } = await freshStore();
    expect(pushHint()).toBe(tr("push.installIosLine"));
  });

  it("still names a desktop browser that has no Push API to install its way out of", async () => {
    fakeBrowser({ held: null });
    fakeEnv(false, "none");
    delete (window as { PushManager?: unknown }).PushManager;
    const { pushHint } = await freshStore();
    expect(pushHint()).toBe(tr("push.unsupported"));
  });

  it("names the install instead of opening a prompt that cannot be granted", async () => {
    fakeBrowser({ held: null, permission: "default" });
    fakeEnv(true, "install");
    delete (window as { PushManager?: unknown }).PushManager;
    const { turn, pushLine, pushOn } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.installIosLine"));
  });

  it("asks for the install where the browser keeps Notifications back too", async () => {
    // A tab on iPhone is missing the Notifications API and the Push API at the same time.
    fakeBrowser({ held: null, noNotice: true });
    fakeEnv(true, "install");
    delete (window as { PushManager?: unknown }).PushManager;
    const { turn, pushLine, pushOn } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(false);
    expect(pushLine()).toBe(tr("push.installIosLine"));
  });

  it("still names a browser no install can supply", async () => {
    fakeBrowser({ held: null, noNotice: true });
    fakeEnv(false, "none");
    delete (window as { PushManager?: unknown }).PushManager;
    const { turn, pushLine } = await freshStore();
    await turn(true);
    expect(pushLine()).toBe(tr("push.unsupported"));
  });

  it("puts the device's own Apple page under a line that asks for an install", async () => {
    // Apple's instructions sit at one address that covers every system version.
    fakeBrowser({ held: null });
    fakeEnv(true, "install", "https://support.apple.test/iphone");
    delete (window as { PushManager?: unknown }).PushManager;
    const { installHelpUrl, pushHint } = await freshStore();
    expect(pushHint()).toBe(tr("push.installIosLine"));
    expect(installHelpUrl()).toBe("https://support.apple.test/iphone");
  });

  it("keeps the page there after the switch is tapped", async () => {
    fakeBrowser({ held: null, permission: "default" });
    fakeEnv(false, "install", "https://support.apple.test/mac");
    delete (window as { PushManager?: unknown }).PushManager;
    const { turn, pushLine, installHelpUrl } = await freshStore();
    await turn(true);
    expect(pushLine()).toBe(tr("push.installMacLine"));
    expect(installHelpUrl()).toBe("https://support.apple.test/mac");
  });

  it("offers no page to a browser that an install would not help", async () => {
    fakeBrowser({ held: null });
    fakeEnv(false, "none", "https://support.apple.test/mac");
    delete (window as { PushManager?: unknown }).PushManager;
    const { installHelpUrl, pushHint } = await freshStore();
    expect(pushHint()).toBe(tr("push.unsupported"));
    expect(installHelpUrl()).toBe("");
  });
});

describe("what holds the switch still", () => {
  it("lets a browser that wakes up from a tab answer a flip", async () => {
    fakeBrowser({ held: null });
    fakeEnv(false, "none");
    const { pushBlocked } = await freshStore();
    expect(pushBlocked()).toBe(false);
  });

  it("holds a flip on an iPhone tab whose Push API waits for the install", async () => {
    fakeBrowser({ held: null });
    fakeEnv(true, "install");
    delete (window as { PushManager?: unknown }).PushManager;
    const { pushBlocked } = await freshStore();
    expect(pushBlocked()).toBe(true);
  });

  it("holds a flip on a desktop browser with no Push API to install its way out of", async () => {
    fakeBrowser({ held: null });
    fakeEnv(false, "none");
    delete (window as { PushManager?: unknown }).PushManager;
    const { pushBlocked } = await freshStore();
    expect(pushBlocked()).toBe(true);
  });

  it("holds the switch where a flip on has no answer", async () => {
    fakeBrowser({ held: null });
    fakeEnv(true, "install");
    delete (window as { PushManager?: unknown }).PushManager;
    const { pushSwitchHeld } = await freshStore();
    expect(pushSwitchHeld()).toBe(true);
  });

  it("keeps the way back out open for a switch whose address is on record", async () => {
    fakeBrowser({ held: null, permission: "granted" });
    fakeEnv(true, "install");
    const { pushOn, pushSwitchHeld, turn } = await freshStore();
    await turn(true);
    expect(pushOn()).toBe(true);
    // Safari gives the Push API to an installed page only, so the name can be absent while the
    // browser still holds the address.
    delete (window as { PushManager?: unknown }).PushManager;
    expect(pushSwitchHeld()).toBe(false);
  });

  it("holds the switch while a request is in the air", async () => {
    fakeBrowser({ held: null, permission: "granted" });
    fakeEnv(false, "none");
    const { pushOn, pushSwitchHeld, turn } = await freshStore();
    const flip = turn(true);
    expect(pushSwitchHeld()).toBe(true);
    await flip;
    expect(pushOn()).toBe(true);
  });
});

describe("a row that cannot work where the page was opened", () => {
  function fakeSecure(secure: boolean) {
    Object.defineProperty(window, "isSecureContext", {
      value: secure,
      configurable: true,
    });
  }

  it("stays off an address the browser keeps its push APIs from", async () => {
    // http on any host but localhost: no service worker, no `Notification`, no `PushManager`, on
    // every browser.
    fakeBrowser({ held: null });
    fakeSecure(false);
    const { pushHidden, pushInsecure } = await freshStore();
    expect(pushInsecure()).toBe(true);
    expect(pushHidden()).toBe(true);
    fakeSecure(true);
  });

  it("shows on the address the app is served from", async () => {
    fakeBrowser({ held: null });
    fakeSecure(true);
    const { pushHidden, pushInsecure } = await freshStore();
    expect(pushInsecure()).toBe(false);
    expect(pushHidden()).toBe(false);
  });
});
