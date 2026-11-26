// src/stores/debutsStore.ts — the debut pictures the build step left in `public/debuts.json`.
//
// The Furmony API has no field for them, so they arrive as a same-origin file the same way
// `socials.json` does. A file that does not answer costs the reader the debut pictures and nothing
// else: the detail opens without them, and the strip under the picture holds its own art.

import { createSignal } from "solid-js";
import { parseDebuts } from "../data/debuts";

const [debuts, setDebuts] = createSignal<Map<number, string[]>>(new Map());

export { debuts };

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
