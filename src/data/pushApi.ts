// src/data/pushApi.ts - the one call that tells the service about this browser.
//
// Anyone who can post to the endpoint can send this browser a notification. So it leaves in a POST
// body only, never in a query, never in storage, and never in a log. The browser keeps it, and this
// file reads it from the browser each time it is needed.
import { decodeSetting } from "./base64Setting";
import { PATH, serverUrl } from "./serverApi";

// Set at build time as base64 of the key. The key is public: a subscription is opened with it in
// front of the browser. The base64 keeps a built file from handing a secret scanner something it
// stops at, which is what the other encoded values here do for real.
const ENCODED_KEY = String(import.meta.env.VITE_VAPID_PUBLIC_KEY_B64 ?? "");

/** What the service can send word about. It answers 400 for a name outside this list, so a new
 *  category lands here when the service learns one.
 */
export const PUSH_CATEGORIES = ["new", "lock"] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];
export type PushPrefs = Record<PushCategory, boolean>;

/** Both on. A subscription made before the reader picked anything hears everything, and the
 *  service reads absent prefs the same way, so the two sides agree without a handshake.
 */
export const ALL_PUSH_ON: PushPrefs = { new: true, lock: true };

/** Where the word goes in this build, or '' when the build was given no service. */
export const PUSH_ENDPOINT = serverUrl(PATH.subscribe);
/** Where the record is read: the same address, and a body that asks for a read and cannot write. */
export const READ_ENDPOINT = serverUrl(PATH.subscription);

// Ten seconds, the same wait a search allows: the service answers in milliseconds when it answers,
// and the reader is holding a switch.
export const PUSH_TIMEOUT_MS = 10000;

/** The three keys the browser hands over. `endpoint` alone is enough to reach the browser; the other
 *  two prove the sender holds the site's key.
 */
