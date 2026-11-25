// src/stores/pushStore.ts - the switch that lets the reader ask for notifications.
//
// The endpoint stays out of this file: it belongs to the browser, and the page reads it from the
// browser again whenever it needs it. Only the reader's two category picks are written down.
import { batch, createSignal } from "solid-js";
import {
  ALL_PUSH_ON,
  applicationKey,
  askSettings,
  pushConfigured,
  subscribeBody,
  tellService,
  tripleOf,
  unsubscribeBody,
  type PushCategory,
  type PushPrefs,
} from "../data/pushApi";
import { registerWorker } from "../draw/serviceWorker";
import { tr } from "../i18n";
import { requestedLocale } from "../i18n/locale";
import { appleGuide, installCapable, onIosBrowser } from "./persistenceStore";

const PICKS_KEY = "furmony_push";

/** Two flips, or a flip and a language change, share one request: the service keeps one row per
 *  browser, and the last body written is the one that stands.
 */
const WRITE_MS = 800;

/** Where the switch stands, and where it may go from there.
 *
 *  The work behind a flip takes seconds: the browser has to reach its push service before this page
 *  learns an address. `go` reads this table, so a second flip inside that window is dropped and the
 *  switch never sits between two answers.
 */
const PUSH_DOORS = {
  off: ["pairing", "leaving", "checking"],
  /** The page opened and is asking the browser for an address, so it does not know where the switch
   *  stands yet. Off: a first visit has no address, and a switch that lights up and goes out reads
   *  as one that was turned off by itself.
   */
  checking: ["reading", "off"],
  /** The browser holds an address and the service's record is being read. The switch is on: the
   *  reader did say yes once. The two rows stay hidden, because the record is what is being read.
   */
  reading: ["on", "refreshing", "off"],
  asking: ["pairing", "off"],
  /** The browser's prompt is on screen. `pairing` leads here because a flip cannot tell beforehand
   *  whether the browser is going to ask.
   */
  pairing: ["asking", "on", "off"],
  /** On, and telling the service again. The two rows stay on screen: nothing about the switch is
   *  being decided, only repeated.
   */
  refreshing: ["on", "off"],
  /** `off` is listed because a background round can find that the browser is not subscribed. */
  on: ["pairing", "leaving", "refreshing", "off"],
  leaving: ["off"],
} as const satisfies Record<PushState, readonly PushState[]>;

type PushState =
  | "off"
  | "checking"
  | "reading"
  | "asking"
  | "pairing"
  | "refreshing"
  | "on"
  | "leaving";

const [where, setWhere] = createSignal<PushState>("off");

/** Every request that could still change the answer. The switch and the two rows are held still
 *  through all of them: a pick changed during a send belongs to a body that already left.
 */
const BUSY: readonly PushState[] = [
  "checking",
  "reading",
  "asking",
  "pairing",
  "leaving",
  "refreshing",
];

/** Where the switch is drawn on. A flip being worked out counts: the reader asked for it, and a
 *  switch that stays off while the browser is being asked reads as a page that ignored them.
 */
const ON: readonly PushState[] = [
  "asking",
  "pairing",
  "reading",
  "refreshing",
  "on",
];

/** Where the two rows of picks are on screen: only where the record has answered or is being
 *  repeated. While the record is still being read they would show picks the page just said it was
 *  reading.
 */
const ROWS: readonly PushState[] = ["refreshing", "on"];

/** Go where the table allows. A move it does not allow is dropped, not queued: the prompt cannot be
 *  answered twice, and a departure cannot be started while one is already running.
 */
function go(to: PushState): void {
  if (!(PUSH_DOORS[where()] as readonly string[]).includes(to)) return;
  setWhere(to);
  // A rotation that lands during a request is not answered by that request: it asked the browser
  // before the new address existed. One round is enough, because a further rotation sets this flag
  // again.
  if (rotateWait && !pushBusy()) {
    rotateWait = false;
    setTimeout(() => void restore(), 0);
  }
}

