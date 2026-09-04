// src/store.tsx — public facade (composition root) for the app's global stores.
//
// Implementation lives in focused `stores/*` modules (filter/wishlist/session/
// notification/listings/derived); this barrel re-exports them under the single
// `../store` import path consumers already use, plus the cross-store init.
export * from './stores/filterStore'
export * from './stores/wishlistStore'
export * from './stores/sessionStore'
export * from './stores/notificationStore'
export * from './stores/listingsStore'
export * from './stores/socialsStore'
export * from './stores/derivedStore'

import { loadFilters } from './stores/filterStore'
import { loadSession } from './stores/sessionStore'
import { loadWishlist } from './stores/wishlistStore'
import { loadData } from './stores/listingsStore'
import { loadSocials } from './stores/socialsStore'

export function initStore(): void {
  loadSession()
  loadWishlist()
  loadFilters()
  loadData()
  loadSocials()
}
