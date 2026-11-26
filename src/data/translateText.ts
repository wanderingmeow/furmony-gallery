/**
 * Translate the 详细描述 on the detail sheet into the language on screen.
 *
 * This is the only runtime translation in the app, and the only place that sends the original text
 * to a third party. It calls the internal endpoint that the site's translate widget calls,
 * and that widget carries its key on every page it translates, so the key is public.
 *
 * The text goes out one paragraph at a time, because the endpoint translates a block as one unit,
 * and a shorter block translates worse. Its output needs three repairs:
 *
 * - Newlines read as plain whitespace, so the text is split by paragraph and the breaks are put
 *   back on the way home.
 * - Space at the ends of a block is cut, so this side puts the separators back.
 * - `&` comes back as `&amp;`, and anything between angle brackets is treated as a tag and lost,
 *   so the text is escaped before it leaves and unescaped after it returns.
 */

import { decodeSetting } from "./base64Setting";

const URL = "https://translate-pa.googleapis.com/v1/translateHtml";
// The key is public: the official site ships it in its own bundle. This build passes it in base64,
// so the built files hold no plain text of it. With no key, `translateTarget` answers undefined and
// the row shows no button.
const ENCODED_KEY = String(import.meta.env.VITE_TRANSLATE_KEY_B64 ?? "");
const KEY = decodeSetting(ENCODED_KEY);

/** The endpoint code for each interface language. A 简体中文 screen needs no work, so `zh` is absent. */
const TRANSLATE_TARGET: Partial<Record<string, string>> = {
  zh_tw: "zh-TW",
  ja: "ja",
  en: "en",
};

/**
 * The endpoint code for the language on screen, or `undefined` when that language needs no
 * translation or this build was given no key.
 */
export function translateTarget(locale: string): string | undefined {
  return KEY ? TRANSLATE_TARGET[locale] : undefined;
}

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
const ENTITIES = /&(?:amp|lt|gt|quot|#39|nbsp);/g;
const UNESCAPE: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * The answers this visit has already seen. One listing comes back in the related row, and a change
 * of language needs the same words again, so an answer is kept. A `Map` walks in insertion order:
 * a hit is re-inserted at the newest end, and past the capacity the oldest entry leaves. Memory
 * only, because a translation is not worth keeping across visits. A failed request stores nothing.
 */
const RECENT = 40;
const done = new Map<string, string>();

/** Put the entry at the newest end, and drop the oldest one when the table is over capacity. */
function remember(key: string, text: string): string {
  done.delete(key);
  done.set(key, text);
  if (done.size > RECENT) done.delete(done.keys().next().value as string);
  return text;
}

/** Whether the answer for these words is already in this visit's table, so a caller can tell
 *  whether asking would take a moment. */
export function translationIsCached(text: string, target: string): boolean {
  return done.has(`${target}\u0000${text}`);
}

/**
 * The endpoint copies the spacing of the text it was given. Chinese sentences put no space after a
 * full stop, so a translation can arrive as `forest.He`. A space goes in where a Latin letter
 * follows a stop. A decimal point is left alone, because `3.5` is not followed by a letter.
 */
function spaceAfterPunctuation(text: string): string {
  return text.replace(/([.,!?;:])(?=[A-Za-z])/g, "$1 ");
}

/**
 * The endpoint usually answers inside a second and can hold a request for more than ten seconds.
 * This is how long the row waits. Past the limit the row looks like a failed translation: the
 * original words stay on screen, the button reads as off, and the next tap sends the request again.
 */
const PATIENCE_MS = 8000;

/**
 * Translate one block of text, and return the paragraphs in the order they arrived. A failed
 * request rejects, and the caller decides what the reader sees in the meantime. Pass `signal` to
 * call a request off while it is on its way.
 */
export async function translateProse(
  text: string,
  target: string,
  signal?: AbortSignal,
): Promise<string> {
  const key = `${target}\u0000${text}`;
  const hit = done.get(key);
  if (hit !== undefined) return remember(key, hit);

  const paragraphs = text.split("\n");
  const giveUp = new AbortController();
  const timer = setTimeout(() => giveUp.abort(), PATIENCE_MS);
  if (signal?.aborted) giveUp.abort();
  else signal?.addEventListener("abort", () => giveUp.abort(), { once: true });
  let res: Response;
  let parsed: unknown;
  try {
    res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json+protobuf",
        "X-Goog-API-Key": KEY,
      },
      signal: giveUp.signal,
      body: JSON.stringify([
        [
          paragraphs.map((line) => line.replace(/[&<>]/g, (ch) => ESCAPE[ch])),
          "auto",
          target,
        ],
        // The endpoint needs this tail, and rejects the whole body without it.
        "te",
        null,
        1,
      ]),
    });
    if (!res.ok) throw new Error(`translate ${res.status}`);
    parsed = await res.json();
  } finally {
    clearTimeout(timer);
  }
  const lines = Array.isArray(parsed) ? (parsed as unknown[])[0] : undefined;
  if (!Array.isArray(lines) || lines.length !== paragraphs.length) {
    throw new Error("translate: the answer is missing a paragraph");
  }
  return remember(
    key,
    lines
      .map((line: string) =>
        spaceAfterPunctuation(
          line.replace(ENTITIES, (entity) => UNESCAPE[entity] ?? entity),
        ),
      )
      .join("\n"),
  );
}
