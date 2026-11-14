import { defineConfig } from 'vitest/config'

// Pure-logic tests: no rendering. happy-dom supplies localStorage and IndexedDB, and the
// tests mock the API instead of calling the site. Each test sits next to the file it
// covers, so the include pattern is recursive.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/testSetup.ts'],
  },
})
