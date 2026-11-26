// The gallery opens in one of two ways, and `readyNow` is the switch.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { tr } from "../../i18n";
import type { DebutVideo } from "../../data/debuts";
import { createXGallery, X_STALL_MS } from "../../stores/xReachStore";
import {
  DETAIL_PAD_X,
  detailClipHeight,
  detailPictureHeight,
  sheetCardBox,
} from "../../draw/layout";
import { Gallery } from "./Gallery";
import { gallerySlots } from "./slots";

const { imageReady, preloadImage } = vi.hoisted(() => ({
  imageReady: vi.fn((_: string): boolean => false),
  preloadImage: vi.fn(),
}));

vi.mock("../../data/image", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return { ...real, imageReady, preloadImage };
});

const URLS = ["https://bucket.test/one.png", "https://bucket.test/two.png"];

// The clip's box stands at whichever of two rules is shorter, and each one wins on hardware a user
// really has: the clip's own 9:16 shape, and the room the screen leaves. The two windows below are
// both real, so each rule is read where it is met.
// A 393x852 phone with a 47pt band leaves 426 of height for the clip while its shape asks 642 of
// the 361 column the phone gives the art. A still is held to 397.1.
const PHONE = sheetCardBox(393, 852, { top: 47, right: 0, bottom: 0, left: 0 });
const PHONE_ART = PHONE.w - 2 * DETAIL_PAD_X;
const SCREEN_H = detailPictureHeight(PHONE, "sheet", 47);
const CLIP_H = detailClipHeight(PHONE, "sheet", 47);
// A 4K monitor stood on end, the browser in its left third at 2x, is 360 wide and 1920 tall. The
// screen leaves 960 there, so the shape's 583 is the rule the box stops at.
const TALL = sheetCardBox(360, 1920);
const TALL_ART = TALL.w - 2 * DETAIL_PAD_X;
const TALL_CLIP = detailClipHeight(TALL, "sheet");

const picture = (): HTMLImageElement =>
  ({
    naturalWidth: 1000,
    naturalHeight: 500,
    complete: true,
  }) as HTMLImageElement;

const job = (): { ready: Promise<HTMLImageElement>; cancel: () => void } => ({
  ready: Promise.resolve(picture()),
  cancel: vi.fn(),
});

/** A download that never answers, which is what a swallowed request does. */
const neverSettles = (): {
  ready: Promise<HTMLImageElement>;
  cancel: () => void;
} => ({
  ready: new Promise<HTMLImageElement>(() => {}),
  cancel: vi.fn(),
});

function mount(
  props: {
    images?: string[];
    maxH?: number;
    holdHeight?: boolean;
    index?: () => number;
    setIndex?: (i: number) => void;
    video?: () => DebutVideo | undefined;
    videoAfter?: () => number;
    clipMaxH?: number;
  } = {},
): {
  host: HTMLElement;
  done: () => void;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  // The squares are built the way the detail builds them: the pictures, and the clip standing among
  // them with its cover as the square's picture.
  const built = () => {
    const clip = props.video?.();
    return gallerySlots(
      props.images ?? URLS,
      [],
      clip && { url: clip.cover, thumb: clip.cover, clip },
      props.videoAfter?.() ?? 0,
    );
  };
  const dispose = render(
    () => (
      <Gallery
        slots={built()}
        index={() => 0}
        setIndex={() => {}}
        onOpenFull={() => {}}
        {...props}
      />
    ),
    host,
  );
  return {
    host,
    done: () => {
      dispose();
      host.remove();
    },
  };
}

const mainPic = (host: HTMLElement): HTMLImageElement | null =>
  host.querySelector("img");
// A picture and a frame each arrive on a layer over the box, and it is the layer that fades and
// decides whether a tap reaches them.
const onLayer = (el: Element | null | undefined): HTMLElement =>
  el!.parentElement as HTMLElement;
// The thumbnail boxes use the same fill, so this looks for the placeholder height.
const skeletonBlock = (host: HTMLElement): HTMLElement | null =>
  host.querySelector(".sk-bar.h-72");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  imageReady.mockReturnValue(false);
  preloadImage.mockReturnValue(job());
});

