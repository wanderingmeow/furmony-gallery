// Functional tests for the picture module: the signed URL map, the sizes, and the probe. No
// network, no rendering. fake-indexeddb provides a real-ish IndexedDB; localStorage comes from
// the testSetup shim.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ImageModule = typeof import("./index");

// One module per test, because the map and the dirty set live at module level.
let img: ImageModule;
beforeEach(async () => {
  vi.resetModules();
  img = await import("./index");
});

// The write is reached the way the page reaches it: register for the exit, then let one arrive.
const flushOnExit = async (): Promise<void> => {
  img.flushUrlMapOnExit();
  window.dispatchEvent(new Event("pagehide"));
  await new Promise((done) => setTimeout(done, 10));
};

describe("stableImageUrl (img_url_map)", () => {
  it("maps a signed URL (with ?) and remembers the first-seen URL", () => {
    const first = img.stableImageUrl("https://a.jpg?sig=1");
    // same path with a different signature returns the remembered one
    expect(img.stableImageUrl("https://a.jpg?sig=999")).toBe(
      "https://a.jpg?sig=1",
    );
    expect(first).toBe("https://a.jpg?sig=1");
  });

  it("bypasses no-query URLs entirely (nothing stored, raw returned)", () => {
    expect(img.stableImageUrl("https://plain.jpg")).toBe("https://plain.jpg");
  });

  it("passes undefined through", () => {
    expect(img.stableImageUrl(undefined)).toBeUndefined();
  });

  it("persists dirty entries to IndexedDB and reloads them on a fresh module", async () => {
    img.stableImageUrl("https://a.jpg?x=1");
    await flushOnExit();

    vi.resetModules();
    img = await import("./index");
    await img.initImageUrlMap();

    // remembered URL from DB wins over the fresh signature
    expect(img.stableImageUrl("https://a.jpg?y=2")).toBe("https://a.jpg?x=1");
  });

  it("a load that failed leaves the dead address out of the map", () => {
    const dead = img.stableImageUrl("https://cdn.example/1.jpg?sig=old");
    // The API signs again. The map still answers the address it already has.
    img.stableImageUrl("https://cdn.example/1.jpg?sig=new");

    const el = { src: dead, dataset: {} } as unknown as HTMLImageElement;
    img.onImageError({ target: el } as unknown as Event);

    expect(img.stableImageUrl("https://cdn.example/1.jpg?sig=again")).toBe(
      "https://cdn.example/1.jpg?sig=new",
    );
  });

  it("the address a failed load corrected is what the next visit reads", async () => {
    const dead = img.stableImageUrl("https://cdn.example/2.jpg?sig=old");
    img.stableImageUrl("https://cdn.example/2.jpg?sig=new");

    const el = { src: dead, dataset: {} } as unknown as HTMLImageElement;
    img.onImageError({ target: el } as unknown as Event);
    await flushOnExit();

    vi.resetModules();
    img = await import("./index");
    await img.initImageUrlMap();
    expect(img.stableImageUrl("https://cdn.example/2.jpg?sig=later")).toBe(
      "https://cdn.example/2.jpg?sig=new",
    );
  });
});

describe("flushUrlMapOnExit", () => {
  // Mobile Safari fires pagehide and often skips beforeunload, so both are registered and the
  // first one alone writes. A second write would put whatever the reader loaded in the last
  // moments on disk, and that is not what the exit flush is for.
  it("writes once, on whichever exit event arrives first", async () => {
    img.stableImageUrl("https://a.jpg?x=1");
    img.flushUrlMapOnExit();
    window.dispatchEvent(new Event("pagehide"));
    img.stableImageUrl("https://b.jpg?x=2");
    window.dispatchEvent(new Event("beforeunload"));
    await new Promise((done) => setTimeout(done, 10));

    vi.resetModules();
    img = await import("./index");
    await img.initImageUrlMap();
    expect(img.stableImageUrl("https://a.jpg?y=9")).toBe("https://a.jpg?x=1");
    expect(img.stableImageUrl("https://b.jpg?z=9")).toBe("https://b.jpg?z=9");
  });
});

