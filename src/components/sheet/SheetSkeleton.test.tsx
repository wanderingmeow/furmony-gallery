import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";
import { SheetBodySkeleton, SheetTitleSkeleton } from "./SheetSkeleton";

let disposeApp: () => void;
let host: HTMLDivElement;

function mount(view: () => JSX.Element): void {
  host = document.createElement("div");
  document.body.appendChild(host);
  disposeApp = render(view, host);
}

afterEach(() => {
  disposeApp();
  host.remove();
});

describe("the sheet placeholder", () => {
  it("closes the sheet from the placeholder", () => {
    const close = vi.fn();
    mount(() => <SheetBodySkeleton onClose={close} />);
    (host.querySelector('[aria-label="关闭"]') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("brings one ✕ for the sheet", () => {
    mount(() => <SheetBodySkeleton onClose={vi.fn()} />);
    expect(host.querySelectorAll('[aria-label="关闭"]')).toHaveLength(1);
  });

  it("keeps the name of the screen while its header loads", () => {
    mount(() => <SheetTitleSkeleton title="any name" />);
    expect(host.querySelector("h1")?.textContent).toBe("any name");
    expect(host.querySelector('[aria-label="关闭"]')).toBeNull();
  });

  it("reserves one picture and the lines under it", () => {
    mount(() => <SheetBodySkeleton onClose={vi.fn()} />);
    expect(host.querySelectorAll(".sk-bar.h-72")).toHaveLength(1);
    expect(
      host.querySelectorAll(".sk-bar:not(.h-72)").length,
    ).toBeGreaterThanOrEqual(3);
  });
});
