import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { SearchOutlined } from "@ant-design/icons-svg";
import { SparkMark } from "./spark";

let dispose: (() => void) | undefined;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  host.remove();
});

/** The glyph is the wrapper span: the class has to land there, not on the <svg>. */
const glyph = () => host.querySelector("span") as HTMLSpanElement;

describe("the mark that works", () => {
  it("holds the pulse until the cycle ends when the work stops", () => {
    const [working, setWorking] = createSignal(true);
    dispose = render(
      () => <SparkMark working={working} icon={() => SearchOutlined} />,
      host,
    );
    expect(glyph().className).toContain("spark-pulse");
    // a pulse stopped mid-cycle would leave the mark at whatever brightness it had reached
    setWorking(false);
    expect(glyph().className).toContain("spark-pulse");
    glyph().dispatchEvent(new Event("animationiteration"));
    expect(glyph().className).not.toContain("spark-pulse");
  });

  it("keeps pulsing through a cycle while the work goes on", () => {
    const [working] = createSignal(true);
    dispose = render(() => <SparkMark working={working} />, host);
    glyph().dispatchEvent(new Event("animationiteration"));
    expect(glyph().className).toContain("spark-pulse");
  });

  // without the resting class the mark falls back to the browser's default color between cycles
  it("keeps the resting color on the element while it pulses", () => {
    const [working, setWorking] = createSignal(true);
    dispose = render(
      () => <SparkMark working={working} class="text-faint" />,
      host,
    );
    expect(glyph().className).toContain("spark-pulse");
    expect(glyph().className).toContain("text-faint");
    setWorking(false);
    glyph().dispatchEvent(new Event("animationiteration"));
    expect(glyph().className).not.toContain("spark-pulse");
    expect(glyph().className).toContain("text-faint");
  });

  it("starts without a pulse when nothing is working", () => {
    dispose = render(() => <SparkMark working={false} />, host);
    expect(glyph().className).not.toContain("spark-pulse");
  });
});
