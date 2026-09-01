import { defineConfig } from 'vitest/config'

// Functional-layer tests only (no rendering): cache.ts + filter.ts.
// happy-dom provides localStorage + IndexedDB; API/network is mocked in tests.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
