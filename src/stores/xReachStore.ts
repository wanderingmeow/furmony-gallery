// src/stores/xReachStore.ts - whether this network can carry pictures from X. A sheet asks for many
// at once, so the answer is kept once per sheet, and the visit remembers it: the next detail sheet
// does not wait all over again.
import { createSignal, untrack } from "solid-js";
import { isTwimg } from "../data/image";

/** How a picture from X stopped arriving. */
export type XStopped =
  /** The browser refused before the request left the page, out of its own list of domains used for
   *  cross-site tracking, or out of an add-on. Nothing was sent, so the network is not the reason
   *  and the picture may still be reachable somewhere else. */
  | "refused"
  /** Nothing came back: no pixels and no failure. A network that will not carry a picture from X
   *  answers nothing, and the browser would sit on the request for minutes. */
  | "silent";

/** How long a sheet waits with nothing from X before the network is named as the reason. */
export const X_STALL_MS = 12_000;

const [xBlocked, setXBlocked] = createSignal<XStopped | undefined>(undefined);

/** What the visit last concluded about X, which the next sheet starts from. */
export { xBlocked };

/** What one detail sheet concluded about X, and how a picture tells it what happened. Only a
 *  picture from X changes the answer or is answered by it: a picture from another host fails for its
 *  own reasons, and letting it speak would blacken every picture here. */
export interface XGallery {
  /** The address went into the document. The first one from X starts the clock. */
  watched(url: string): void;
  /** A picture from X drew. */
  arrived(url: string): void;
  /** A picture from X came back with a failure. */
  refused(url: string): void;
  /** What this sheet concluded, and nothing while the wait is still running. */
  blocked(url: string): XStopped | undefined;
  /** The sheet is going away. */
  dispose(): void;
}

export function createXGallery(): XGallery {
  const [stopped, setStopped] = createSignal(untrack(xBlocked));
  const [reached, setReached] = createSignal(false);
  let clock: ReturnType<typeof setTimeout> | undefined;
  const quiet = (): void => {
    if (clock === undefined) return;
    clearTimeout(clock);
    clock = undefined;
  };
  // The sheet answers for a picture from X until one of them draws. After that a later failure
  // belongs to that picture alone.
  const answered = (url: string): boolean => isTwimg(url) && !reached();
  // This sheet's conclusion and the visit's memory are one claim, so they move together.
  const conclude = (how: XStopped): void => {
    setStopped(how);
    setXBlocked(how);
  };
  const forget = (): void => {
    setStopped(undefined);
    setXBlocked(undefined);
  };
  return {
    watched(url) {
      if (!isTwimg(url) || clock !== undefined || reached() || stopped())
        return;
      clock = setTimeout(() => {
        clock = undefined;
        conclude("silent");
      }, X_STALL_MS);
    },
    arrived(url) {
      if (!isTwimg(url)) return;
      quiet();
      setReached(true);
      forget();
    },
    refused(url) {
      if (!answered(url)) return;
      quiet();
      conclude("refused");
    },
    blocked(url) {
      return answered(url) ? stopped() : undefined;
    },
    dispose() {
      quiet();
    },
  };
}
