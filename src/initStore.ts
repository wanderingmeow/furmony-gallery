// The composition root: the one file that imports every store and starts them in the order the app
// needs. A component takes the store it uses from `stores/<name>`, and nothing here is exported
// for a component to import, so a test mocks only what the component under test uses.

import { createEffect, createRoot, on } from "solid-js";
import { loadFilters } from "./stores/filterStore";
import { loadSession } from "./stores/sessionStore";
import { loadWishlist } from "./stores/wishlistStore";
import { loadData } from "./stores/listingsStore";
import { loadSocials } from "./stores/socialsStore";
import { applyDocumentLocale, requestedLocale } from "./i18n";

export function initStore(): void {
  applyDocumentLocale();
  loadSession();
  loadWishlist();
  loadFilters();
  loadData();
  loadSocials();

  // The shelf writes its words in the language the request asked for, so a new language means
  // asking again. `defer` keeps the load above as the only one at startup, and the root is here
  // because `Shell` starts this from a `.then`, where no owner is left to hold the effect.
  createRoot(() => {
    createEffect(
      on(
        requestedLocale,
        () => {
          void loadData();
        },
        { defer: true },
      ),
    );
  });
}
