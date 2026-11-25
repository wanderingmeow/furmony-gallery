// The notice that tells a user the browser may delete their saved wishlist.
import { createSignal } from "solid-js";
import {
  appleGuideFor,
  isIos,
  requestPersistence,
  storageRiskFor,
  type StorageRisk,
  toldRecently,
} from "../data/persistence";

const TOLD = "furmony:storage-told";

// The risk does not pass on its own, so without this date the notice would open on every visit.
const TOLD_AGAIN_AFTER = 30 * 24 * 60 * 60 * 1000;

export const [storageRisk, setStorageRisk] = createSignal<StorageRisk>("none");

export const [storageGuide, setStorageGuide] = createSignal("");

// iPhone and iPad get different install words, because their Safari menus differ.
export const [storageOnIos, setStorageOnIos] = createSignal(false);

// The browser answers the storage request once per page load, and Firefox shows the user a prompt.
let askedBrowser = false;

// A browser that rejects storage writes no date, so this flag keeps the notice away for the load.
let toldThisVisit = false;

const toldAt = (): number => {
  try {
    return Number(localStorage.getItem(TOLD));
  } catch {
    return Number.NaN;
  }
};

const markTold = (now: number): void => {
  try {
    localStorage.setItem(TOLD, String(now));
  } catch {
    // With no date written, the flag above is the only thing keeping the notice away.
  }
};

/** Whether the notice is still hidden inside the month after the user answered it. */
export const [promptsSilenced, setPromptsSilenced] = createSignal(
  toldRecently(toldAt(), Date.now(), TOLD_AGAIN_AFTER),
);

const browserEnv = () => ({
  userAgent: navigator.userAgent,
  iosEngine: CSS.supports("-webkit-touch-callout", "none"),
  standalone:
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true,
});

/** Whether this page could be added to a Home Screen or a Dock. The storage notice asks the same
 *  question through a signal that stays empty until something has been saved, so push reads the
 *  browser directly and has an answer on a first visit.
 */
export const installCapable = (): boolean =>
  storageRiskFor(browserEnv()) === "install";

/** The same read, for the copy that names iPhone and iPad differently from the Mac. */
export const onIosBrowser = (): boolean => isIos(browserEnv());

/** Apple's page for this device, read from the browser: the signal above holds the same address
 *  only once there is a saved list to warn about.
 */
export const appleGuide = (): string => appleGuideFor(browserEnv());

function raise(env: ReturnType<typeof browserEnv>): void {
  setStorageOnIos(isIos(env));
  setStorageGuide(appleGuideFor(env));
  setStorageRisk(storageRiskFor(env));
}

/** The notice stays hidden for a month after the user answers it, whichever button closed it. */
function markNoticeAnswered(): void {
  toldThisVisit = true;
  markTold(Date.now());
  setPromptsSilenced(true);
}

/** Called on a save, the moment the notice is about. When the data is safe, this returns and
 *  writes nothing. */
export function noteSavedList(): void {
  if (!askedBrowser) {
    askedBrowser = true;
    void requestPersistence();
  }
  const env = browserEnv();
  if (storageRiskFor(env) === "none") return;
  if (toldThisVisit || toldRecently(toldAt(), Date.now(), TOLD_AGAIN_AFTER))
    return;
  raise(env);
  markNoticeAnswered();
}

/** Closes the notice. The one-month date above is already written, and stays as it is. */
export const dismissStorageWarning = (): void => {
  setStorageRisk("none");
};

/** Clears the month, so the next save can show the notice again. With a saved list the notice opens
 *  on this press too, because there is something to lose. With an empty list the row simply
 *  disappears. */
export function restorePrompts(hasSavedList: boolean): void {
  try {
    localStorage.removeItem(TOLD);
  } catch {
    // When the removal fails, the date stays and the notice stays hidden.
  }
  toldThisVisit = false;
  setPromptsSilenced(false);
  const env = browserEnv();
  if (!hasSavedList || storageRiskFor(env) === "none") return;
  raise(env);
  markNoticeAnswered();
}
