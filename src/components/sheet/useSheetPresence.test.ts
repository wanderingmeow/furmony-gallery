import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { useSheetPresence } from "./useSheetPresence";

const MOVE_MS = 200;
// useSheetPresence waits out the layer's move plus 80ms.
const SETTLE = MOVE_MS + 80;

/** One round trip of the layer, with the route in hand and every move recorded. */
function trip(start = true) {
  const [open, setOpen] = createSignal(start);
  const moves: string[] = [];
  let api!: ReturnType<typeof useSheetPresence>;
  let dispose!: () => void;
  createRoot((done) => {
    dispose = done;
    api = useSheetPresence({
      open,
      onDismiss: () => {
        moves.push("route");
        setOpen(false);
      },
      moveMs: () => MOVE_MS,
      onEnter: () => moves.push("enter"),
      onLeave: () => moves.push("leave"),
      onReturn: () => moves.push("return"),
    });
  });
  return { open, setOpen, moves, api, dispose };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the layer against the route", () => {
  it("arrives when the route already points here", () => {
    const { api, moves, dispose } = trip();
    expect(api.shown()).toBe(true);
    expect(api.closing()).toBe(false);
    expect(moves).toEqual(["enter"]);
    dispose();
  });

  it("waits for the layer when the route lets go", () => {
    vi.useFakeTimers();
    const { api, setOpen, moves, dispose } = trip();
    setOpen(false);
    expect(api.shown()).toBe(true);
    expect(api.closing()).toBe(true);
    expect(moves).toEqual(["enter", "leave"]);
    vi.advanceTimersByTime(SETTLE);
    expect(api.shown()).toBe(false);
    expect(moves).toEqual(["enter", "leave"]);
    dispose();
  });

  it("ends the slide the moment the route comes back", () => {
    vi.useFakeTimers();
    const { api, setOpen, moves, dispose } = trip();
    setOpen(false);
    vi.advanceTimersByTime(100);
    setOpen(true);
    // The dim's animation restarts on the class swap.
    expect(api.closing()).toBe(false);
    expect(moves).toEqual(["enter", "leave", "return"]);
    vi.advanceTimersByTime(SETTLE);
    expect(api.shown()).toBe(true);
    expect(moves).toEqual(["enter", "leave", "return"]);
    dispose();
  });

  it("moves the route only once the layer has left", () => {
    vi.useFakeTimers();
    const { api, open, moves, dispose } = trip();
    api.dismiss();
    expect(moves).toEqual(["enter", "leave"]);
    expect(open()).toBe(true);
    vi.advanceTimersByTime(SETTLE);
    expect(moves).toEqual(["enter", "leave", "route"]);
    expect(api.shown()).toBe(false);
    dispose();
  });

  it("keeps the clock of the first close when a second one lands", () => {
    vi.useFakeTimers();
    const { api, moves, dispose } = trip();
    api.dismiss();
    vi.advanceTimersByTime(100);
    api.dismiss();
    expect(moves).toEqual(["enter", "leave"]);
    vi.advanceTimersByTime(SETTLE - 100);
    expect(api.shown()).toBe(false);
    expect(moves).toEqual(["enter", "leave", "route"]);
    dispose();
  });

  it("leaves the route alone when a back press moved it during the close", () => {
    vi.useFakeTimers();
    const { api, setOpen, moves, dispose } = trip();
    api.dismiss();
    setOpen(false);
    vi.advanceTimersByTime(SETTLE);
    expect(api.shown()).toBe(false);
    expect(moves).toEqual(["enter", "leave"]);
    dispose();
  });

  it("owes the route nothing once the sheet is gone", () => {
    vi.useFakeTimers();
    const { api, dispose, moves } = trip();
    api.dismiss();
    dispose();
    vi.advanceTimersByTime(SETTLE * 2);
    expect(moves).toEqual(["enter", "leave"]);
  });
});
