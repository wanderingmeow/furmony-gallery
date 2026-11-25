import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Insets } from "../../draw/layout";

// A DOM that lays nothing out gives every box a size of 0, so these tests give a band box the
// length its own --safe-* name holds.
const bands: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const NAMES: Record<string, keyof Insets> = {
  "--safe-top": "top",
  "--safe-right": "right",
  "--safe-bottom": "bottom",
  "--safe-left": "left",
};

const watched: { read: () => void; boxes: HTMLElement[] }[] = [];

class FakeResizeObserver {
  constructor(read: () => void) {
    watched.push({ read, boxes: [] });
  }

  observe(box: HTMLElement) {
    watched[watched.length - 1].boxes.push(box);
  }

  disconnect() {
    watched.length = 0;
  }
}

function declaredSize(box: HTMLElement): number {
  const declared = box.style.height || box.style.width;
  const name = /^var\((--safe-\w+)\)$/.exec(declared)?.[1];
  return name ? bands[NAMES[name]] : 0;
}

/** The store from a fresh module instance, before any measurement has run. */
async function useInsets(observer = true): Promise<{
  safe: () => Insets;
  dispose: () => void;
}> {
  vi.stubGlobal("ResizeObserver", observer ? FakeResizeObserver : undefined);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const size = declaredSize(this);
      return {
        width: this.style.width ? size : 0,
        height: this.style.height ? size : 0,
      } as DOMRect;
    },
  );
  vi.resetModules();
  const { watchViewport } = await import("./viewport");
  let api!: { safe: () => Insets; dispose: () => void };
  createRoot((dispose) => {
    api = { safe: watchViewport().safe, dispose };
  });
  return api;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.assign(bands, { top: 0, right: 0, bottom: 0, left: 0 });
  watched.length = 0;
});

describe("the screen's bands", () => {
  it("reaches a layer after the launch that first read them as nothing", async () => {
    const { safe, dispose } = await useInsets();
    expect(safe()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    // A fullscreen web app gets its bands a little after launch, and no resize follows.
    bands.top = 59;
    expect(watched).toHaveLength(1);
    watched[0].read();
    expect(safe().top).toBe(59);
    dispose();
  });

  it("watches a box per band, so one band moving is a box moving", async () => {
    const { dispose } = await useInsets();
    const names = watched[0].boxes.map(
      (box) => box.style.height || box.style.width,
    );
    expect(new Set(names)).toEqual(
      new Set([
        "var(--safe-top)",
        "var(--safe-right)",
        "var(--safe-bottom)",
        "var(--safe-left)",
      ]),
    );
    dispose();
  });

  it("reads again on a resize, in a browser without an observer", async () => {
    const { safe, dispose } = await useInsets(false);
    bands.bottom = 34;
    window.dispatchEvent(new Event("resize"));
    expect(safe().bottom).toBe(34);
    dispose();
  });
});
