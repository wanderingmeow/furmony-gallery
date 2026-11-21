import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

// happy-dom supplies localStorage, IndexedDB and enough DOM for the component tests. The tests
// mock the API, so nothing reaches the site. Each test sits next to the file it covers, so the
// include pattern is recursive.
export default defineConfig({
  // Component tests need the Solid JSX transform; without it no .tsx file can be imported.
  plugins: [solid()],
  // Without these, Solid resolves through its ssr condition, where createEffect is a no-op:
  // the stores' effects silently never run and any test waiting on one waits forever.
  resolve: { conditions: ["development", "browser"] },
  // A stand-in address, so the configured path is the one under test. The real one is
  // injected at build time and never appears here; nothing fetches, because each test
  // stubs fetch itself.
  define: {
    "import.meta.env.VITE_SEARCH_URL_B64": JSON.stringify(
      Buffer.from("https://search.invalid/search").toString("base64"),
    ),
    "import.meta.env.VITE_TRANSLATE_KEY_B64": JSON.stringify(
      Buffer.from("test-translate-key").toString("base64"),
    ),
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/testSetup.ts"],
  },
});
