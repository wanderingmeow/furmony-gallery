// Vitest setup: provide IndexedDB (fake-indexeddb) + a guaranteed global localStorage.
import "fake-indexeddb/auto";
import { beforeEach, vi } from "vitest";

// The suite quotes the app in 简体中文, the language the dictionaries are written in. 重置 hands the
// language back to whatever the browser asked for, so this file has to give the browser one, and
// it has to do that before the app's modules are read: the language of a visit is settled as they
// load.
Object.defineProperty(globalThis.navigator, "language", {
  value: "zh-CN",
  configurable: true,
});
const { setLocale } = await import("./i18n");

// A test that picks another language leaves this one standing when it finishes.
setLocale("zh");

/** Let a test finish a Solid update. Solid runs queued effects after the setter returns, and the
 *  queue drains over more than one microtask, so a test waits one macrotask. */
export function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const offTheNetwork = () =>
  vi.stubGlobal("fetch", (url: unknown) =>
    Promise.reject(new Error(`a test asked the network for ${String(url)}`)),
  );

// A request still standing when a test ends shows up as a happy-dom abort error, so no test is left
// one. Re-installed each time because a test that restores its own stub clears this one too.
beforeEach(offTheNetwork);

// happy-dom only exposes localStorage when run with --localstorage-file; provide a
// simple in-memory shim so the cache layer's localStorage migration is testable.
const scope = globalThis as typeof globalThis & { localStorage?: Storage };
if (scope.localStorage === undefined) {
  const store: Record<string, string> = {};
  let keys: string[] = [];
  const syncKeys = () => {
    keys = Object.keys(store);
  };
  // The cache layer calls five methods; the shim gives those plus the length the Storage type wants.
  scope.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
      syncKeys();
    },
    removeItem: (k: string) => {
      delete store[k];
      syncKeys();
    },
    clear: () => {
      for (const k of keys) delete store[k];
      keys = [];
    },
    key: (i: number) => keys[i] ?? null,
    get length() {
      return keys.length;
    },
  };
}

/** Give the browser Safari's `switch` attribute, or take it away. That attribute is what gives a
 *  browser its buzz, so this decides whether a browser buzzes. The user agent is set, so a test can
 *  look like a phone or a desktop. */
export function withSwitch(on = true): void {
  Object.defineProperty(navigator, "userAgent", {
    value: on
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15"
      : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    configurable: true,
  });
  Object.defineProperty(navigator, "platform", {
    value: on ? "iPhone" : "MacIntel",
    configurable: true,
  });
  Object.defineProperty(navigator, "maxTouchPoints", {
    value: on ? 5 : 0,
    configurable: true,
  });
  const prop = { value: false, configurable: true };
  if (on)
    Object.defineProperty(window.HTMLInputElement.prototype, "switch", prop);
  else Reflect.deleteProperty(window.HTMLInputElement.prototype, "switch");
}
