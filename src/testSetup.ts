// Vitest setup: provide IndexedDB (fake-indexeddb) + a guaranteed global localStorage.
import 'fake-indexeddb/auto'

// The suite quotes the app in 简体中文, the language the dictionaries are written in. 重置 hands the
// language back to whatever the browser asked for, so this file has to give the browser one, and
// it has to do that before the app's modules are read: the language of a visit is settled as they
// load.
Object.defineProperty(globalThis.navigator, 'language', { value: 'zh-CN', configurable: true })
const { setLocale } = await import('./i18n')

// A test that picks another language leaves this one standing when it finishes.
setLocale('zh')

/** Let a test finish a Solid update. Solid runs queued effects after the setter returns, and the
 *  queue drains over more than one microtask, so a test waits one macrotask. */
export function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

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
