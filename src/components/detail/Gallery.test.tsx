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

function mount(props: { maxH?: number } = {}): {
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

describe("A container that changes width", () => {
  // The height the picture holds is pixels one width produced, so a new width must redo it.
  const watchers: (() => void)[] = [];
  const stubObserver = () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          watchers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
  };
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
    pic.style.height = "242px"; // the height a sideways screen left behind
    watchers.at(-1)!();
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
    watchers.at(-1)!();
    // A source of 1000x500 stands 500 tall at 1000 of width; the short ceiling holds it at 150.
    await vi.waitFor(() => expect(pic.style.height).toBe("150px"));
    raise(600);
    await vi.waitFor(() => expect(pic.style.height).toBe("500px"));
    dispose();
    host.remove();
  });
});
