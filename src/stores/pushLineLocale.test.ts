// The line under the notification switch is kept as a key, so a language chosen while a request is
// in the air is answered in the language the reader reads it in, not the one the request started in.
// This file keeps one copy of the dictionary: the point is the words, so nothing here reloads the
// module graph.
import { describe, expect, it, vi } from "vitest";
import { tr } from "../i18n";
import { locale, setLocale } from "../i18n/locale";
import { installHelpUrl, pushLine, turn } from "./pushStore";

vi.mock("../data/pushApi", async () => {
  const actual =
    await vi.importActual<typeof import("../data/pushApi")>("../data/pushApi");
  return {
    ...actual,
    pushConfigured: () => true,
    applicationKey: () => new Uint8Array(65),
  };
});
vi.mock("./persistenceStore", () => ({
  onIosBrowser: () => true,
  installCapable: () => true,
  appleGuide: () => "https://support.apple.test/iphone",
}));

describe("the line under the switch", () => {
  it("changes language with every other word", async () => {
    // A tab on iPhone has neither PushManager nor Notification, so the answer is the install and no
    // worker is touched on the way there.
    delete (window as { PushManager?: unknown }).PushManager;
    delete (window as { Notification?: unknown }).Notification;
    const was = locale();
    const other = was === "en" ? "zh" : "en";
    await turn(true);
    expect(pushLine()).toBe(tr("push.installIosLine"));
    setLocale(other);
    expect(
      pushLine(),
      "the line is a key, not a sentence written down earlier",
    ).toBe(tr("push.installIosLine"));
    expect(
      installHelpUrl(),
      "and the page under it is still the one for this device",
    ).toBe("https://support.apple.test/iphone");
    setLocale(was);
  });
});
