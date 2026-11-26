// The gallery opens in one of two ways, and `readyNow` is the switch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { Gallery } from "./Gallery";

const { imageReady, preloadImage } = vi.hoisted(() => ({
  imageReady: vi.fn((): boolean => false),
  preloadImage: vi.fn(),
}));

vi.mock("../../data/image", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return { ...real, imageReady, preloadImage };
});

const URLS = ["https://bucket.test/one.png", "https://bucket.test/two.png"];

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

function mount(
  props: {
    maxH?: number;
    holdHeight?: boolean;
    index?: () => number;
    setIndex?: (i: number) => void;
  } = {},
): {
  host: HTMLElement;
  done: () => void;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(
    () => (
      <Gallery
        images={URLS}
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
  const held = () => mount({ maxH: 604, holdHeight: true });

  it("stands at the height the screen gives, whatever the picture's shape", () => {
    imageReady.mockReturnValue(true);
    const { host, done } = held();
    const pic = mainPic(host)!;
    // A 1000x500 source in a 300px column fits 150 tall; the screen says 604.
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
    expect(pic.style.height).toBe("604px");
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
      maxH: 604,
      holdHeight: true,
      index,
      setIndex,
    });
    const pic = mainPic(host)!;
    expect(pic.style.height).toBe("604px");
    setIndex(1);
    await vi.waitFor(() => expect(pic.src).toBe(URLS[1]));
    expect(pic.style.height).toBe("604px");
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
          images={URLS}
          index={() => 0}
          setIndex={() => {}}
          onOpenFull={() => {}}
          maxH={604}
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
  // the picture's own box rather than whichever was armed last.
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
  // The element the gallery measures is the one in the document, not the job's stand-in.
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
          images={URLS}
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
      ...mount({ maxH: 604, holdHeight: true, index, setIndex }),
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
    expect(top(host).style.opacity).toBe("0");
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
    await vi.waitFor(() => expect(top(host).style.opacity).toBe("1"));
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
    await vi.waitFor(() => expect(top(host).style.opacity).toBe("1"));
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
