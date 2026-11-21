import { describe, expect, it } from "vitest";
import { nextHold } from "./pageHold";

describe("holding the page while the document answers to a blur", () => {
  it("leaves the page alone while it stands where the user left it", () => {
    expect(nextHold(500, 500, false)).toBe("hold");
  });

  it("ignores the sub-pixel drift a scroll leaves behind", () => {
    expect(nextHold(500, 500.4, false)).toBe("hold");
  });

  it("writes the number back when something else moved the page", () => {
    expect(nextHold(500, 420, false)).toBe("write");
  });

  it("gives up when the page has moved too far to be the page’s own memory", () => {
    expect(nextHold(500, 500 + 241, false)).toBe("done");
  });

  it("hands the page back once the writes have had their say", () => {
    expect(nextHold(500, 420, true)).toBe("done");
  });
});