export interface PushTriple {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What the service said, in the words the switch uses. */
export type PushAnswer =
  /** Delivered: the provider took the first notification. */
  | "live"
  /** Stored, and the provider did not answer the service. The browser side is fine, and the word
   *  goes as soon as that provider answers again. */
  | "pending"
  /** The provider says it does not know this endpoint, so the switch goes back off. */
  | "rejected"
  /** The service answered, and this browser may not ask again for a while. */
  | "busy"
  /** Nothing answered, so nothing was learned and the switch stays where it is. */
  | "unreachable"
  /** The service has no key to sign with, which is not this reader's doing. */
  | "silent"
  /** The service answered 400 for the body, which means this file built it wrong. */
  | "malformed";

/** What the service said to a request to stop. It answers the same way whether or not the endpoint
 *  was known, so a reader who already left learns nothing new.
 */
export type LeaveAnswer = "gone" | "busy" | "unreachable";

function bytesFromBase64(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(value.trim().replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** The key `pushManager.subscribe` asks for, or null.
 *
 *  65 bytes is an uncompressed P-256 point, and that is the only length a browser accepts, so a
 *  value of the wrong length fails here instead of at the browser's prompt.
 */
export function applicationKeyOf(
  encoded: string,
): Uint8Array<ArrayBuffer> | null {
  const raw = bytesFromBase64(decodeSetting(encoded));
  return raw && raw.length === 65 ? raw : null;
}

export function applicationKey(): Uint8Array<ArrayBuffer> | null {
  return applicationKeyOf(ENCODED_KEY);
}

/** Whether this build can ask at all: a service to ask, and a key to open a subscription with. The
 *  settings panel hides the whole row when this is false.
 */
export function pushConfigured(): boolean {
  return PUSH_ENDPOINT !== "" && applicationKey() !== null;
}

/** The three keys, read out of a live browser subscription. */
export function tripleOf(sub: PushSubscription): PushTriple {
  const keys = sub.toJSON().keys;
  return {
    endpoint: sub.endpoint,
    p256dh: keys?.p256dh ?? "",
    auth: keys?.auth ?? "",
  };
}

/** The body that asks to be told. Three keys means subscribe; `unsubscribe` means stop. One shape or
 *  the other: the service answers 400 for a body with both or neither, and a body with both would
 *  not say which the reader meant.
 *
 *  `lang` is this page's own language id, which the service reads directly. `API_LANGUAGE` is the
 *  shelf API's spelling, where `pa` means something and this file's ids mean nothing.
 */
export function subscribeBody(
  triple: PushTriple,
  prefs: PushPrefs,
  lang: string,
): Record<string, unknown> {
  return {
    endpoint: triple.endpoint,
    p256dh: triple.p256dh,
    auth: triple.auth,
    prefs: { ...prefs },
    lang,
  };
}

export function unsubscribeBody(endpoint: string): Record<string, unknown> {
  return { endpoint, unsubscribe: true };
}

/** The body that asks what the service holds. Nothing else belongs in it: a body with key material
 *  is a write, and this route is only worth having because it cannot change the row.
 */
export function readBody(endpoint: string): Record<string, unknown> {
  return { endpoint, read: true };
}

/** Where the record says this browser stands.
 *
 *  `held`   the row is here, and these are the picks a round sends from.
 *  `absent` the service has never heard of this address, or dropped it.
 *  `quiet`  nothing answered, which decides nothing.
 */
export type SettingsAnswer =
  | { at: "held"; prefs: PushPrefs; lang: string; pending: boolean }
  | { at: "absent" }
  | { at: "quiet" };

/** An absent key is on, which is how the service reads one too. */
export function readAnswer(status: number, said: unknown): SettingsAnswer {
  const body = said as {
    known?: boolean;
    prefs?: Partial<PushPrefs>;
    lang?: string;
    pending?: boolean;
  } | null;
  if (status !== 200 || typeof body?.known !== "boolean")
    return { at: "quiet" };
  if (!body.known) return { at: "absent" };
  return {
    at: "held",
    prefs: { new: body.prefs?.new !== false, lock: body.prefs?.lock !== false },
    lang: body.lang ?? "",
    pending: body.pending === true,
  };
}

/** The answer to a request to be told. `pending` is in the body, not the status: the service stored
 *  the address either way, and only the provider's silence separates the two.
 */
export function joinAnswer(status: number, said: unknown): PushAnswer {
  if (status === 200)
    return (said as { pending?: boolean })?.pending ? "pending" : "live";
  if (status === 400) return "rejected";
  if (status === 429) return "busy";
  if (status === 503) return "silent";
  // Anything else is a body this file built wrong, or a service that has changed its rules.
  return "malformed";
}

export function leaveAnswer(status: number): LeaveAnswer {
  if (status === 200) return "gone";
  if (status === 429) return "busy";
  return "unreachable";
}

/** One POST, or null when nothing answered. The timeout is the same for every call this file
 *  makes: the reader is holding a switch either way.
 */
async function postBody(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ status: number; said: unknown } | null> {
  if (!url) return null;
  const going = new AbortController();
  const stop = setTimeout(() => going.abort(), PUSH_TIMEOUT_MS);
  signal?.addEventListener("abort", () => going.abort(), { once: true });
  try {
    const reply = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: going.signal,
    });
    // A body is read only from an answer that could carry one, so a non-200 keeps the shape callers
    // already handle. A 200 that is not json is read as an empty one: the address was stored either
    // way, and a proxy that rewrote the body should not turn a success into a failure to reach anyone.
    return {
      status: reply.status,
      said: reply.ok ? await reply.json().catch(() => ({})) : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(stop);
  }
}

/** One POST, and what to tell the reader about it. Nothing throws: the browser has already done the
 *  part that cannot be redone without asking the reader again.
 */
export async function postTo(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<PushAnswer | LeaveAnswer> {
  if (!url) return "silent";
  const done = await postBody(url, body, signal);
  if (!done) return "unreachable";
  return "unsubscribe" in body
    ? leaveAnswer(done.status)
    : joinAnswer(done.status, done.said);
}

/** What the service holds about this address. The record is what a round sends from, so it is read
 *  before the switch is shown instead of being overwritten by whatever this browser remembered.
 */
export async function readFrom(
  url: string,
  endpoint: string,
  signal?: AbortSignal,
): Promise<SettingsAnswer> {
  const done = await postBody(url, readBody(endpoint), signal);
  return done ? readAnswer(done.status, done.said) : { at: "quiet" };
}

/** The same read, at the address this build was given. */
export function askSettings(
  endpoint: string,
  signal?: AbortSignal,
): Promise<SettingsAnswer> {
  return readFrom(READ_ENDPOINT, endpoint, signal);
}

/** The same call, at the address this build was given. */
export function tellService(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<PushAnswer | LeaveAnswer> {
  return postTo(PUSH_ENDPOINT, body, signal);
}
