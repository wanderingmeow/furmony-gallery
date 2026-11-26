// src/stores/debutsStore.ts - the debuts the build step left in `public/debuts.json`: each listing's
// album of photos, and the clip of its debut when the studio posted one.
//
// The Furmony API has no field for them, so they arrive as a same-origin file the same way
// `socials.json` does. A file that does not answer costs the reader the debut pictures and nothing
// else: the detail opens without them, and the strip under the picture holds its own art.

import { createSignal } from "solid-js";
import { parseDebuts, type Debut } from "../data/debuts";

const [debuts, setDebuts] = createSignal<Map<number, Debut>>(new Map());

export { debuts };

/** Whether this listing has the album of photos, which is what the reader's filter and the reading
 *  of `Adopted` rest on: the studio posts that album on the day the suit goes to its owner. A clip
 *  on its own is a showcase of the finished suit, and says nothing about who owns it now. */
export const hasDebutAlbum = (id: number): boolean =>
  (debuts().get(id)?.pictures.length ?? 0) > 0;

export async function loadDebuts(): Promise<void> {
  try {
    // BASE_URL is the configured sub-path WITHOUT a trailing slash (base: '/furmony-gallery'),
    // so add one: public/debuts.json is served at <base>/debuts.json.
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") + "/";
    const res = await fetch(`${base}debuts.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching debuts.json`);
    setDebuts(parseDebuts(await res.json()));
  } catch (err) {
    console.error("[debuts] load failed", err);
    setDebuts(new Map());
  }
}