describe("Gallery first picture", () => {
  it("opens straight to the picture the browser already holds", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = mount();
    expect(imageReady).toHaveBeenCalledWith(URLS[0]);
    expect(skeletonBlock(host)).toBeNull();
    const pic = mainPic(host);
    expect(pic).not.toBeNull();
    expect(pic!.style.opacity).toBe("1");
    // The layout gives this picture its height, so nothing has to grow into place.
    expect(pic!.style.height).toBe("auto");
    done();
  });

  it("asks the browser only about the picture it is about to show", () => {
    const { done } = mount();
    expect(imageReady).toHaveBeenCalledTimes(1);
    expect(imageReady).toHaveBeenCalledWith(URLS[0]);
    done();
  });

  it("holds the space with a skeleton while the first picture is downloaded", async () => {
    const { host, done } = mount();
    expect(skeletonBlock(host)).not.toBeNull();
    await vi.waitFor(() => expect(mainPic(host)).not.toBeNull());
    expect(skeletonBlock(host)).toBeNull();
    done();
  });
});

describe("A panel that holds its height", () => {
  const held = () => mount({ maxH: SCREEN_H, holdHeight: true });

  it("stands at the height the screen gives, whatever the picture's shape", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = held();
    const pic = mainPic(host)!;
    // A 1000x500 source in a 300px column fits 150 tall. The box stands at the room the screen
    // gives at that width.
    Object.defineProperty(pic.parentElement!, "clientWidth", {
      value: 300,
      configurable: true,
    });
    Object.defineProperty(pic, "naturalWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(pic, "naturalHeight", {
      value: 500,
      configurable: true,
    });
    expect(pic.style.height).toBe(`${SCREEN_H}px`);
    done();
  });

  it("animates the fade and nothing else", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = held();
    const move = mainPic(host)!.style.transition;
    expect(move).toContain("opacity");
    expect(move).not.toContain("height");
    done();
  });

  it("keeps that height while the next picture arrives", async () => {
    imageReady.mockReturnValue(true);
    const [index, setIndex] = createSignal(0);
    const { host, done } = mount({
      maxH: SCREEN_H,
      holdHeight: true,
      index,
      setIndex,
    });
    const pic = mainPic(host)!;
    expect(pic.style.height).toBe(`${SCREEN_H}px`);
    setIndex(1);
    await vi.waitFor(() => expect(pic.src).toBe(URLS[1]));
    expect(pic.style.height).toBe(`${SCREEN_H}px`);
    done();
  });

  it("reports nothing to the card around it at mount", () => {
    imageReady.mockReturnValue(true);
    const changes = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const dispose = render(
      () => (
        <Gallery
          slots={gallerySlots(URLS, [])}
          index={() => 0}
          setIndex={() => {}}
          onOpenFull={() => {}}
          maxH={SCREEN_H}
          holdHeight
          onPicHeightChange={changes}
        />
      ),
      host,
    );
    expect(changes).not.toHaveBeenCalled();
    dispose();
    host.remove();
  });
});

describe("A container that changes width", () => {
  // The height the picture holds is pixels one width produced, so a new width must redo it. Each
  // observer is kept with the box it was pointed at, so the test fires the one the gallery aimed at
  // the picture's own box.
  const watchers: { cb: () => void; el: HTMLElement }[] = [];
  const stubObserver = () => {
    watchers.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        cb: () => void;
        constructor(cb: () => void) {
          this.cb = cb;
        }
        observe(el: HTMLElement) {
          watchers.push({ cb: this.cb, el });
        }
        disconnect() {}
      },
    );
  };
  const widenWatcher = (pic: HTMLImageElement) =>
    watchers.find((w) => w.el === pic.parentElement)!.cb;
  const widen = (el: HTMLElement, px: number) =>
    Object.defineProperty(el, "clientWidth", { value: px, configurable: true });
  // The gallery measures the element in the document; the job's stand-in never reaches it.
  const withSource = (pic: HTMLImageElement, w: number, h: number) => {
    Object.defineProperty(pic, "naturalWidth", {
      value: w,
      configurable: true,
    });
    Object.defineProperty(pic, "naturalHeight", {
      value: h,
      configurable: true,
    });
  };

  it("redoes the height when the container gets wider", async () => {
    imageReady.mockReturnValue(true);
    stubObserver();
    const { host, done } = mount();
    const pic = mainPic(host)!;
    widen(pic.parentElement!, 300);
    withSource(pic, 1000, 500);
    pic.style.height = "242px"; // the height that a sideways screen left behind
    widenWatcher(pic)();
    // The width observer is answered one frame later on purpose.
    await vi.waitFor(() => expect(pic.style.height).toBe("150px"));
    done();
  });

  it("reaches back up when a taller window lifts the ceiling", async () => {
    imageReady.mockReturnValue(true);
    stubObserver();
    let raise: (px: number) => void = () => {};
    const host = document.createElement("div");
    document.body.appendChild(host);
    const dispose = render(() => {
      const [maxH, setMaxH] = createSignal(150);
      raise = setMaxH;
      return (
        <Gallery
          slots={gallerySlots(URLS, [])}
          index={() => 0}
          setIndex={() => {}}
          onOpenFull={() => {}}
          maxH={maxH()}
        />
      );
    }, host);
    const pic = mainPic(host)!;
    widen(pic.parentElement!, 1000);
    withSource(pic, 1000, 500);
    widenWatcher(pic)();
    // A source of 1000x500 stands 500 tall at 1000 of width; the short ceiling holds it at 150.
    await vi.waitFor(() => expect(pic.style.height).toBe("150px"));
    raise(600);
    await vi.waitFor(() => expect(pic.style.height).toBe("500px"));
    dispose();
    host.remove();
  });
});

