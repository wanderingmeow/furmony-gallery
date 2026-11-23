// The notice: silence where the browser keeps the data, and the install words its own menu uses.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "solid-js/web";
import {
  setStorageGuide,
  setStorageOnIos,
  setStorageRisk,
  storageRisk,
} from "../../stores/persistenceStore";
import { tr } from "../../i18n";
import { StorageWarning } from "./StorageWarning";

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

const IPHONE_PAGE = "https://support.apple.com/guide/iphone/iphea86e5236/ios";
const MAC_PAGE = "https://support.apple.com/guide/safari/ibrw9e991864/mac";

const plate = () => document.querySelector("[role='dialog']");
const text = () => plate()?.textContent ?? "";
const link = () => plate()?.querySelector("a") as HTMLAnchorElement | null;
const named = (name: string) =>
  [...(plate()?.querySelectorAll("button") ?? [])].filter(
    (button) => button.textContent === name,
  )[0] as HTMLButtonElement | undefined;
const wait = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

const raise = (risk: "install" | "keep", onIos: boolean, guide: string) => {
  setStorageOnIos(onIos);
  setStorageGuide(guide);
  setStorageRisk(risk);
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(() => <StorageWarning />, host);
});

afterEach(() => {
  dispose?.();
  host.remove();
  setStorageRisk("none");
  setStorageGuide("");
  vi.restoreAllMocks();
});

describe("StorageWarning", () => {
  test("the notice stays hidden where the browser keeps the data", () => {
    setStorageRisk("none");
    expect(plate()).toBeNull();
  });

  test("a phone uses the install words its own menu uses", () => {
    raise("install", true, IPHONE_PAGE);
    expect(text()).toContain(tr("storage.fact"));
    expect(text()).toContain(tr("storage.installIosLine"));
    expect(text()).not.toContain(tr("storage.installMacLine"));
    expect(text()).toContain(tr("storage.visitLine"));
  });

  test("a Mac gets the turn-the-site-into-an-app words", () => {
    raise("install", false, MAC_PAGE);
    expect(text()).toContain(tr("storage.installMacLine"));
    expect(text()).not.toContain(tr("storage.installIosLine"));
  });

  test("a browser with no such menu gets the reason, not an install step", () => {
    raise("keep", true, IPHONE_PAGE);
    expect(text()).toContain(tr("storage.keepLine"));
    expect(text()).not.toContain(tr("storage.installIosLine"));
  });

  test("the Apple guide is a link inside the sentence, not a separate button", () => {
    for (const risk of ["install", "keep"] as const) {
      raise(risk, true, IPHONE_PAGE);
      const anchor = link();
      expect(anchor?.getAttribute("href")).toBe(IPHONE_PAGE);
      expect(anchor?.textContent).toBe(tr("storage.appleGuide"));
      expect(anchor?.parentElement?.tagName).toBe("P");
      expect(anchor?.getAttribute("target")).toBe("_blank");
      setStorageRisk("none");
    }
  });

  test("the Apple guide link sends no referrer, like every other link out", () => {
    raise("install", true, IPHONE_PAGE);
    expect(link()?.getAttribute("rel")).toBe("noopener noreferrer");
    setStorageRisk("none");
  });

  test("the only button on the notice is 知道了", () => {
    raise("install", true, IPHONE_PAGE);
    const answers = [...(plate()?.querySelectorAll("button") ?? [])];
    expect(answers.map((button) => button.textContent)).toEqual([
      tr("common.gotIt"),
    ]);
  });

  test("keeps the line it showed while it fades out", async () => {
    raise("install", true, IPHONE_PAGE);
    const shown = plate();
    named(tr("common.gotIt"))!.click();
    await wait(60);
    expect(shown?.textContent).toContain(tr("storage.installIosLine"));
  });

  test("the button closes the notice", async () => {
    raise("keep", true, IPHONE_PAGE);
    named(tr("common.gotIt"))!.click();
    await wait(320);
    expect(storageRisk()).toBe("none");
    expect(plate()).toBeNull();
  });
});