// A rotation that landed during a round, held until that round ends.
let rotateWait = false;

/** Which line an answer puts under the switch. */
const TROUBLE = {
  rejected: "push.rejected",
  busy: "push.busy",
  unreachable: "push.unreachable",
  malformed: "push.broken",
} as const;

/** Every line this file can put under the switch. `tr` takes only names the dictionaries answer. */
type Trouble =
  | (typeof TROUBLE)[keyof typeof TROUBLE]
  | "push.denied"
  | "push.installIosLine"
  | "push.installMacLine"
  | "push.unsupported";

/** What stands under the switch: trouble, a moment of waiting, or the install a device needs. */
type Line =
  | Trouble
  | "push.pending"
  | "push.checking"
  | "push.setting"
  | "push.opening"
  | "push.closing";

export const [pushPicks, setPicks] = createSignal<PushPrefs>({
  ...ALL_PUSH_ON,
});
/** What to read under the switch, kept as a key so the line changes language with everything else.
 */
const [lineKey, setLine] = createSignal<Line | "">("");

/** The line for that key, in the language the reader is reading now. */
export const pushLine = (): string => {
  const key = lineKey();
  return key === "" ? "" : tr(key);
};
/** Whether a request about this browser is in flight. The switch is held still while it is: the
 *  service answers in the order it likes, and two overlapping flips can leave the switch on with no
 *  row behind it.
 */
export function pushBusy(): boolean {
  return BUSY.includes(where());
}

function readPicks(): PushPrefs {
  try {
    const raw = localStorage.getItem(PICKS_KEY);
    if (!raw) return { ...ALL_PUSH_ON };
    const said = JSON.parse(raw) as Partial<Record<PushCategory, unknown>>;
    // A pick that is not there is on, which is how the service reads an absent one too.
    return { new: said.new !== false, lock: said.lock !== false };
  } catch {
    return { ...ALL_PUSH_ON };
  }
}

function keepPicks(next: PushPrefs): void {
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify(next));
  } catch {
    // A private window drops them with the window.
  }
}

function forgetPicks(): void {
  try {
    localStorage.removeItem(PICKS_KEY);
  } catch {
    // Nothing to remove: that is the outcome the reader wants.
  }
}

/** Whether an install is what supplies the Push API here. Safari gives it only to a page installed
 *  on its own, so a tab on iPhone, iPad or the Mac has no `PushManager`: the missing name there
 *  means the install is missing, not that the browser left push out.
 */
function installSuppliesIt(): boolean {
  return (
    typeof window !== "undefined" &&
    !("PushManager" in window) &&
    needsInstall()
  );
}

/** Whether this browser has no way to wake a page, and no setting on this page adds one. In-app
 *  browsers and browsers that never shipped the API both answer no.
 */
export function pushUnsupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return true;
  return !("PushManager" in window) && !needsInstall();
}

/** Whether the browser hides the push APIs at this address: http on any host but localhost. The row
 *  is hidden there, not explained: no visitor opens the site that way.
 */
export function pushInsecure(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === false;
}

/** Whether this page could be added to a Home Screen or a Dock, which is the only way Apple lets a
 *  page be woken up. The answer is read from the browser: the storage notice's signal stays empty
 *  until something has been saved.
 */
export function needsInstall(): boolean {
  return installCapable();
}

/** The two platforms add a site differently, so they are told differently. */
function installLine(): Trouble {
  return onIosBrowser() ? "push.installIosLine" : "push.installMacLine";
}

/** The one thing worth reading under an off switch, or ''.
 *
 *  iPhone and iPad are certain: a tab there cannot be woken up, and only an app off the Home Screen
 *  can be. The Mac is not, so no install line is shown for it before an attempt fails; `installLine`
 *  answers a failed attempt instead.
 */
function pushHintKey(): Line | "" {
  if (pushUnsupported()) return "push.unsupported";
  if (onIosBrowser() && needsInstall()) return "push.installIosLine";
  return "";
}

