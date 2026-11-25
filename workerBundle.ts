import { resolve } from "node:path";
import { build } from "vite";

/**
 * The worker as one script: `src/worker/sw.ts` and the files it imports, joined into `sw.js`.
 * Nothing is written to disk. The dev server answers that path with these bytes and the worker's
 * test runs them, so both read what a browser installs. `at` is the project root, because the build
 * config and a test start from different directories.
 *
 * More than one chunk is an error, not a join: the browser fetches a second file at registration,
 * and offline that fetch is what this worker exists to survive.
 */
export async function bundleWorker(at = process.cwd()): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    root: at,
    build: {
      write: false,
      // The default outDir is dist, which the publish script reads.
      emptyOutDir: false,
      minify: false,
      target: "es2022",
      rollupOptions: {
        input: resolve(at, "src/worker/sw.ts"),
        output: { codeSplitting: false, entryFileNames: "sw.js" },
      },
    },
  });
  const first = Array.isArray(result) ? result[0] : result;
  // Only a watch build answers with a watcher, and this is not one.
  if (!("output" in first))
    throw new Error("the build answered with no output");
  const chunks = first.output.filter(
    (one: { type: string }) => one.type === "chunk",
  );
  const only = chunks[0];
  if (chunks.length !== 1 || !only || only.type !== "chunk") {
    throw new Error(
      `the worker came out as ${chunks.length} files; it has to stay one`,
    );
  }
  return only.code;
}