describe("urlPath (the part that identifies an image)", () => {
  it("drops the signature", () => {
    expect(img.urlPath("https://cdn.example/1.jpg?q-signature=abc")).toBe(
      "https://cdn.example/1.jpg",
    );
  });

  it("leaves an unsigned URL alone", () => {
    expect(img.urlPath("https://cdn.example/1.jpg")).toBe(
      "https://cdn.example/1.jpg",
    );
  });

  // The compare also looks at text fields, and a name can end in a question mark.
  it("leaves text alone, question mark and all", () => {
    expect(img.urlPath("这是什么?")).toBe("这是什么?");
    expect(img.urlPath("/relative/path.png?x=1")).toBe(
      "/relative/path.png?x=1",
    );
  });
});

describe("sizedUrl", () => {
  const signed =
    "https://bucket.cos.ap-guangzhou.myqcloud.com/cover/2839.png" +
    "?sign=abc&q-sign-time=1700000000;1700003600";

  it("appends the card preset to a signed address", () => {
    expect(img.sizedUrl(signed, "card")).toBe(
      `${signed}&imageMogr2/thumbnail/600x%3E/quality/80/format/webp/strip`,
    );
  });

  it("appends the detail preset at 1300 and q85", () => {
    expect(img.sizedUrl(signed, "detail")).toBe(
      `${signed}&imageMogr2/thumbnail/1300x%3E/quality/85/format/webp/strip`,
    );
  });

  it("appends the badge preset for the 60 px and 36 px thumbnails", () => {
    expect(img.sizedUrl(signed, "badge")).toBe(
      `${signed}&imageMogr2/thumbnail/180x%3E/quality/80/format/webp/strip`,
    );
  });

  it("starts the parameter with ? when the address has no query yet", () => {
    expect(img.sizedUrl("https://x.cos.myqcloud.com/a.jpg", "card")).toBe(
      "https://x.cos.myqcloud.com/a.jpg?imageMogr2/thumbnail/600x%3E/quality/80/format/webp/strip",
    );
  });

  // A rewritten query is a 403, so the signed text has to come through whole.
  it("leaves the signed address intact in front of the parameter", () => {
    expect(img.sizedUrl(signed, "card")!.startsWith(signed)).toBe(true);
  });

  // 885 kB of one cover was XMP the source carried and the bucket copied into every output.
  it("drops the metadata the source drags along", () => {
    for (const preset of ["card", "detail", "badge"] as const) {
      expect(img.sizedUrl(signed, preset)).toMatch(/\/strip$/);
    }
  });

  // Measured here: for a PNG source the bucket answers AVIF with a lossless file 8x the size.
  it("stays on webp", () => {
    for (const preset of ["card", "detail", "badge"] as const) {
      expect(img.sizedUrl(signed, preset)).not.toMatch(/avif/i);
    }
  });

  // The image cache is keyed by urlPath, which ignores the query, so resizing must not add an entry.
  it("keeps the same cache key as the address it came from", () => {
    for (const preset of ["card", "detail", "badge"] as const) {
      expect(img.urlPath(img.sizedUrl(signed, preset)!)).toBe(
        img.urlPath(signed),
      );
    }
  });

  it("asking twice adds the parameter once", () => {
    const once = img.sizedUrl(signed, "card")!;
    expect(img.sizedUrl(once, "card")).toBe(once);
  });

  // A bucket that stops answering the parameter is retried at the plain address.
  it("an error on a sized address retries with the original address", () => {
    const raw = img.stableImageUrl(signed);
    const el = {
      src: img.sizedUrl(raw, "card"),
      dataset: {},
    } as unknown as HTMLImageElement;
    img.onImageError({ target: el } as unknown as Event);
    expect(el.src).toBe(raw);
    expect(el.src).not.toMatch(/imageMogr2/);
  });

  it("writes the size on the path for a Bilibili address", () => {
    const bili = "https://i0.hdslb.com/bfs/new_dyn/7519fd93.jpg";
    expect(img.sizedUrl(bili, "detail")).toBe(`${bili}@1300w.webp`);
    expect(img.sizedUrl(bili, "card")).toBe(`${bili}@600w.webp`);
    expect(img.sizedUrl(bili, "badge")).toBe(`${bili}@180w.webp`);
  });

  it("asks Bilibili for a format only after the browser says it can", () => {
    const bili = "https://i1.hdslb.com/bfs/new_dyn/a.jpg";
    expect(img.sizedUrl(bili, "detail")).toMatch(/\.webp$/);
  });

  it("asking Bilibili twice writes the size once", () => {
    const once = img.sizedUrl(
      "https://i0.hdslb.com/bfs/new_dyn/a.jpg",
      "detail",
    )!;
    expect(img.sizedUrl(once, "detail")).toBe(once);
  });

  it("leaves anything the bucket cannot resize alone", () => {
    expect(img.sizedUrl("https://other.example.com/a.jpg?x=1", "card")).toBe(
      "https://other.example.com/a.jpg?x=1",
    );
    expect(img.sizedUrl("data:image/jpeg;base64,AAAA", "card")).toBe(
      "data:image/jpeg;base64,AAAA",
    );
    expect(img.sizedUrl("/local/a.jpg", "detail")).toBe("/local/a.jpg");
    expect(img.sizedUrl(undefined, "card")).toBeUndefined();
  });
});