/** The standing line for that key, in the language the reader is reading now. */
export function pushHint(): string {
  const key = pushHintKey();
  return key ? tr(key) : "";
}

/** Apple's page for this device, shown whenever the line under the switch asks for an install. The
 *  address carries no language, so Apple answers in the reader's own.
 */
export function installHelpUrl(): string {
  const shown = lineKey() || pushHintKey();
  return shown === "push.installIosLine" || shown === "push.installMacLine"
    ? appleGuide()
    : "";
}

export const pushHidden = (): boolean => !pushConfigured() || pushInsecure();
/** Where the switch is drawn. It reports the reader's decision, not the service's answer: on from
 *  the moment a flip is asked for, off when leaving is asked for.
 */
export const pushOn = (): boolean => ON.includes(where());
/** Where the two rows of picks are on screen. This is narrower than the switch: while the record is
 *  still being read the page shows a switch and a line, not picks it said it was reading.
 */
export const pushRows = (): boolean => ROWS.includes(where());

function fail(what: Trouble): void {
  batch(() => {
    go("off");
    setLine(what);
  });
}

/** The worker to register with, or null when this page could not get one. */
async function worker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // Startup registers without waiting, so a reader who opens the panel first finds nothing. This
  // returns the same registration rather than a second one, which is what makes a cold first visit
  // work.
  return (
    (await navigator.serviceWorker.getRegistration()) ??
    (await registerWorker())
  );
}

/** The address the browser holds, or null. A page that cannot be woken up at all has no
 *  `pushManager`, which answers the same as holding nothing.
 */
async function held(
  reg: ServiceWorkerRegistration | null,
): Promise<PushSubscription | null> {
  if (!reg?.pushManager) return null;
  return (await reg.pushManager.getSubscription()) ?? null;
}

/** Whether this browser would put a notification on screen. The worker answers for this site, and
 *  that is the question being asked: inside an installed app on iPhone, `Notification.permission`
 *  is the app's own answer, and this site's permission can differ from it.
 */
async function mayShow(
  reg: ServiceWorkerRegistration | null,
): Promise<boolean> {
  const state = await reg?.pushManager
    ?.permissionState?.({ userVisibleOnly: true })
    .catch(() => null);
  if (state) return state === "granted";
  // No way to ask about this site, so the browser-wide answer is all that is left.
  return "Notification" in window && Notification.permission !== "denied";
}

/** Send what the reader picked, and what the service said about it.
 *
 *  `fromBoot` is a page that opened with a subscription the browser already holds. A service that
 *  does not answer to that page is not a reader who turned anything off, so the switch stays on and
 *  the line carries the reason instead.
 */
async function pair(fromBoot = false): Promise<void> {
  // The caller sets where the switch stands before this runs: either a flip is being decided or a
  // setting is being repeated.
  if (pushUnsupported()) {
    fail("push.unsupported");
    return;
  }
  const registration = await worker();
  // A worker with no `pushManager` is a browser that shipped no web push, and reopening does not
  // change that. A page that got no worker at all is missing this site's own file, and there
  // reopening does help.
  if (registration && !registration.pushManager) {
    fail(needsInstall() ? installLine() : "push.unsupported");
    return;
  }
  if (!registration) {
    fail("push.broken");
    return;
  }
  const key = applicationKey();
  if (!key) {
    fail("push.broken");
    return;
  }
  const manager = registration.pushManager;
  let sub: PushSubscription | null;
  try {
    sub =
      (await manager.getSubscription()) ??
      (await manager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));
  } catch {
    // Either the reader answered the prompt no, or the browser cannot wake a page and says so by
    // rejecting the subscription.
    fail(needsInstall() ? installLine() : "push.broken");
    return;
  }
  const answer = await tellService(
    subscribeBody(tripleOf(sub), pushPicks(), requestedLocale()),
  );
  if (answer === "live" || answer === "pending") {
    batch(() => {
      go("on");
      // The address is stored either way; only the provider's silence is worth a line.
      setLine(answer === "pending" ? "push.pending" : "");
    });
    return;
  }
  if (answer === "silent") {
    // The service has no key to sign with. The browser side is finished and correct, and the reader
    // has nothing to act on, so the switch stays on and no line appears.
    batch(() => {
      go("on");
      setLine("");
    });
    return;
  }
  // A browser that is already subscribed stays subscribed: a service that did not answer is not a
  // reader who turned anything off.
  const trouble: Trouble =
    TROUBLE[answer as keyof typeof TROUBLE] ?? "push.broken";
  batch(() => {
    // A boot page keeps the switch on: the browser still holds the address whatever the service
    // says, and the line underneath carries the reason.
    go(fromBoot ? "on" : "off");
    setLine(trouble);
  });
}

