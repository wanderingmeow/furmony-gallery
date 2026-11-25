import { ICON, root } from "./address";

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// The card a push leaves on the screen, and the number on the app icon that goes with it.

// What the service writes for one card: the words to show, the language, the round it came from,
// where a tap goes, and how many listings moved.
export interface Words {
  body?: string;
  count?: unknown;
  lang?: string;
  tag?: string;
  title?: string;
  url?: string;
}

// A payload that is not json is kept as text, so the card still shows.
export const said = (data: PushMessageData | null): Words => {
  if (!data) return {};
  try {
    return data.json() as Words;
  } catch {
    return { title: "", body: data.text() };
  }
};

// Counts become finite whole numbers above zero before they are summed.
const asCount = (value: unknown): number => {
  const whole = Math.trunc(Number(value));
  return Number.isFinite(whole) && whole > 0 ? whole : 0;
};

// The number on the icon counts the listings that changed since the reader last opened the page.
// The worker keeps this account itself, and opening the page clears it.
const LEDGER = "furmony-notifications";
// The key has to be a same-origin URL: `Cache.put` rejects a name from another origin, while
// `match` answers "no entry" for it.
const LEDGER_KEY = `${root}notifications.tally`;
// The cap bounds the entry for a reader who never opens the app.
const LEDGER_MAX = 20;
// A payload with no tag is an operator's own test send.
const UNTAGGED = "furmony";

type Tally = Record<string, number>;

// Every read-modify-write runs after the steps already queued: one round sends both kinds of
// notification, and two push handlers that each read and wrote the entry would lose one of them.
let queued: Promise<unknown> = Promise.resolve();

const kept = (value: unknown): Tally => {
  if (typeof value !== "object" || value === null) return {};
  const held: Tally = {};
  for (const [tag, count] of Object.entries(value)) {
    const whole = asCount(count);
    if (whole > 0) held[tag] = whole;
  }
  return held;
};

const total = (held: Tally): number =>
  Object.values(held).reduce((all, one) => all + one, 0);

// `null` when the ledger cannot be read, so the caller falls back to the count in hand.
const readTally = (): Promise<Tally | null> =>
  caches
    .open(LEDGER)
    .then((store) =>
      store
        .match(LEDGER_KEY)
        .then((found) => (found ? found.json().catch(() => ({})) : {})),
    )
    .then((value: unknown) => kept(value))
    .catch(() => null);

const writeTally = (held: Tally): Promise<unknown> =>
  caches
    .open(LEDGER)
    .then((store) => store.put(LEDGER_KEY, new Response(JSON.stringify(held))));

const step = (work: (held: Tally) => Tally): Promise<number | null> => {
  const run = queued.then(async () => {
    const held = await readTally();
    if (held === null) return null;
    const next = work(held);
    await writeTally(next);
    return total(next);
  });
  // A step that failed leaves the chain settled, so the next event still gets its turn.
  queued = run.catch(() => null);
  return run;
};

/** The card a push carried, counted under its own tag. */
export const tallyCard = (tag: string, count: number): Promise<number | null> =>
  step((held) => {
    // A card with no count reports no change in the listings: it shows, and it takes no room in
    // the tally.
    if (count > 0) held[tag] = count;
    for (const oldest of Object.keys(held).slice(0, -LEDGER_MAX)) {
      delete held[oldest];
    }
    return held;
  });

/** One card the reader is done with, taken off the tally. */
export const dropCard = (tag: string): Promise<number | null> =>
  step((held) => {
    delete held[tag];
    return held;
  });

export const clearTally = (): Promise<number | null> => step(() => ({}));

const trayTally = (shown: Notification[]): Tally => {
  const held: Tally = {};
  for (const one of shown) {
    const whole = asCount((one.data as Words | undefined)?.count);
    if (whole > 0) held[one.tag] = whole;
  }
  return held;
};

// The browser's own list also knows about cards the reader dismissed while the worker was asleep.
// An empty list or a failed read changes nothing.
const syncToTray = (): Promise<number | null> =>
  self.registration.getNotifications().then(
    (shown) =>
      shown.length ? step(() => trayTally(shown)) : Promise.resolve(null),
    () => Promise.resolve(null),
  );

// The method sits on `navigator` in some browsers and on the registration in others, so the holder
// is found by method name. Both calls take a number.
interface Badgeable {
  setAppBadge?(contents: number): Promise<unknown>;
  clearAppBadge?(): Promise<unknown>;
}

const applyBadge = (count: number): Promise<unknown> => {
  const holder = (one: object): Badgeable | null =>
    typeof (one as Badgeable).setAppBadge === "function"
      ? (one as Badgeable)
      : null;
  const set = holder(self.navigator) ?? holder(self.registration);
  if (!set) return Promise.resolve();
  return count > 0
    ? Promise.resolve(set.setAppBadge?.(count))
    : Promise.resolve(set.clearAppBadge?.());
};

// Every word on the card comes from the payload. The worker writes none of its own.
const showNotice = (words: Words): Promise<unknown> =>
  self.registration.showNotification(words.title ?? "", {
    body: words.body ?? "",
    // The tag is the card's identity in the browser: two cards with one tag replace each other, so
    // the service names each card after the round that sent it.
    tag: words.tag ?? UNTAGGED,
    icon: ICON,
    // No `badge` field: Android needs a flat white silhouette, and this build has none.
    // `zh_tw` is this page's own id; a platform reads a language tag with a hyphen in it.
    lang: (words.lang ?? "zh").replace("_", "-"),
    data: { url: words.url ?? root, count: asCount(words.count) },
  });

/** A push arrived: show it, then put the new number on the icon. */
export const openedCard = (words: Words): Promise<unknown> => {
  const tag = words.tag ?? UNTAGGED;
  const count = asCount(words.count);
  return showNotice(words)
    .then(syncToTray)
    .then((fromTray) =>
      tallyCard(tag, count).then((held) =>
        applyBadge(held ?? fromTray ?? count),
      ),
    );
};

/** The reader tapped a card or dismissed it: its number comes off the icon. */
export const readNotice = (card: Notification): Promise<unknown> =>
  dropCard(card.tag).then((held) =>
    held === null ? undefined : applyBadge(held),
  );

/** Opening the page: every card goes, and the number on the icon goes with them. The number is
 *  cleared even when the tally cannot be written, because that number must not stay on the icon
 *  forever.
 */
export const pageOpened = (): Promise<unknown> =>
  closeNotices()
    .then(clearTally)
    .then((held) => applyBadge(held ?? 0));

// Closing is the platform's own list put away: the number is the caller's to decide.
const closeNotices = (): Promise<unknown> =>
  self.registration
    .getNotifications()
    .then((shown) => shown.map((one) => one.close()));

// `type: "window"` asks for a window, while the types answer with the wider `Client`.
const pages = (): Promise<WindowClient[]> =>
  self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  }) as Promise<WindowClient[]>;

// One window per app: the reader tapped a card, not a request for another tab.
export const visit = async (target: string): Promise<void> => {
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

// The new address needs the reader's picks and the service's address, neither of which is here.
export const askPages = (): Promise<unknown> =>
  pages().then((all) =>
    Promise.all(all.map((one) => one.postMessage({ type: "push:rotate" }))),
  );
