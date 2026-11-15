import { defineConfig } from 'vitest/config'

// Pure-logic tests: no rendering. happy-dom supplies localStorage and IndexedDB, and the
// tests mock the API instead of calling the site. Each test sits next to the file it
// covers, so the include pattern is recursive.
export default defineConfig({
  // Without these, Solid resolves through its ssr condition, where createEffect is a no-op:
  // the stores' effects silently never run and any test waiting on one waits forever.
  resolve: { conditions: ['development', 'browser'] },
  // A stand-in address, so the configured path is the one under test. The real one is
  // injected at build time and never appears here; nothing fetches, because each test
  // stubs fetch itself.
  define: {
    'import.meta.env.VITE_SEARCH_URL_B64': JSON.stringify(
      Buffer.from('https://search.invalid/search').toString('base64'),
    ),
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/testSetup.ts'],
  },
})