let timer: ReturnType<typeof setTimeout> | undefined;
function schedule(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    // Asked again when it fires, because 800 ms is long enough for the reader to leave. Otherwise a
    // queued pick would send an address the reader has just taken back.
    if (!pushRows()) return;
    // The rows are on screen and the switch is on, so this repeats a setting rather than deciding
    // one, and the line says so.
    go("refreshing");
    setLine("push.setting");
    void pair();
  }, WRITE_MS);
}

/** The switch. A busy state is the lock: the table has no door from one busy state into another, so
 *  a second flip is dropped rather than queued.
 */
export async function turn(on: boolean): Promise<void> {
  if (pushBusy()) return;
  // The line under the switch is the one errors use too. A flip can sit for seconds before the
  // browser has an address from its push service, and a greyed-out switch with nothing under it
  // reads as a page that stopped answering.
  setLine(on ? "push.opening" : "push.closing");
  go(on ? "pairing" : "leaving");
  await (on ? open() : leave());
}

async function open(): Promise<void> {
  // The install is checked before any API name is looked for. A tab on iPhone is missing the
  // Notifications API and the Push API at the same time, so an absent name there means the install
  // is missing, and a line about a browser without push gives the reader nothing to do.
  if (installSuppliesIt()) {
    fail(installLine());
    return;
  }
  // Asking first would put a prompt in front of someone whose browser cannot answer it.
  if (pushUnsupported() || !("Notification" in window)) {
    fail("push.unsupported");
    return;
  }
  if (Notification.permission === "default") {
    go("asking");
    let granted: NotificationPermission;
    try {
      granted = await Notification.requestPermission();
    } catch {
      granted = "denied";
    }
    if (granted !== "granted") {
      fail("push.denied");
      return;
    }
    go("pairing");
  }
  if (Notification.permission !== "granted") {
    fail("push.denied");
    return;
  }
  await pair();
}

async function leave(): Promise<void> {
  const sub = await held(await worker());
  if (sub) {
    try {
      await sub.unsubscribe();
    } catch {
      // The browser has already dropped it, which is the outcome the reader wants.
    }
    // Told afterwards, and a failure here costs one quiet round: the service prunes an address its
    // provider answers 404 or 410 for, so nothing keeps sending to a browser that left.
    await tellService(unsubscribeBody(sub.endpoint));
  }
  // The line stays until this ends: while the request is in flight it says what is happening, and an
  // empty line under a greyed-out switch says nothing. The switch went off when `leaving` was
  // entered, so a card that arrives after that is one the reader asked not to see.
  batch(() => {
    go("off");
    setLine("");
  });
}

/** Change one of the two kinds of news the reader wants. */
export function setPick(which: PushCategory, on: boolean): void {
  const next = { ...pushPicks(), [which]: on };
  setPicks(next);
  keepPicks(next);
  // While the switch is off there is nothing to update. The same while a request is in flight, where
  // this pick would be answered by a body that already left.
  if (!next.new && !next.lock) {
    // Both off is the switch off: nothing would be sent, so the row is not worth keeping. It leaves
    // through the same door, with the same line and the rows hidden.
    // The stored copy goes with the row. An empty store reads as both on anyway, and no file is left
    // saying that both kinds are on while the switch is off.
    clearTimeout(timer);
    setPicks(ALL_PUSH_ON);
    forgetPicks();
    void turn(false);
    return;
  }
  if (pushRows()) schedule();
}

