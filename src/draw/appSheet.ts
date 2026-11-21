import { createSignal } from "solid-js";

/** The whole layout is utility classes: a page painted without the sheet is a column of text. */
// Ready until the entry says otherwise: a document with no sheet to wait for has nothing to wait.
const [ready, setReady] = createSignal(true);

// A sheet that answers 404 means the document is older than the assets: GitHub Pages caches the
// document for ten minutes, and the cached copy names the file the last deploy replaced. Reloading
// asks for a document that names the file that exists. Once per visit - a second failure is
// something a reload cannot fix, and then the screen is worth painting however it comes out.
//
// The document's own watchdog (src/bootWatch.ts) keeps the same count under the same name, and it
// is installed first: it also counts a script that did not arrive.
const RELOADED = "furmony:sheet-reloaded";

const read = (): string | null => {
  try {
    return sessionStorage.getItem(RELOADED);
  } catch {
    return null;
  }
};

const mark = (): boolean => {
  try {
    sessionStorage.setItem(RELOADED, "1");
    return true;
  } catch {
    // Private mode can refuse storage, and a reload nobody remembers is the first lap of a loop.
    return false;
  }
};

/** The failure the built tag remembers: a 404 answers while the script is still on its way, so the
 *  `error` event would fire before any listener exists. The tag raises this flag instead
 *  (vite.config.ts), and the tag is written before the file is asked for. */
const failedEarly = (): boolean =>
  (window as unknown as { __appSheetFailed?: boolean }).__appSheetFailed ===
  true;

/** No ceiling on the wait: the alternative is a column of unstyled text, and the user can refresh. */
export function watchAppSheet(): void {
  const link = document.querySelector<HTMLLinkElement>("link[data-app-sheet]");
  if (!link || link.sheet) return;
  setReady(false);
  const done = (): void => {
    if (read()) return void setReady(true);
    if (!mark()) return void setReady(true);
    location.reload();
  };
  if (failedEarly()) return done();
  link.addEventListener("load", () => setReady(true), { once: true });
  link.addEventListener("error", done, { once: true });
}

export { ready as appSheetReady };
