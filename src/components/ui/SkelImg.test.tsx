// A box keeps its size when a picture fails, so the row around it does not move. What sits in the
// box depends on what is known: a picture that came back with a failure says it did not load, and a
// picture in a sheet that has settled about X says what the sheet settled on. A picture still on its
// way says nothing, and outside a sheet nothing is ever settled about a host. A card in
// a list has no other picture to compare itself with, so it waits as long as the browser does.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { tr } from "../../i18n";
import { createXGallery, type XGallery } from "../../stores/xReachStore";
import { SkelImg } from "./SkelImg";

// The signed-address swap behind `onImageError` is tested in data/image. Here it answers the one
// thing SkelImg waits for: there is no newer address for this picture.
vi.mock("../../data/image", () => ({
  isTwimg: (url: string) => url.includes("pbs.twimg.com"),
  onImageError: () => {},
}));

const X_URL = "https://pbs.twimg.com/media/AbcDef.jpg";
const BILI_URL = "https://i0.hdslb.com/bfs/newfd/abc.jpg";

let host: HTMLDivElement;
let dispose: (() => void) | undefined;

function draw(url: string, gallery?: XGallery): HTMLDivElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  dispose = render(
    () => <SkelImg url={url} box="w-10 h-10" gallery={gallery} />,
    host,
  );
  return host;
}

/** A picture in a sheet that already has a read on X. */
function drawIn(gallery: XGallery): HTMLDivElement {
  return draw(X_URL, gallery);
}

/** What the visit remembers when the last thing it saw was a picture from X arriving. */
function xAnswers(): void {
  createXGallery().arrived(X_URL);
}

/** The picture reporting that no pixels are coming. */
function noPixels(box: HTMLElement): void {
  box.querySelector("img")?.dispatchEvent(new Event("error"));
}

/** The picture reporting pixels. */
function somePixels(box: HTMLElement): void {
  box.querySelector("img")?.dispatchEvent(new Event("load"));
}

const mark = (box: HTMLElement) => box.querySelector('[role="img"]');
const said = (box: HTMLElement) => mark(box)?.getAttribute("aria-label");

afterEach(() => {
  dispose?.();
  host?.remove();
});

describe("a picture that will not arrive", () => {
  it("says a picture that came back with a failure did not load", () => {
    const box = draw(X_URL);
    noPixels(box);
    expect(mark(box), "the mark").not.toBeNull();
    expect(said(box)).toBe(tr("picture.missing"));
  });

  // A picture that is not there is not there whoever served it, so the box says the same thing
  // whatever the host was.
  it("says the same about a picture from another host", () => {
    const box = draw(BILI_URL);
    noPixels(box);
    expect(said(box)).toBe(tr("picture.missing"));
  });

  // The wait belongs to a sheet, where several pictures share one host. A card in a list has no
  // such company, and one picture says nothing about a host, so a card keeps waiting.
  // The picture is still in the box, holding its shape, so a mark that is merely next to it lands
  // below the fold of a box clipped to the picture's size.
  it("lays the mark over the box the picture holds", () => {
    const box = draw(X_URL);
    noPixels(box);
    expect(mark(box)!.parentElement!.className).toContain("absolute");
  });

  it("says nothing while a picture is still on its way", () => {
    vi.useFakeTimers();
    const box = draw(X_URL);
    vi.advanceTimersByTime(60_000);
    expect(mark(box), "no mark").toBeNull();
    vi.useRealTimers();
  });

  it("says nothing about a picture that arrived", () => {
    const box = draw(X_URL);
    somePixels(box);
    expect(mark(box), "no mark").toBeNull();
  });
});

describe("a picture in a sheet that settled about X", () => {
  // A request that came back broken never left the page: Firefox's tracking protection and an
  // add-on answer this way, and their own network is fine. Saying "this picture did not load" here
  // would hide the one thing the user can do about it.
  // A read on X is a read on X. The pictures in the same row came from elsewhere, and darkening
  // them tells the user Qzone is down because X did not answer.
  it("leaves a picture from another host out of the read on X", () => {
    const gallery = createXGallery();
    const box = draw(BILI_URL, gallery);
    gallery.refused(X_URL);
    expect(mark(box), "no mark").toBeNull();
  });

  // A picture from elsewhere that fails has nothing to report about X: it would otherwise blacken
  // every picture on X through the box it sits in.
  it("keeps a picture from another host out of what the sheet learns", () => {
    xAnswers();
    const gallery = createXGallery();
    const box = draw(BILI_URL, gallery);
    noPixels(box);
    expect(gallery.blocked(X_URL)).toBeUndefined();
  });

  it("names the browser the reason a picture failed", () => {
    const box = drawIn(createXGallery());
    noPixels(box);
    expect(said(box)).toBe(tr("picture.xRefused"));
  });

  it("marks a picture that never answered, on the sheet's read", () => {
    const gallery = createXGallery();
    const box = drawIn(gallery);
    gallery.refused(X_URL);
    expect(mark(box), "the mark").not.toBeNull();
    expect(said(box)).toBe(tr("picture.xRefused"));
  });

  it("takes the mark off when a picture arrives", () => {
    const gallery = createXGallery();
    const box = drawIn(gallery);
    gallery.refused(X_URL);
    gallery.arrived(X_URL);
    expect(mark(box), "no mark").toBeNull();
  });

  it("keeps the mark on a picture that failed after the sheet reached X", () => {
    const gallery = createXGallery();
    const box = drawIn(gallery);
    gallery.arrived(X_URL);
    noPixels(box);
    expect(said(box)).toBe(tr("picture.missing"));
  });
});