/** Opening the page is how the reader reads the news: the worker closes the cards, and the number on
 *  the icon goes with them. The number counts the cards that are left, so leaving them open would
 *  raise it again on the next round.
 */
function markSeen(): void {
  if (typeof document !== "undefined" && document.visibilityState !== "visible")
    return;
  void worker().then((reg) => {
    reg?.active?.postMessage({ type: "push:seen" });
  });
}

/** A page that opens with a subscription already held says so, and sends the reader's picks and
 *  language again: one POST per opening heals a rotated address, a language changed since, and a
 *  service that dropped the row. The service counts a repeat against nothing, because the address is
 *  already there.
 */
async function restore(): Promise<void> {
  if (pushBusy()) return;
  // The address is in the browser and the record is on the service, so the page opens not knowing
  // where the switch stands. It says so for that window: an off switch would not be wrong about the
  // record, but it would be settled about it too early.
  go("checking");
  setLine("push.checking");
  const reg = await worker();
  const sub = await held(reg);
  if (!sub) {
    // Nothing is said about a permission the reader has never been asked for. The page finds out
    // whether this browser would show a notice when the switch is touched, and `open` answers
    // then.
    go("off");
    setLine("");
    return;
  }
  go("reading");
  const shown = await mayShow(reg);
  // The reader did say yes once, and the address is still in this browser. A round sends from what
  // the service keeps, so the record is asked before the switch is shown. The picks in this
  // browser's storage are a copy of that record, and the copy can be from another device or from
  // before the phone cleared its storage.
  const said = await askSettings(sub.endpoint);
  if (said.at === "absent") {
    // The service dropped this row: a device that stopped coming back, or a counter that ran out.
    // The address is still the reader's, so the page offers it again instead of turning the switch
    // off. The picks shown during that send are the copy in this browser's storage, which is all
    // there is.
    go("refreshing");
    await pair(true);
    return;
  }
  if (said.at === "quiet") {
    // Nothing answered, which decides nothing. The browser side is finished and correct, so the
    // switch goes where the reader left it and no claim is made about the rest of the way.
    batch(() => {
      go("on");
      setLine(shown ? "" : "push.denied");
    });
    return;
  }
  batch(() => {
    setPicks(said.prefs);
    keepPicks(said.prefs);
    go("on");
    // The record is what the switch reports. Whether this device would show a notice is a separate
    // fact, and the reader hears it here rather than by never seeing one: a site the browser blocks
    // stops everything, so it is said before the provider's silence.
    setLine(!shown ? "push.denied" : said.pending ? "push.pending" : "");
  });
  // A language chosen after the row was written is worth one more POST, and one POST is cheaper than
  // a second kind of request to carry it.
  if (said.lang !== requestedLocale()) void schedule();
}

/** Called once from the composition root. */
export function loadPush(): void {
  if (pushHidden()) return;
  setPicks(readPicks());
  void restore();

  // The worker reports it when the provider rotates the address. It cannot handle that itself: the
  // service's address and the reader's picks live here, not in the worker.
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if ((event.data as { type?: string })?.type !== "push:rotate") return;
    // A rotation during a round waits for that round; it is not dropped.
    if (pushBusy()) {
      rotateWait = true;
      return;
    }
    if (pushRows()) {
      // The record is already in hand, so this repeats a setting and the rows stay up while it
      // goes.
      go("refreshing");
      setLine("push.setting");
      void pair();
      return;
    }
    // The page never read the record, because the panel never opened. Reading is not what a rotation
    // needs: the new address is not the one on record, so the answer is already "not here". The
    // browser still has to be asked again, because a rotated address left waiting for a panel nobody
    // opens is a reader who stopped getting word without seeing why.
    void restore();
  });

  markSeen();
  document.addEventListener("visibilitychange", markSeen);
}
