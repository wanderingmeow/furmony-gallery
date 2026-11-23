// WebKit deletes a site's stored data after a week of browser use with no visit to that site, and
// it counts only the days the browser was open. Every iPhone and iPad is treated as under the rule;
// an app added to the home screen is outside it.
export interface BrowserEnv {
  userAgent: string;
  /** `-webkit-touch-callout` exists only in Safari on iOS, and Chromium reports false for it.
   *  Pointer and touch counts are both wrong on a plugged-in device. A wrong read here changes the
   *  wording of the notice, never whether it opens. */
  iosEngine: boolean;
  standalone: boolean;
}

// An iPad that reports itself as a Mac still runs the phone build of WebKit.
export const isIos = (env: BrowserEnv): boolean =>
  /iPhone|iPad|iPod/.test(env.userAgent) ||
  (/Macintosh/.test(env.userAgent) &&
    env.iosEngine &&
    !namesItsOwnBrowser(env.userAgent));

/** Some browsers report support for a `-webkit-` property they do not implement, so a browser that
 *  names itself is not an iPad. */
const namesItsOwnBrowser = (userAgent: string): boolean =>
  /Chrome|Chromium|CriOS|Edg|OPR|Samsung|Firefox|FxiOS/.test(userAgent);

const isDesktopSafari = (userAgent: string): boolean =>
  /AppleWebKit/.test(userAgent) &&
  !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS/.test(userAgent);

export const cappedByItp = (env: BrowserEnv): boolean =>
  !env.standalone && (isIos(env) || isDesktopSafari(env.userAgent));

/** `install` offers the user an action to take; `keep` gives the fact and no button. */
export type StorageRisk = "none" | "install" | "keep";

/** The browsers whose own menu offers this page as an app. iPhone, iPad and Mac all have one; an
 *  in-app browser - WeChat, LINE, Instagram - has no such item, and a browser that cannot be named
 *  is treated as in-app. */
const isInstallCapable = (userAgent: string): boolean =>
  /Version\/[\d.]+.*\bSafari\//.test(userAgent) ||
  /CriOS|FxiOS|EdgiOS/.test(userAgent);

export const storageRiskFor = (env: BrowserEnv): StorageRisk => {
  if (!cappedByItp(env)) return "none";
  return isInstallCapable(env.userAgent) ? "install" : "keep";
};

/** Apple's own instructions, one page per device. The address holds no language, so Apple serves
 *  the reader's own, and the bare id redirects to the current page. */
export function appleGuideFor(env: BrowserEnv): string {
  if (!isIos(env))
    return "https://support.apple.com/guide/safari/ibrw9e991864/mac";
  return /iPad/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.iosEngine)
    ? "https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados"
    : "https://support.apple.com/guide/iphone/iphea86e5236/ios";
}

/** Chromium decides from its own estimate of whether the site matters, and Firefox asks the user,
 *  so a first visit gets false from both. WebKit's answer is not documented as affecting the 7-day
 *  rule. */
export async function requestPersistence(): Promise<boolean> {
  const store = navigator.storage;
  if (!store?.persist) return false;
  try {
    if (await store.persisted?.()) return true;
    return await store.persist();
  } catch {
    return false;
  }
}

/** True when the user was told less than `after` milliseconds ago. */
export const toldRecently = (
  toldAt: number,
  now: number,
  after: number,
): boolean => Number.isFinite(toldAt) && toldAt > 0 && now - toldAt < after;
