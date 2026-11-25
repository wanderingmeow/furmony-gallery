import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const TOLD = "furmony:storage-told";

/** The store remembers one page load, so each test needs a fresh copy of the module. */
async function freshStore(userAgent: string) {
  vi.resetModules();
  Object.defineProperty(navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
  return import("./persistenceStore");
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("persistenceStore", () => {
  test("a save on iOS opens the notice once and writes the date", async () => {
    const store = await freshStore(IOS);
    store.noteSavedList();
    expect(store.storageRisk()).toBe("install");
    expect(store.promptsSilenced()).toBe(true);
    expect(Number(localStorage.getItem(TOLD))).toBeGreaterThan(0);
  });

  test("an iPhone tab is asked about an install before anything is saved", async () => {
    // Push needs this answer on a first visit, and the signal the notice reads is still "none"
    // there: nothing has been saved, so nothing has raised it.
    const store = await freshStore(IOS);
    expect(store.storageRisk()).toBe("none");
    expect(store.installCapable()).toBe(true);
    expect(store.onIosBrowser()).toBe(true);
  });

  test("a Chrome tab can be woken up from where it is", async () => {
    const store = await freshStore(CHROME);
    expect(store.installCapable()).toBe(false);
    expect(store.onIosBrowser()).toBe(false);
  });

  test("the second save does not open it again", async () => {
    const store = await freshStore(IOS);
    store.noteSavedList();
    store.dismissStorageWarning();
    store.noteSavedList();
    expect(store.storageRisk()).toBe("none");
  });

  test("restoring with an empty list opens nothing and lets the next save open it", async () => {
    const store = await freshStore(IOS);
    store.noteSavedList();
    store.dismissStorageWarning();
    store.restorePrompts(false);
    expect(localStorage.getItem(TOLD)).toBeNull();
    expect(store.promptsSilenced()).toBe(false);
    expect(store.storageRisk()).toBe("none");
    store.noteSavedList();
    expect(store.storageRisk()).toBe("install");
  });

  test("restoring with a saved list opens the notice on that press", async () => {
    const store = await freshStore(IOS);
    store.noteSavedList();
    store.dismissStorageWarning();
    store.restorePrompts(true);
    expect(store.storageRisk()).toBe("install");
  });

  test("the notice the restore row opened is hidden for a month like any other", async () => {
    const store = await freshStore(IOS);
    store.noteSavedList();
    store.dismissStorageWarning();
    store.restorePrompts(true);
    store.dismissStorageWarning();
    expect(store.promptsSilenced()).toBe(true);
    expect(localStorage.getItem(TOLD)).not.toBeNull();
    store.noteSavedList();
    expect(store.storageRisk()).toBe("none");
  });

  test("a browser that keeps the data opens nothing and writes no date", async () => {
    const store = await freshStore(CHROME);
    store.noteSavedList();
    expect(store.storageRisk()).toBe("none");
    expect(store.promptsSilenced()).toBe(false);
    expect(localStorage.getItem(TOLD)).toBeNull();
  });
});