describe("The flow between pictures", () => {
  type Job = { ready: Promise<HTMLImageElement>; cancel: () => void };
  type Held = Job & { settle: () => void };

  const hold = (): Held => {
    let settle!: (pic: HTMLImageElement) => void;
    const ready = new Promise<HTMLImageElement>((done) => (settle = done));
    return { ready, cancel: vi.fn(), settle: () => settle(picture()) };
  };

  /** Every src the gallery asks the browser for, and the answer it is still owed. */
  const queue = (): Map<string, Held> => {
    const jobs = new Map<string, Held>();
    preloadImage.mockImplementation((src: string) => {
      const job = hold();
      jobs.set(src, job);
      return job;
    });
    return jobs;
  };

  // The index is per gallery: a swipe in one test must not start the next one part way through.
  const open = (start = 0) => {
    const [index, setIndex] = createSignal(start);
    return {
      ...mount({ maxH: SCREEN_H, holdHeight: true, index, setIndex }),
      turn: setIndex,
    };
  };
  // The two layers are the only pictures drawn inside each other; thumbnails crop instead.
  const layers = (host: HTMLElement) => [
    ...host.querySelectorAll<HTMLImageElement>("img.object-contain"),
  ];
  const top = (host: HTMLElement) => layers(host)[1];

  it("keeps the picture on screen while the next one is fetched", () => {
    imageReady.mockReturnValue(true);
    const jobs = queue();
    const { host, done, turn } = open();
    turn(1);
    expect(mainPic(host)!.src).toBe(URLS[0]);
    expect(top(host).src).toBe(URLS[1]);
    expect(onLayer(top(host)).style.opacity).toBe("0");
    expect(host.querySelector(".spinner")).not.toBeNull();
    expect(jobs.get(URLS[1])).toBeDefined();
    done();
  });

  it("fades the next picture in, then puts it on screen", async () => {
    imageReady.mockReturnValue(true);
    const jobs = queue();
    const { host, done, turn } = open();
    turn(1);
    jobs.get(URLS[1])!.settle();
    await vi.waitFor(() => expect(onLayer(top(host)).style.opacity).toBe("1"));
    await vi.waitFor(() => expect(layers(host).length).toBe(1));
    expect(mainPic(host)!.src).toBe(URLS[1]);
    done();
  });

  it("gives up on the older picture when a newer swipe lands", () => {
    imageReady.mockReturnValue(true);
    const jobs = queue();
    const { done, turn } = open();
    turn(1);
    turn(0);
    expect(jobs.get(URLS[1])!.cancel).toHaveBeenCalled();
    done();
  });

  it("cuts the fade short on a swipe back to the picture underneath", async () => {
    imageReady.mockReturnValue(true);
    const jobs = queue();
    const { host, done, turn } = open();
    turn(1);
    jobs.get(URLS[1])!.settle();
    await vi.waitFor(() => expect(onLayer(top(host)).style.opacity).toBe("1"));
    turn(0);
    await vi.waitFor(() => expect(layers(host).length).toBe(1));
    expect(mainPic(host)!.src).toBe(URLS[0]);
    done();
  });

  it("stops a download still running when the gallery goes away", () => {
    imageReady.mockReturnValue(true);
    const jobs = queue();
    const { done, turn } = open();
    turn(1);
    done();
    expect(jobs.get(URLS[1])!.cancel).toHaveBeenCalled();
  });

  it("holds the skeleton until the first picture settles", async () => {
    imageReady.mockReturnValue(false);
    const jobs = queue();
    const { host, done } = open();
    expect(skeletonBlock(host)).not.toBeNull();
    jobs.get(URLS[0])!.settle();
    await vi.waitFor(() => expect(skeletonBlock(host)).toBeNull());
    expect(mainPic(host)!.src).toBe(URLS[0]);
    done();
  });
});

