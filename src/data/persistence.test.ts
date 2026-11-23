import { describe, expect, test } from "vitest";
import {
  appleGuideFor,
  cappedByItp,
  isIos,
  storageRiskFor,
  toldRecently,
} from "./persistence";

const safariIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const chromeIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.85 Mobile/15E148 Safari/604.1";
const ipadAsMac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const safariIpad =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const safariMac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const chromeMac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const firefoxMac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0";
const chromeAndroid =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36";
const edgeWindows =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const wechatIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003129) NetType/WIFI Memory/581MB";
const lineIos =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.15.1";

describe("isIos", () => {
  test("an iPad that reports itself as a Mac is still read as an iPad", () => {
    expect(
      isIos({ userAgent: ipadAsMac, iosEngine: true, standalone: false }),
    ).toBe(true);
  });

  test("a Mac with a touch screen is not counted as an iPad", () => {
    expect(
      isIos({ userAgent: safariMac, iosEngine: false, standalone: false }),
    ).toBe(false);
  });

  test("a browser that names itself is not an iPad, even when it supports the probe", () => {
    for (const userAgent of [chromeMac, firefoxMac]) {
      expect(isIos({ userAgent, iosEngine: true, standalone: false })).toBe(
        false,
      );
    }
  });
});

describe("storageRiskFor", () => {
  test("a phone browser gets the add-to-Home-Screen words", () => {
    expect(
      storageRiskFor({
        userAgent: safariIos,
        iosEngine: true,
        standalone: false,
      }),
    ).toBe("install");
  });

  test("Chrome on a phone is under the same rule, because WebKit is underneath it", () => {
    expect(
      storageRiskFor({
        userAgent: chromeIos,
        iosEngine: true,
        standalone: false,
      }),
    ).toBe("install");
  });

  test.each([
    ["WeChat", wechatIos],
    ["LINE", lineIos],
  ])(
    "%s on a phone is told the fact without steps, because it has no Home Screen menu",
    (_name, userAgent) => {
      expect(
        storageRiskFor({ userAgent, iosEngine: true, standalone: false }),
      ).toBe("keep");
      expect(
        cappedByItp({ userAgent, iosEngine: true, standalone: false }),
      ).toBe(true);
    },
  );

  test("a web app on the Home Screen is outside the 7-day rule", () => {
    expect(
      storageRiskFor({
        userAgent: safariIos,
        iosEngine: true,
        standalone: true,
      }),
    ).toBe("none");
  });

  test("a Mac gets the same install words, because Safari there can add the page to the Dock", () => {
    expect(
      storageRiskFor({
        userAgent: safariMac,
        iosEngine: false,
        standalone: false,
      }),
    ).toBe("install");
  });

  test.each([
    ["Chrome on a Mac", chromeMac],
    ["Firefox on a Mac", firefoxMac],
    ["Chrome on a phone", chromeAndroid],
    ["Edge on Windows", edgeWindows],
  ])("%s is asked quietly", (_name, userAgent) => {
    expect(
      storageRiskFor({ userAgent, iosEngine: false, standalone: false }),
    ).toBe("none");
  });

  test("every browser the notice reaches is one the cap covers", () => {
    for (const userAgent of [
      chromeMac,
      firefoxMac,
      chromeAndroid,
      edgeWindows,
    ]) {
      expect(
        cappedByItp({ userAgent, iosEngine: false, standalone: false }),
      ).toBe(false);
    }
  });
});

describe("appleGuideFor", () => {
  test("a phone gets the iPhone guide", () => {
    expect(
      appleGuideFor({
        userAgent: safariIos,
        iosEngine: true,
        standalone: false,
      }),
    ).toContain("/guide/iphone/");
  });

  test("an iPad gets the iPad guide, however it names itself", () => {
    for (const userAgent of [safariIpad, ipadAsMac]) {
      expect(
        appleGuideFor({ userAgent, iosEngine: true, standalone: false }),
      ).toContain("/guide/ipad/");
    }
  });

  test("a Mac gets the Safari guide", () => {
    expect(
      appleGuideFor({
        userAgent: safariMac,
        iosEngine: false,
        standalone: false,
      }),
    ).toContain("/guide/safari/");
  });

  test("no address holds a language, so Apple answers in the reader's own", () => {
    for (const userAgent of [safariIos, safariIpad, ipadAsMac, safariMac]) {
      expect(
        appleGuideFor({ userAgent, iosEngine: true, standalone: false }),
      ).toMatch(
        /^https:\/\/support\.apple\.com\/guide\/(iphone|ipad|safari)\/[a-z0-9]+\//,
      );
    }
  });
});

describe("toldRecently", () => {
  const DAY = 24 * 60 * 60 * 1000;

  test("a date inside the window keeps the notice hidden", () => {
    expect(toldRecently(1, 1 + 29 * DAY, 30 * DAY)).toBe(true);
  });

  test("a date past the window lets the notice open again", () => {
    expect(toldRecently(1, 1 + 30 * DAY, 30 * DAY)).toBe(false);
  });

  test("no stored date means the notice has never been shown", () => {
    for (const never of [0, -1, Number.NaN]) {
      expect(toldRecently(never, Date.now(), 30 * DAY)).toBe(false);
    }
  });
});
