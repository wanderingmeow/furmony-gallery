// src/data/searchApi.ts - the enhanced search calls: one for a sentence, one for a picture.
// Failures resolve to null rather than throwing, so the local search keeps working alone.
import { worthAsking } from "../model/queryRoute";
import { PATH, serverConfigured, serverUrl } from "./serverApi";

// With no server in this build, `searchConfigured` is false and the panel leaves the feature out.
export const SEARCH_ENDPOINT = serverUrl(PATH.search);
export const PICTURE_ENDPOINT = serverUrl(PATH.searchPicture);
export const PING_ENDPOINT = serverUrl(PATH.ping);

export const searchConfigured = serverConfigured;

// Ten seconds: about where a reader stops waiting and decides the page is dead. The answer
// takes about 50ms (p95 86ms), so the budget is the trip there. Each keystroke aborts the
// request before it, so this covers only the sentence the reader is waiting on.
export const SEARCH_TIMEOUT_MS = 10000;
// 24 leaves room for the app's own filters after the hits are merged into the list.
const WANT = 24;

// Ids only: a misread sentence shows up in the ranking, and echoing it back would change
// nothing about that.
export interface SemanticResult {
  ids: number[];
}

// The grid re-renders on tab and filter changes, each of which would otherwise re-ask.
// In memory only: nothing about a query reaches storage. Oldest entry goes first.
const CACHE_MAX = 60;
const cache = new Map<string, SemanticResult>();

/** A service that is mid-deploy must look like "no answer", not like a broken list. */
export function parseResponse(body: unknown): SemanticResult | null {
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids)) return null;
  return { ids: ids.filter((x): x is number => typeof x === "number") };
}

export async function askSettings(
  query: string,
  signal: AbortSignal,
): Promise<SemanticResult | null> {
  // Checked here too, so no future caller can send one: a bare number is an adoptId, which
  // the local search matches exactly and the model can only guess at.
  if (!searchConfigured || !worthAsking(query)) return null;
  const q = query.trim();
  const cached = cache.get(q);
  if (cached) return cached;
  try {
    const res = await fetch(
      `${SEARCH_ENDPOINT}?${new URLSearchParams({ q, k: String(WANT) })}`,
      { signal },
    );
    if (!res.ok) return null;
    const parsed = parseResponse(await res.json());
    if (!parsed) return null;
    if (cache.size >= CACHE_MAX)
      cache.delete(cache.keys().next().value as string);
    cache.set(q, parsed);
    return parsed;
  } catch {
    // Aborted or unreachable: the local matches stand on their own.
    return null;
  }
}

// ---------- warming the connection ----------

// A browser keeps one connection per origin for the whole session, so one small request while the
// reader shows interest takes the TLS handshake out of every wait they can see.
let warmed = false;

/** The connection warm-up. `no-cors` keeps the answer opaque, since only the live connection is
 *  wanted; `/ping` costs no slot of the service's per-minute budget and moves no counter, so the
 *  warm-up stays out of the numbers the rejection rate is read from.
 */
export function warmSearch(): void {
  if (warmed || !searchConfigured || typeof fetch !== "function") return;
  warmed = true;
  fetch(PING_ENDPOINT, {
    mode: "no-cors",
    cache: "no-store",
  }).catch(() => {});
}

// ---------- search by picture ----------

/** 45 s, against 10 s for a sentence: the wait covers the line ahead plus this picture's own work.
 *  `test_service.py` checks it against the service's queue budget.
 */
export const PICTURE_TIMEOUT_MS = 45000;

/** Why the reader's own device never produced a picture to send. These are the words this
 *  build speaks for itself; the service's error answers arrive as free text over the wire and stay
 *  outside the union, because typing them would claim what the wire does not guarantee.
 */
export type LocalReason = "unreadable" | "noHevc" | "timeout";

/** Every reason the page keeps a sentence for: the local ones, and the errors the service
 *  sends by name. A reason missing from `WHY` is a compile error, not a vaguer message. */
export type PictureError =
  | LocalReason
  | "not_an_image"
  | "too_large"
  | "embed_down"
  | "network"
  | "unknown";