describe("a picture from X that will not arrive", () => {
  const X = "https://pbs.twimg.com/media/AbcDef.jpg?format=jpg&name=medium";

  // Any arrival clears the visit's memory of X, which each case here starts fresh.
  beforeEach(() => {
    createXGallery().arrived(X);
  });

  it("settles the first square on the mark when its request is never answered", () => {
    vi.useFakeTimers();
    imageReady.mockReturnValue(false);
    const { host, done } = mount({ images: [X] });
    expect(skeletonBlock(host), "the skeleton").not.toBeNull();
    vi.advanceTimersByTime(X_STALL_MS);
    expect(skeletonBlock(host), "the skeleton is gone").toBeNull();
    expect(host.textContent).toContain(tr("picture.xBlocked"));
    done();
    vi.useRealTimers();
  });

  it("marks over the good picture still on screen when the new square's host is given up on", () => {
    imageReady.mockImplementation((src: string) => src !== X);
    preloadImage.mockImplementation(neverSettles);
    const [index, setIndex] = createSignal(0);
    createXGallery().refused(X);
    const { host, done } = mount({
      index,
      setIndex,
      images: ["https://bucket.test/one.png", X],
    });
    setIndex(1);
    const dim = onLayer(host.querySelector(".spinner")!);
    expect(dim.style.opacity, "no dim").toBe("0");
    expect(host.textContent, "the reason").toContain(tr("picture.xRefused"));
    done();
  });

  // The layer is found through its words, which are the visible text drawn inside it.
  it("fades the mark in", () => {
    vi.useFakeTimers();
    imageReady.mockReturnValue(true);
    const { host, done } = mount({ images: [X] });
    const layer = host
      .querySelector(`span.block`)!
      .closest(`.absolute`) as HTMLElement;
    expect(layer.style.opacity, "down").toBe("0");
    vi.advanceTimersByTime(X_STALL_MS);
    expect(layer.style.opacity, "up").toBe("1");
    expect(host.textContent).toContain(tr("picture.xBlocked"));
    done();
    vi.useRealTimers();
  });

  // A mark ends the switch it covers, so the box holds the square the user asked for. The next
  // switch fades from the marked square: a box that still held an older picture would crossfade it
  // back up from under the mark.
  it("does not carry the picture from before the mark into the next switch", () => {
    imageReady.mockReturnValue(true);
    preloadImage.mockImplementation(neverSettles);
    const [index, setIndex] = createSignal(0);
    createXGallery().refused(X);
    const { host, done } = mount({
      index,
      setIndex,
      images: ["https://bucket.test/c.png", X, "https://bucket.test/d.png"],
    });
    setIndex(1);
    expect(mainPic(host)!.src, "the box holds the marked square").toBe(X);
    setIndex(2);
    expect(mainPic(host)!.src, "the fade starts from the marked square").toBe(
      X,
    );
    done();
  });

  // The same swipe with nothing known about X: the dim is what the user sees while a picture the
  // sheet has no read on is on its way.
  it("still dims for a host the sheet has not given up on", () => {
    imageReady.mockImplementation((src: string) => src !== X);
    preloadImage.mockImplementation(neverSettles);
    const [index, setIndex] = createSignal(0);
    const { host, done } = mount({
      index,
      setIndex,
      images: ["https://bucket.test/one.png", X],
    });
    setIndex(1);
    const dim = onLayer(host.querySelector(".spinner")!);
    expect(dim.style.opacity, "the dim").toBe("1");
    done();
  });

  const failedPicture = () => {
    imageReady.mockReturnValue(true);
    const out = mount({ images: [X] });
    out.host.querySelector("img")!.dispatchEvent(new Event("error"));
    return out;
  };

  it("writes the reason, what it means, and what to do on three lines", () => {
    const { host, done } = failedPicture();
    const lines = [...host.querySelectorAll("a span.block")].map(
      (one) => one.textContent,
    );
    expect(lines).toEqual([
      tr("picture.xRefused"),
      tr("picture.xRefusedNote"),
      tr("picture.xRefusedFix"),
    ]);
    done();
  });

  it("opens the picture in a new window when a browser refused to load it", () => {
    const { host, done } = failedPicture();
    const link = host.querySelector("a")!;
    expect(link.getAttribute("href")).toBe(X);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("aria-label")).toBe(tr("detail.openPicture"));
    done();
  });

  it("says nothing about X on a picture from another host", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = mount({ images: ["https://bucket.test/one.png"] });
    host.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(host.querySelector("a"), "no link").toBeNull();
    done();
  });
});

