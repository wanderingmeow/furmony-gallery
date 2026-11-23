import { describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import { AntIcon } from "./AntIcon";
import {
  BACKSPACE,
  CHEVRON,
  PAW_PRINT,
  SPARK,
  TICK,
  XIAOHONGSHU,
} from "./icons";

describe("a glyph ant-design does not ship", () => {
  const cases = [
    ["paw", PAW_PRINT, { viewBox: "0 0 512 512", fill: "currentColor" }],
    [
      "xiaohongshu",
      XIAOHONGSHU,
      { viewBox: "0 0 24 24", fill: "currentColor" },
    ],
    [
      "backspace",
      BACKSPACE,
      {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
      },
    ],
    ["spark", SPARK, { viewBox: "0 0 24 24", fill: "currentColor" }],
    [
      "tick",
      TICK,
      {
        viewBox: "0 0 12 12",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.7",
      },
    ],
    [
      "chevron",
      CHEVRON,
      {
        viewBox: "0 0 12 12",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.6",
      },
    ],
  ] as const;
  for (const [name, def, paint] of cases) {
    it(`${name} draws in its own box, painted the way the glyph says`, () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const dispose = render(() => <AntIcon icon={def} size={18} />, host);
      const svg = host.querySelector("svg")!;
      for (const [attr, value] of Object.entries(paint))
        expect(svg.getAttribute(attr)).toBe(value);
      expect(svg.getAttribute("width")).toBe("18");
      expect(svg.getAttribute("height")).toBe("18");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      for (const path of [...svg.querySelectorAll("path")])
        expect(path.hasAttribute("fill")).toBe(false);
      dispose();
      host.remove();
    });
  }
});
