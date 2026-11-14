import { createSignal, untrack } from 'solid-js'

// Readers follow the related row: A → B → C. Those hops use router `replace`, so ✕ and
// the system back action go straight to the grid. The cost: nothing brings back the
// setting you just left, and this stack fills that gap. It holds only detail → detail
// hops, so ← walks it while ✕ still closes.
const MAX = 50

const [visited, setVisited] = createSignal<string[]>([])

// Where the current hop came from: tapping a related card writes forward, ← writes back,
// and Detail consumes the value when the id changes. With no pending hop the reader
// opened a detail from the grid or a link, so the old trail goes away.
type Pending = { kind: 'forward'; from: string } | { kind: 'back' } | null
let pending: Pending = null

/** Is there a previous setting to return to? With none, we draw no ← button. */
export function canGoBack(): boolean {
  return visited().length > 0
}

/** Before a hop to a related setting: remember the current one, and let Detail push it. */
export function markRelatedNav(from: string): void {
  pending = { kind: 'forward', from }
}

/** For ←: pop the previous setting. null means none, and then the button is not drawn. */
export function popBack(): string | null {
  // Detail calls both functions from an effect. Reading visited inside that effect would
  // rerun it whenever visited changes; then pending is already empty, and the second run
  // erases the hop it just recorded. untrack keeps that trap here instead of in callers.
  return untrack(() => {
    const [head, ...rest] = visited()
    if (!head) return null
    pending = { kind: 'back' }
    setVisited(rest)
    return head
  })
}

/** Detail calls this on every id change, including the first mount. */
export function onDetailShow(to: string): void {
  untrack(() => {
    const p = pending
    pending = null
    if (!p) {
      setVisited([]) // opened from the grid or a link: that trail is finished
      return
    }
    if (p.kind === 'forward' && p.from !== to && visited()[0] !== p.from) {
      setVisited([p.from, ...visited()].slice(0, MAX))
    }
    // a back hop needs nothing: popBack already removed that entry
  })
}

/** Clear on close, so the next setting opened from the grid starts a clean trail. */
export function clearDetailHistory(): void {
  pending = null
  setVisited([])
}
