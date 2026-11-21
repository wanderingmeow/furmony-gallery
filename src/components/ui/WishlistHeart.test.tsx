// These tests cover when the burst plays: one rise of `savedHere` is one burst, and nothing else
// moves it - not a mount that is already saved, not a save made elsewhere, not an unsave.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { WishlistHeart } from "./WishlistHeart";

let disposeApp: () => void;
let host: HTMLDivElement;

function mount(view: () => JSX.Element): void {
  host = document.createElement("div");
  document.body.appendChild(host);
  disposeApp = render(view, host);
}

const sparks = () => host.querySelectorAll(".heart-spark");

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => cb(0));
});

afterEach(() => {
  disposeApp();
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("WishlistHeart", () => {
  it("shows a filled heart and no burst for a listing already saved", () => {
    mount(() => <WishlistHeart on savedHere={0} />);
    expect(sparks()).toHaveLength(0);
    expect(host.querySelector(".heart-pop")).toBeNull();
  });

  it("plays on a save, then leaves the tree", () => {
    const [saved, setSaved] = createSignal(false);
    const [savedHere, setSavedHere] = createSignal(0);
    mount(() => <WishlistHeart on={saved()} savedHere={savedHere()} />);
    setSaved(true);
    setSavedHere(1);
    expect(sparks()).toHaveLength(6);
    expect(host.querySelector(".heart-pop")).not.toBeNull();
    vi.advanceTimersByTime(620);
    expect(sparks()).toHaveLength(0);
    expect(host.querySelector(".heart-pop")).toBeNull();
  });

  it("plays again for the next save", () => {
    const [savedHere, setSavedHere] = createSignal(0);
    mount(() => <WishlistHeart on savedHere={savedHere()} />);
    setSavedHere(1);
    vi.advanceTimersByTime(620);
    setSavedHere(2);
    expect(sparks()).toHaveLength(6);
  });

  it("stays quiet when the listing leaves the wishlist", () => {
    const [saved, setSaved] = createSignal(true);
    mount(() => <WishlistHeart on={saved()} savedHere={1} />);
    setSaved(false);
    expect(sparks()).toHaveLength(0);
  });

  it("stays quiet when the listing is saved somewhere else", () => {
    const [saved, setSaved] = createSignal(false);
    mount(() => <WishlistHeart on={saved()} savedHere={0} />);
    setSaved(true);
    expect(sparks()).toHaveLength(0);
  });

  it("sizes the burst by the heart, not by the row around it", () => {
    const [savedHere, setSavedHere] = createSignal(0);
    mount(() => <WishlistHeart on={false} savedHere={savedHere()} size={18} />);
    setSavedHere(1);
    expect(host.querySelector(".heart-burst")?.getAttribute("style")).toContain(
      "font-size: 18px",
    );
  });
});