export interface PictureResult {
  ids: number[];
  /** Where the subject sat, as fractions of the picture that was sent: left, top, width,
   *  height. Null when nothing was cut out, which is also when there is no region to show. */
  box: [number, number, number, number] | null;
  /** The service turns a second upload away while one is already in flight. Not a failure: retrying
   *  at once hits the same limit.
   */
  busy?: boolean;
  /** Why there is no answer, in the service's own word: `not_an_image`, `too_large`,
   *  `embed_down`, or one of the two the browser reports. */
  error?: string;
  /** What to do next. The service sets it for its own errors, this file for the browser's.
   *  Absent means no button. */
  action?: "pick" | "retry";
}

export function parsePicture(body: unknown): PictureResult | null {
  const got = body as {
    ids?: unknown;
    box?: unknown;
    error?: unknown;
    action?: unknown;
  } | null;
  if (!Array.isArray(got?.ids)) return null;
  const box = got.box;
  const usable =
    Array.isArray(box) &&
    box.length === 4 &&
    box.every((n) => typeof n === "number" && Number.isFinite(n));
  return {
    ids: got.ids.filter((x): x is number => typeof x === "number"),
    box: usable ? (box as [number, number, number, number]) : null,
    ...(typeof got.error === "string" ? { error: got.error } : {}),
    // The service sends this. Guessing it from `error` would be wrong as soon as a new
    // reason appears.
    ...(got.action === "pick" || got.action === "retry"
      ? { action: got.action }
      : {}),
  };
}

/** Where a queued upload stands, as the service itself said it. */
export type QueuePhase = "queued" | "waiting" | "started";

/** The lines of a streamed answer, in order; a reply that was never streamed is one line too. */
export function parseLines(text: string): unknown[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    });
}

function phaseOf(body: unknown): QueuePhase | null {
  const got = body as { event?: unknown; queued?: unknown } | null;
  if (got?.event === "waiting" || got?.event === "started") return got.event;
  // Served straight away is not news about a line.
  if (got?.event === "accept") return got.queued === true ? "queued" : null;
  return null;
}

/** Which listings look like this picture. The bytes are the body, not a form field, and
 *  `cutout` is always on: a design sheet loses nothing, and a photograph only finds its own
 *  design once the background is gone.
 *
 *  Never cached, unlike a sentence: two people's photographs are not the same question.
 *
 *  XHR because fetch reports the answer and nothing else. Uploading and searching are two
 *  waits of very different lengths, and on a hall's wifi the first is the slow one.
 */
export async function askPicture(
  picture: Blob,
  signal: AbortSignal,
  onUploaded?: () => void,
  onPhase?: (phase: QueuePhase) => void,
): Promise<PictureResult | null> {
  if (!searchConfigured || signal.aborted) return null;
  const query = new URLSearchParams({
    cutout: "1",
    k: String(WANT),
    // Asked for, so a service that does not stream still answers with one JSON object.
    stream: "1",
  });
  return await new Promise<PictureResult | null>((done) => {
    const xhr = new XMLHttpRequest();
    const stop = () => xhr.abort();
    const finish = (result: PictureResult | null) => {
      signal.removeEventListener("abort", stop);
      done(result);
    };
    signal.addEventListener("abort", stop);
    xhr.upload.addEventListener("load", () => onUploaded?.());
    const tell = () => {
      // Every line carries every phase it passed; the queue flow picks which ones to show.
      if (!onPhase) return;
      for (const body of parseLines(xhr.responseText)) {
        const phase = phaseOf(body);
        if (phase) onPhase(phase);
      }
    };
    xhr.addEventListener("progress", tell);
    xhr.open("POST", `${PICTURE_ENDPOINT}?${query}`);
    xhr.responseType = "text";
    xhr.setRequestHeader("content-type", picture.type || "image/jpeg");
    xhr.addEventListener("load", () => {
      // 429 is an answer with a retry, and the limiter can still send it before any line.
      if (xhr.status === 429) return finish({ ids: [], box: null, busy: true });
      const lines = parseLines(xhr.responseText);
      const found = parsePicture(lines[lines.length - 1] ?? null);
      // An error arrives as its own line, because the status code went out with the first one.
      if (found?.error === "busy")
        return finish({ ids: [], box: null, busy: true });
      // With no reason from the service every failure looks the same, so it gets no action.
      finish(found ?? { ids: [], box: null, error: "unknown" });
    });
    // A browser-level failure: only this file can say what happened, because the service
    // never answered.
    xhr.addEventListener("error", () =>
      finish({ ids: [], box: null, error: "network", action: "retry" }),
    );
    // The timeout and the reader both end here. Only the store can tell them apart.
    xhr.addEventListener("abort", () => finish(null));
    xhr.send(picture);
  });
}
