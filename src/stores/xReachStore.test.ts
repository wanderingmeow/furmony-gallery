// A sheet asks one host for many pictures, so the read on X belongs to the sheet and not to a
// picture: a browser's protection refuses every one of them, and a network that carries nothing
// hangs every one of them. The read is an estimate, and one arrival takes it back at any time.
//
// Only a picture from X has a say. A picture from another host fails for its own reasons, and its
// failure must not blacken every picture on X.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { X_STALL_MS } from "./xReachStore";

const X = "https://pbs.twimg.com/media/one.jpg";
const ELSEWHERE = "https://cdn.example.invalid/a.png";

describe("what a sheet estimates about X", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const load = async () => await import("./xReachStore");

  it("claims nothing before a picture has stopped", async () => {
    const { createXGallery, xBlocked } = await load();
    expect(createXGallery().blocked(X)).toBeUndefined();
    expect(xBlocked()).toBeUndefined();
  });

  // The clock runs from the first address going into the document, which is when the asking began.
  it("names the network once the wait has run out", async () => {
    const { createXGallery, xBlocked } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    vi.advanceTimersByTime(X_STALL_MS);
    expect(gallery.blocked(X)).toBe("silent");
    expect(xBlocked()).toBe("silent");
  });

  // A second picture asked later is the same host being asked again, so it does not restart the
  // wait that the first one has already been sitting through.
  it("does not restart the wait for a picture that starts later", async () => {
    const { createXGallery } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    vi.advanceTimersByTime(X_STALL_MS - 2000);
    gallery.watched("https://pbs.twimg.com/media/two.jpg");
    vi.advanceTimersByTime(2000);
    expect(gallery.blocked(X)).toBe("silent");
  });

  it("takes the estimate back when a picture arrives", async () => {
    const { createXGallery } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    vi.advanceTimersByTime(2000);
    gallery.arrived(X);
    vi.advanceTimersByTime(X_STALL_MS);
    expect(gallery.blocked(X)).toBeUndefined();
  });

  // A picture on its way is not cancelled, so it can still arrive after the mark went up, and the
  // mark was only ever an estimate.
  it("takes the estimate back when a picture arrives late", async () => {
    const { createXGallery, xBlocked } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    vi.advanceTimersByTime(X_STALL_MS);
    expect(gallery.blocked(X)).toBe("silent");
    gallery.arrived(X);
    expect(gallery.blocked(X)).toBeUndefined();
    expect(xBlocked()).toBeUndefined();
  });

  // A browser's protection answers with a failure the same moment, so the wait is not needed.
  it("names the browser the moment a request is refused", async () => {
    const { createXGallery, xBlocked } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    gallery.refused(X);
    expect(gallery.blocked(X)).toBe("refused");
    expect(xBlocked()).toBe("refused");
  });

  // A host that has answered the sheet is not blocked by one picture that came back after.
  it("leaves a failure after an arrival to the picture it belongs to", async () => {
    const { createXGallery } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    gallery.arrived(X);
    gallery.refused(X);
    expect(gallery.blocked(X)).toBeUndefined();
  });

  it("starts the next sheet from what this one learned", async () => {
    const { createXGallery } = await load();
    createXGallery().refused(X);
    expect(createXGallery().blocked(X)).toBe("refused");
  });

  // The memory is a starting point and not a sentence: the user may have turned a VPN on between
  // two sheets, and the picture that arrives then clears what the visit remembered.
  it("clears what the visit remembered when a picture arrives", async () => {
    const { createXGallery, xBlocked } = await load();
    createXGallery().refused(X);
    const next = createXGallery();
    expect(next.blocked(X)).toBe("refused");
    next.arrived(X);
    expect(next.blocked(X)).toBeUndefined();
    expect(xBlocked()).toBeUndefined();
  });

  it("stops waiting when the sheet goes away", async () => {
    const { createXGallery, xBlocked } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    gallery.dispose();
    vi.advanceTimersByTime(X_STALL_MS);
    expect(gallery.blocked(X)).toBeUndefined();
    expect(xBlocked()).toBeUndefined();
  });

  it("starts no wait for a picture from another host", async () => {
    const { createXGallery, xBlocked } = await load();
    const gallery = createXGallery();
    gallery.watched(ELSEWHERE);
    vi.advanceTimersByTime(X_STALL_MS);
    expect(gallery.blocked(ELSEWHERE)).toBeUndefined();
    expect(xBlocked()).toBeUndefined();
  });

  it("keeps waiting when a picture from another host arrives", async () => {
    const { createXGallery } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    vi.advanceTimersByTime(X_STALL_MS);
    gallery.arrived(ELSEWHERE);
    expect(gallery.blocked(X)).toBe("silent");
  });

  it("names no browser for a picture from another host", async () => {
    const { createXGallery, xBlocked } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    gallery.refused(ELSEWHERE);
    expect(gallery.blocked(X)).toBeUndefined();
    expect(gallery.blocked(ELSEWHERE)).toBeUndefined();
    expect(xBlocked()).toBeUndefined();
  });

  it("answers nothing about a picture from another host", async () => {
    const { createXGallery } = await load();
    const gallery = createXGallery();
    gallery.watched(X);
    gallery.refused(X);
    expect(gallery.blocked(X)).toBe("refused");
    expect(gallery.blocked(ELSEWHERE)).toBeUndefined();
  });
});