describe("the clip of a debut", () => {
  const CLIP: DebutVideo = {
    bv: "BV1GJ411x7h7",
    cover: "https://i1.hdslb.com/bfs/archive/445b0ba5.jpg",
    seconds: 18,
  };
  // The player is what the user is being asked to wait for, so the tests look for its frame.
  // happy-dom declines to fetch a frame's document and says so once per mount; the attributes the
  // frame carries are the thing these tests read.
  const open = (
    video?: DebutVideo,
    after?: () => number,
    clipMaxH?: number,
  ) => {
    const [index, setIndex] = createSignal(0);
    const [clip, setClip] = createSignal<DebutVideo | undefined>(video);
    return {
      ...mount({
        index,
        setIndex,
        video: () => clip(),
        videoAfter: after,
        clipMaxH,
      }),
      turn: setIndex,
      replace: setClip,
    };
  };
  // The cover the frame is faded in over. It is the box's own picture, and the frame comes over it.
  const frameCover = (host: HTMLElement): HTMLImageElement | null =>
    host.querySelector("img");
  // happy-dom lays nothing out, so the width a 9:16 frame is drawn from is given here.
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  // The order of the squares, read off the strip: a picture names its place, the clip names itself.
  const order = (host: HTMLElement): string[] =>
    [...host.querySelectorAll<HTMLElement>("[data-thumb], [aria-label]")]
      .filter(
        (one) => one.tagName === "BUTTON" || one.hasAttribute("data-thumb"),
      )
      .map((one) =>
        one.tagName === "BUTTON" ? "clip" : `pic ${one.dataset.thumb}`,
      );
  // The strip's own square. The box of the clip holds a play button of the same name, and it comes
  // first in the document.
  const square = (host: HTMLElement): HTMLButtonElement | null =>
    host.querySelector<HTMLButtonElement>("[data-clip]");
  const player = (host: HTMLElement): HTMLIFrameElement | null =>
    host.querySelector("iframe");

  it("draws the square from the cover Bilibili drew for the clip", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    const img = square(host)!.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("445b0ba5");
    done();
  });

  // The detail counts the studio's own art and the album apart, and the clip belongs between them.
  it("stands after the studio's own pictures and before the album of the debut day", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP, () => 1);
    expect(order(host)).toEqual(["pic 0", "clip", "pic 2"]);
    done();
  });

  it("stands at the end of the strip when the listing has no album beside the clip", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP, () => 2);
    expect(order(host)).toEqual(["pic 0", "pic 1", "clip"]);
    done();
  });

  // A debut clip is shot standing up, so the box opens to its 9:16 shape for as long as that square
  // is the one on screen: before the player is asked for, while it runs, and after.
  // 583 is written out: 328 wide at 9:16 is the contract, and asking the layout for it would restate
  // the code the test reads. The screen leaves 960 here, so the shape is the shorter rule.
  it("opens the box to the clip's 9:16 shape for as long as its square is on screen", () => {
    imageReady.mockReturnValue(true);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
      TALL_ART,
    );
    const { host, done } = open(CLIP, undefined, TALL_CLIP);
    const box = () => host.querySelector("img")!;
    expect(box().style.height).toBe("583px");
    // The ceiling the box stands under opens with it, or the tall frame is cut back to the height a
    // still is given.
    expect(box().style.maxHeight).toBe(`${TALL_CLIP}px`);
    square(host)!.click();
    expect(box().style.height).toBe("583px");
    square(host)!.click();
    expect(box().style.height).toBe("583px");
    done();
  });

  // The other rule, on the hardware that meets it: a phone leaves less than the clip's shape asks,
  // and the strip has to stay under a finger.
  it("keeps the box at the room the screen leaves when the shape asks for more", () => {
    imageReady.mockReturnValue(true);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
      PHONE_ART,
    );
    const { host, done } = open(CLIP, undefined, CLIP_H);
    square(host)!.click();
    expect(host.querySelector("img")!.style.height).toBe(`${CLIP_H}px`);
    done();
  });

  // The frame belongs to the clip's square alone: the picture beside it keeps its own shape, or
  // every switch would resize the card.
  it("leaves a picture at its own shape beside the clip's square", () => {
    imageReady.mockReturnValue(true);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
      PHONE_ART,
    );
    const { host, done } = open(CLIP, () => 1, CLIP_H);
    expect(host.querySelector("img")!.style.height).toBe("auto");
    done();
  });

  // The square carries the state the strip's highlight is drawn from.
  it("says the clip is on while it runs, and says so no longer when it is off", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    expect(square(host)!.getAttribute("aria-pressed")).toBe("false");
    square(host)!.click();
    expect(square(host)!.getAttribute("aria-pressed")).toBe("true");
    square(host)!.click();
    expect(square(host)!.getAttribute("aria-pressed")).toBe("false");
    done();
  });

  it("writes on the square how long the clip runs", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    expect(square(host)!.textContent).toContain("0:18");
    done();
  });

  it("shows no square when the listing has no clip", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open();
    expect(square(host)).toBeNull();
    done();
  });

  // The player is the 2.5 MB the whole design exists to avoid paying twice.
  it("keeps the player away until the user asks for the clip", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    expect(player(host)).toBeNull();
    done();
  });

  it("mounts the player over the picture when the square is tapped", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    square(host)!.click();
    const src = player(host)!.src;
    expect(src).toContain("bvid=BV1GJ411x7h7");
    // The player reads its switches as words: `1` is not read as true, and the mobile player will
    // not start on it.
    expect(src).toContain("autoplay=true");
    expect(src).toContain("muted=true");
    expect(src).toContain("danmaku=false");
    // The part of a multi-part video is `p`. `page` is not a name the player reads.
    expect(src).toContain("p=1");
    expect(src).not.toContain("page=1");
    // The player is asked to draw the cover, so the frame arrives on a picture.
    expect(src).toContain("poster=1");
    done();
  });

  // The tap starts the download at once. What waits is the frame's arrival: a player that appears
  // the moment of the tap is a black box, and one that appears before its own poster is drawn is a
  // flash. The clip's cover is what the user looked at last, so that is what they keep looking at.
  it("keeps the clip's own cover up while the frame loads", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    square(host)!.click();
    const frame = player(host)!;
    expect(onLayer(frame).style.opacity).toBe("0");
    // A frame still behind its cover takes no tap.
    expect(onLayer(frame).style.pointerEvents).toBe("none");
    expect(frameCover(host)!.getAttribute("src")).toContain("445b0ba5");
    done();
  });

  it("fades the frame in when its document arrives, at the pace a picture does", () => {
    vi.useFakeTimers();
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    square(host)!.click();
    const frame = player(host)!;
    const layer = onLayer(frame);
    vi.advanceTimersByTime(4_000);
    expect(layer.style.opacity, "still behind the cover").toBe("0");
    frame.dispatchEvent(new Event("load"));
    expect(layer.style.opacity).toBe("1");
    expect(layer.style.pointerEvents).toBe("auto");
    expect(layer.style.transitionDuration).toBe("200ms");
    done();
  });

  // A frame that never reports is let in at the ceiling.
  it("shows a frame that never reports its document", () => {
    vi.useFakeTimers();
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    square(host)!.click();
    const frame = player(host)!;
    vi.advanceTimersByTime(7_900);
    expect(onLayer(frame).style.opacity).toBe("0");
    vi.advanceTimersByTime(200);
    expect(onLayer(frame).style.opacity).toBe("1");
    done();
  });

  // The clip is Bilibili's own page inside a frame of ours: the least it can do is stay in the
  // frame, and the player still needs to run its own scripts and read its own storage.
  it("holds the frame to the least it can give the player", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    square(host)!.click();
    const frame = player(host)!;
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin allow-popups",
    );
    // The frame has to keep the referrer: Bilibili's CDN answers 403 to a video request that
    // arrives without one, which is the clip failing after the player itself opened.
    expect(frame.getAttribute("referrerpolicy")).toBeNull();
    done();
  });

  // The square is the way out: it lights while the clip runs, and a second tap puts it out.
  it("takes the player away when the square is tapped again", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = open(CLIP);
    square(host)!.click();
    square(host)!.click();
    expect(player(host)).toBeNull();
    done();
  });

  // The square of the picture already on screen asks for nothing new, so the index does not move.
  // A clip that stopped only on a moved index would play on over the picture the user reached for
  // and the strip holds no lit square while the clip runs, so the tap looks like
  // a dead one.
  it("stops the clip for the square of the picture already on screen", () => {
    imageReady.mockReturnValue(true);
    // The strip runs picture, clip, picture, and the user is on the last of them.
    const [index, setIndex] = createSignal(2);
    const { host, done } = mount({
      index,
      setIndex,
      video: () => CLIP,
      videoAfter: () => 1,
    });
    const counter = () =>
      host.querySelector("[role='status']")!.textContent!.trim();
    square(host)!.click();
    expect(player(host), "the clip is playing").not.toBeNull();
    expect(counter(), "the clip's square is on screen").toContain("2 /");
    host.querySelector<HTMLElement>('[data-thumb="2"]')!.click();
    expect(player(host), "the clip stopped").toBeNull();
    expect(counter(), "back on the picture they came from").toContain("3 /");
    done();
  });

  // The cover is switched to the way a picture is: the box crossfades to it. The player is asked
  // for by the same tap that chose the square, and it arrives with nothing drawn in it, so the frame
  // stays clear until it has.
  it("crossfades the cover in and keeps the frame clear until it draws", async () => {
    imageReady.mockReturnValue(true);
    const [index, setIndex] = createSignal(0);
    const { host, done } = mount({
      index,
      setIndex,
      video: () => CLIP,
      videoAfter: () => 1,
    });
    square(host)!.click();
    expect(player(host), "the square asked for the player").not.toBeNull();
    await vi.waitFor(() =>
      expect(host.querySelector("img")!.getAttribute("src")).toContain(
        "445b0ba5",
      ),
    );
    done();
  });

  // The cover is asked for before the user reaches the square, so the switch is not a wait.
  it("asks for the cover while the square is still in the strip", () => {
    imageReady.mockReturnValue(true);
    const { done } = mount({ video: () => CLIP, videoAfter: () => 1 });
    expect(preloadImage.mock.calls.flat()).toContain(CLIP.cover);
    done();
  });

  // The cover is drawn across, so leaving the clip must not drop the box to the cover's shape: the
  // tall frame is kept until the next picture is on screen, and the box stands up once.
  it("keeps the tall frame until the picture after the clip has landed", async () => {
    imageReady.mockReturnValue(true);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
      TALL_ART,
    );
    const [index, setIndex] = createSignal(0);
    const { host, done } = mount({
      index,
      setIndex,
      images: [URLS[0]],
      video: () => CLIP,
      videoAfter: () => 0,
      clipMaxH: TALL_CLIP,
    });
    const box = () => host.querySelector("img")!;
    expect(box().style.height, "the clip's own frame").toBe("583px");
    setIndex(1);
    expect(box().style.height, "still the tall frame mid-switch").toBe("583px");
    await vi.waitFor(() =>
      expect(host.querySelector("img")!.getAttribute("src")).toBe(URLS[0]),
    );
    // 328 wide at 1000x500 is the picture's own shape.
    expect(box().style.height, "the picture's own shape").toBe("164px");
    done();
  });

  // A swipe or a new listing means the user stopped looking at this clip, and its sound and its
  // bytes should stop with it.
  it("stops the clip when the page turns", () => {
    imageReady.mockReturnValue(true);
    const { host, done, turn } = open(CLIP);
    square(host)!.click();
    turn(1);
    expect(player(host)).toBeNull();
    done();
  });

  it("stops the clip when the listing changes to one with a clip of its own", () => {
    imageReady.mockReturnValue(true);
    const { host, done, replace } = open(CLIP);
    square(host)!.click();
    replace({ ...CLIP, bv: "BV1xx411c7mD" });
    expect(player(host)).toBeNull();
    done();
  });
});
