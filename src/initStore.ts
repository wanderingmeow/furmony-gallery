// The composition root: the one file that imports every store and starts them in the order the app
// needs. A component takes the store it uses from `stores/<name>`, and nothing here is exported
// for a component to import, so a test mocks only what the component under test uses.

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
