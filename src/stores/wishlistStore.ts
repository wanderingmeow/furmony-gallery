// The list the reader starred: each id with the moment it was starred, kept in localStorage.
import { createSignal } from "solid-js";
import { noteSavedList } from "./persistenceStore";
import type { AdoptListing } from "../model/types";

const WISH_KEY = "furmony_wishlist";

export const [wishlist, setWishlist] = createSignal<Map<number, number>>(
  new Map(),
);

export function isWishlisted(id: number): boolean {
  return wishlist().has(id);
}

export function toggleWishlist(listing: AdoptListing): void {
  const id = listing.adoptId;
  const cur = wishlist();
  const next = new Map(cur);
  const adding = !cur.has(id);
  if (adding) {
    next.set(id, Date.now());
  } else {
    next.delete(id);
  }
  setWishlist(next);
  persistWishlist(next);
  if (adding) noteSavedList();
}

// Removes saved ids that the site no longer holds. The listings store calls this only after a load
// that answered in full - see `ListAnswer`.
export function cleanStaleWishlist(validIds: Set<number>): boolean {
  const wl = wishlist();
  let cleaned = false;
  const next = new Map(wl);
  for (const id of next.keys()) {
    if (!validIds.has(id)) {
      next.delete(id);
      cleaned = true;
    }
  }
  if (cleaned) {
    setWishlist(next);
    persistWishlist(next);
  }
  return cleaned;
}

function persistWishlist(w: Map<number, number>): void {
  try {
    localStorage.setItem(WISH_KEY, JSON.stringify(Object.fromEntries(w)));
  } catch {
    // Private mode and a full quota both throw here; the list on screen stays usable either way.
  }
}

export function loadWishlist(): void {
  try {
    const raw = localStorage.getItem(WISH_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, number>;
    const m = new Map<number, number>();
    for (const k in obj) m.set(Number(k), obj[k]);
    setWishlist(m);
  } catch {
    // A saved copy that cannot be read as a list is treated as an empty list.
  }
}