/** Stands in for the browser's image loader: nothing is fetched, and the test decides when the
 *  download finishes. */
class FakeImage {
  static last: FakeImage | undefined;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  naturalWidth = 0;
  src = "";
  referrerPolicy = "";
  constructor() {
    FakeImage.last = this;
  }
  arrive(): void {
    this.complete = true;
    this.onload?.();
  }
  broken(): void {
    this.complete = true;
    this.onerror?.();
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("preloadImage", () => {
  beforeEach(() => {
    FakeImage.last = undefined;
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("settles with the picture once the download finishes", async () => {
    let pic: unknown;
    const job = img.preloadImage("https://a.jpg");
    job.ready.then((p) => {
      pic = p;
    });
    const el = FakeImage.last!;
    el.arrive();
    await flush();
    expect(pic).toBe(el);
  });

  it("settles on a failed load too, so the caller can still show something", async () => {
    let pic: unknown;
    const job = img.preloadImage("https://a.jpg");
    job.ready.then((p) => {
      pic = p;
    });
    FakeImage.last!.broken();
    await flush();
    expect(pic).toBe(FakeImage.last);
  });

  it("names no page, because a host with a referrer rule reads that as the answer", () => {
    img.preloadImage("https://a.jpg");
    expect(FakeImage.last!.referrerPolicy).toBe("no-referrer");
  });

  it("cancel clears an address that is still pending", () => {
    const job = img.preloadImage("https://a.jpg");
    job.cancel();
    expect(FakeImage.last!.src).toBe("");
  });

  it("leaves a load that already finished alone", () => {
    const job = img.preloadImage("https://a.jpg");
    FakeImage.last!.arrive();
    job.cancel();
    expect(FakeImage.last!.src).toBe("https://a.jpg");
  });

  it("a canceled job ignores the answer that arrives later", async () => {
    let settled = false;
    const job = img.preloadImage("https://a.jpg");
    job.ready.then(() => {
      settled = true;
    });
    job.cancel();
    FakeImage.last!.broken();
    await flush();
    expect(settled).toBe(false);
  });
});

describe("the format Bilibili is asked for", () => {
  const bili = "https://i0.hdslb.com/bfs/new_dyn/a.jpg";
  beforeEach(() => {
    FakeImage.last = undefined;
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is webp while the browser has not answered", () => {
    expect(img.sizedUrl(bili, "badge")).toBe(`${bili}@180w.webp`);
  });

  it("is AVIF once the probe draws", () => {
    img.probeAvif();
    FakeImage.last!.naturalWidth = 1;
    FakeImage.last!.arrive();
    expect(img.sizedUrl(bili, "badge")).toBe(`${bili}@180w.avif`);
  });

  it("is webp again when the probe cannot draw", () => {
    img.probeAvif();
    FakeImage.last!.broken();
    expect(img.sizedUrl(bili, "badge")).toBe(`${bili}@180w.webp`);
  });

  it("the probe names no page and carries no download", () => {
    img.probeAvif();
    const el = FakeImage.last!;
    expect(el.referrerPolicy).toBe("no-referrer");
    expect(el.src.startsWith("data:image/avif;base64,")).toBe(true);
  });
});
