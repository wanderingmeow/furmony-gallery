import { describe, expect, it } from "vitest";
import { bootWatchScript } from "./bootWatch";

describe("the script the document runs itself", () => {
  // The script is written as a template literal, where a stray backslash or backtick quietly changes
  // the emitted code: a broken inline script reports nothing at all.
  it("parses as the document receives it", () => {
    expect(() => new Function(bootWatchScript())).not.toThrow();
  });

  it("names the key the app waits on for the same recovery", () => {
    expect(bootWatchScript()).toContain("furmony:sheet-reloaded");
  });
});
