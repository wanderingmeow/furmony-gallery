// Vitest setup: provide IndexedDB (fake-indexeddb) + a guaranteed global localStorage.
import 'fake-indexeddb/auto'

// happy-dom only exposes localStorage when run with --localstorage-file; provide a
// simple in-memory shim so the cache layer's localStorage migration is testable.
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store: Record<string, string> = {}
  let keys: string[] = []
  const syncKeys = () => { keys = Object.keys(store) }
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; syncKeys() },
    removeItem: (k: string) => { delete store[k]; syncKeys() },
    clear: () => { for (const k of keys) delete store[k]; keys = [] },
    key: (i: number) => keys[i] ?? null,
    get length() { return keys.length },
  }
}
