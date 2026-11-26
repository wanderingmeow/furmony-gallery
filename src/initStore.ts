// The composition root: the one file that imports every store and starts them in the order the app
// needs. A component takes the store it uses from `stores/<name>`, and nothing here is exported
// for a component to import, so a test mocks only what the component under test uses.

import { createEffect, createRoot, on } from "solid-js";
import { linkSort, loadFilters } from "./stores/filterStore";
import { sortFromQuery } from "./model/filter";
import { loadSession } from "./stores/sessionStore";
import { loadPush } from "./stores/pushStore";
import { loadWishlist } from "./stores/wishlistStore";
import { loadData } from "./stores/listingsStore";
import { loadSocials } from "./stores/socialsStore";
import { loadDebuts } from "./stores/debutsStore";
import { probeAvif } from "./data/image";
import { applyDocumentLocale, requestedLocale } from "./i18n";

export function initStore(): void {
  // First, because the answer comes a task later and every address written after it can then ask
  // Bilibili for the smaller format.
  probeAvif();
  applyDocumentLocale();
  loadSession();
  loadWishlist();
  loadFilters();
  // An address may ask for an order, and that ask outranks what the reader left: a notification that
  // names three new listings would open a list ordered by price, where none of the three is near the
  // top.
  const asked = sortFromQuery(new URLSearchParams(location.search).get("sort"));
  if (asked) linkSort(asked);
  loadData();
  loadSocials();
  loadDebuts();
  // Last: it reads the language the stores above settled on, and sends nothing before then.
  loadPush();

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
